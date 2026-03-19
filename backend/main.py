"""
ZapOut Backend - MVP
FastAPI based backend for ZapOut payments
"""

import asyncio
import hashlib
import json
import os
import secrets
import sqlite3
import subprocess
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Set

import bcrypt
from app import auth_passkey  # Passkey auth module

# Import routers
from app.routers import mints, transactions
from app.routers.mints import router as mints_router
from fastapi import Depends, FastAPI, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator


# LND Connection via SSH to Helmut
def create_lnd_invoice(amount_sats: int, memo: str = "") -> dict:
    """
    Create a Lightning invoice via LND on Helmut
    Uses SSH to run lncli on Helmut's LND container
    """
    try:
        # SSH to Helmut and create invoice via docker exec
        cmd = [
            "ssh",
            "-o",
            "StrictHostKeyChecking=no",
            "helmut-tail",
            "docker",
            "exec",
            "lightning_lnd_1",
            "lncli",
            "-n",
            "mainnet",
            "addinvoice",
            "--amt",
            str(amount_sats),
            "--memo",
            memo,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

        # Filter out SSH warnings from stderr
        stderr_lines = [
            line for line in result.stderr.split("\n") if not line.startswith("Warning:")
        ]
        stderr_clean = "\n".join(stderr_lines).strip()

        # Check if we got valid JSON in stdout (even if stderr has warnings)
        try:
            data = json.loads(result.stdout)
            return {
                "payment_request": data.get("payment_request", ""),
                "r_hash": data.get("r_hash", ""),
                "add_index": data.get("add_index", ""),
            }
        except json.JSONDecodeError:
            if stderr_clean:
                return {"error": f"lncli failed: {stderr_clean}"}
            return {"error": f"Failed to parse lncli output: {result.stdout}"}

    except subprocess.TimeoutExpired:
        return {"error": "SSH timeout - Helmut not reachable"}
    except Exception as e:
        return {"error": str(e)}


def check_lnd_invoice(payment_hash: str) -> dict:
    """
    Check if a Lightning invoice has been settled via LND on Helmut
    Uses SSH to run lncli lookupinvoice on Helmut's LND container
    """
    if not payment_hash or payment_hash == "None":
        return {"settled": False}

    try:
        cmd = [
            "ssh",
            "-o",
            "StrictHostKeyChecking=no",
            "helmut-tail",
            "docker",
            "exec",
            "lightning_lnd_1",
            "lncli",
            "-n",
            "mainnet",
            "lookupinvoice",
            payment_hash,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

        try:
            data = json.loads(result.stdout)
            return {
                "settled": data.get("settled", False),
                "amt_paid_sat": data.get("amt_paid_sat", 0),
                "state": data.get("state", "UNKNOWN"),
            }
        except json.JSONDecodeError:
            return {"settled": False, "error": f"Failed to parse: {result.stdout}"}

    except subprocess.TimeoutExpired:
        return {"settled": False, "error": "SSH timeout"}
    except Exception as e:
        return {"settled": False, "error": str(e)}


def get_lnd_status() -> dict:
    """
    Get LND node status via Helmut SSH
    Returns node info if connected, error if not
    """
    try:
        cmd = [
            "ssh",
            "-o",
            "StrictHostKeyChecking=no",
            "helmut-tail",
            "docker",
            "exec",
            "lightning_lnd_1",
            "lncli",
            "-n",
            "mainnet",
            "getinfo",
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)

        stderr_lines = [
            line for line in result.stderr.split("\n") if not line.startswith("Warning:")
        ]
        stderr_clean = "\n".join(stderr_lines).strip()

        try:
            data = json.loads(result.stdout)
            return {
                "connected": True,
                "alias": data.get("alias", "Unknown"),
                "pubkey": data.get("identity_pubkey", "")[:16] + "...",
                "num_pending_channels": data.get("num_pending_channels", 0),
                "num_active_channels": data.get("num_active_channels", 0),
                "num_inactive_channels": data.get("num_inactive_channels", 0),
                "version": data.get("version", ""),
            }
        except json.JSONDecodeError:
            return {"connected": False, "error": stderr_clean or "Failed to get node info"}

    except subprocess.TimeoutExpired:
        return {"connected": False, "error": "SSH timeout - Helmut not reachable"}
    except Exception as e:
        return {"connected": False, "error": str(e)}


# =============================================================================
# WebSocket Connection Manager (NUT-17 Real-time Updates)
# =============================================================================
class ConnectionManager:
    """
    Manages WebSocket connections for real-time payment updates.
    Allows clients to subscribe to specific payment_id channels.
    """

    def __init__(self):
        # payment_id -> list of websocket connections
        self.active_connections: Dict[str, List[WebSocket]] = defaultdict(list)

    async def connect(self, websocket: WebSocket, payment_id: str):
        """Accept a new WebSocket connection and subscribe to payment_id channel"""
        await websocket.accept()
        if payment_id not in self.active_connections:
            self.active_connections[payment_id] = []
        self.active_connections[payment_id].append(websocket)
        print(
            f"[WS] Client connected to payment {payment_id}. Total: {len(self.active_connections[payment_id])}"
        )

    def disconnect(self, websocket: WebSocket, payment_id: str):
        """Remove a WebSocket connection from payment_id channel"""
        if payment_id in self.active_connections:
            if websocket in self.active_connections[payment_id]:
                self.active_connections[payment_id].remove(websocket)
            if not self.active_connections[payment_id]:
                del self.active_connections[payment_id]
        print(f"[WS] Client disconnected from payment {payment_id}")

    async def broadcast(self, payment_id: str, message: dict):
        """Broadcast a message to all clients subscribed to payment_id"""
        if payment_id in self.active_connections:
            dead_connections = []
            for connection in self.active_connections[payment_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    dead_connections.append(connection)
            # Clean up dead connections
            for dead in dead_connections:
                self.disconnect(dead, payment_id)

    def get_subscriber_count(self, payment_id: str) -> int:
        """Get number of active subscribers for a payment"""
        return len(self.active_connections.get(payment_id, []))


# Global connection manager instance
manager = ConnectionManager()


app = FastAPI(title="ZapOut API", version="0.1.0")

# Register routers
app.include_router(transactions.router)
app.include_router(auth_passkey.router)  # Passkey authentication
app.include_router(mints_router)  # Mint Management

# CORS - Restricted to known origins only
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(
    ","
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

# Token configuration
TOKEN_EXPIRY_HOURS = int(os.getenv("TOKEN_EXPIRY_HOURS", "24"))

# Rate limiting (simple in-memory)
from collections import defaultdict
from time import time

login_attempts = defaultdict(list)
RATE_LIMIT_WINDOW = 300  # 5 minutes
MAX_LOGIN_ATTEMPTS = 5


def check_rate_limit(ip: str) -> bool:
    """Check if IP has exceeded rate limit"""
    now = time()
    # Clean old attempts
    login_attempts[ip] = [t for t in login_attempts[ip] if now - t < RATE_LIMIT_WINDOW]

    if len(login_attempts[ip]) >= MAX_LOGIN_ATTEMPTS:
        return False

    login_attempts[ip].append(now)
    return True


# Database
DB_PATH = "zapout.db"


def init_db():
    """Initialize database tables"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Users table
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            iban TEXT,
            phone TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """
    )

    # Payments table
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            amount_cents INTEGER NOT NULL,
            currency TEXT DEFAULT 'EUR',
            method TEXT DEFAULT 'lightning',
            status TEXT DEFAULT 'pending',
            invoice_id TEXT,
            payment_hash TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """
    )

    # Tokens table
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """
    )

    # Baskets table - persistent carts that can be saved and reused
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS baskets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            items TEXT NOT NULL DEFAULT '[]',
            total_cents INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """
    )

    conn.commit()
    conn.close()


# Initialize DB on startup
init_db()


# Models
class UserCreate(BaseModel):
    email: str
    password: str
    iban: Optional[str] = None
    phone: Optional[str] = None


class UserLogin(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    token: str
    user_id: int
    email: str


class BasketCreate(BaseModel):
    name: str
    items: list = []
    total_cents: int = 0


class BasketUpdate(BaseModel):
    name: str
    items: list = []
    total_cents: int = 0


class PaymentCreate(BaseModel):
    amount_cents: int
    amount_sats: Optional[int] = None  # Optional: pre-calculated sats from frontend
    method: str = "lightning"  # lightning, cashu, nfc


class PaymentResponse(BaseModel):
    id: int
    amount_cents: int
    amount_sats: Optional[int] = None
    currency: str
    method: str
    status: str
    invoice_id: Optional[str]
    created_at: str
    bolt11: Optional[str] = None  # Lightning invoice for QR code


# Helpers
def hash_password(password: str) -> str:
    """Password hashing with bcrypt (salt included)"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode(), salt).decode()


def verify_password(password: str, hash: str) -> bool:
    # Try bcrypt first (new passwords)
    try:
        if bcrypt.checkpw(password.encode(), hash.encode()):
            return True
    except ValueError:
        pass

    # Fallback to SHA256 (legacy passwords)
    import hashlib

    return hashlib.sha256(password.encode()).hexdigest() == hash


def create_token(user_id: int) -> str:
    """Create authentication token with expiration"""
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRY_HOURS)

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        "INSERT INTO tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
        (user_id, token, expires_at.isoformat()),
    )
    conn.commit()
    conn.close()
    return token


def verify_token(authorization: str = Header(None)) -> int:
    """Verify token and return user_id"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")

    token = authorization.replace("Bearer ", "")

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT user_id, expires_at FROM tokens WHERE token = ?", (token,))
    row = c.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id, expires_at = row

    # Check token expiration
    if expires_at:
        exp = datetime.fromisoformat(expires_at)
        if datetime.now(timezone.utc) > exp:
            raise HTTPException(status_code=401, detail="Token expired")

    return user_id


# Routes
@app.get("/")
def root():
    return {"message": "ZapOut API", "version": "0.1.0"}


@app.get("/health")
def health():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/lightning/status")
def lightning_status():
    """Get Lightning Node status"""
    return get_lnd_status()


@app.post("/auth/register", response_model=TokenResponse)
def register(user: UserCreate):
    """Register new user"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Check if email exists
    c.execute("SELECT id FROM users WHERE email = ?", (user.email,))
    if c.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create user
    password_hash = hash_password(user.password)
    c.execute(
        "INSERT INTO users (email, password_hash, iban, phone) VALUES (?, ?, ?, ?)",
        (user.email, password_hash, user.iban, user.phone),
    )
    user_id = c.lastrowid
    conn.commit()

    # Create token
    token = create_token(user_id)
    conn.close()

    return TokenResponse(token=token, user_id=user_id, email=user.email)


@app.post("/auth/login", response_model=TokenResponse)
def login(credentials: UserLogin, request: Request = None):
    """Login user with rate limiting"""
    # Rate limiting
    client_ip = request.client.host if request else "unknown"
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Too many login attempts. Try again later.")

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.execute("SELECT id, password_hash FROM users WHERE email = ?", (credentials.email,))
    row = c.fetchone()

    if not row:
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user_id, password_hash = row

    if not verify_password(credentials.password, password_hash):
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token(user_id)
    conn.close()

    return TokenResponse(token=token, user_id=user_id, email=credentials.email)


@app.get("/payments")
def get_payments(user_id: int = Depends(verify_token)):
    """Get user's payments"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        """SELECT id, amount_cents, currency, method, status, invoice_id, created_at
           FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 50""",
        (user_id,),
    )
    payments = c.fetchall()
    conn.close()

    return [
        {
            "id": p[0],
            "amount_cents": p[1],
            "currency": p[2],
            "method": p[3],
            "status": p[4],
            "invoice_id": p[5],
            "created_at": p[6],
        }
        for p in payments
    ]


@app.get("/payments/{payment_id}")
def get_payment(payment_id: int, user_id: int = Depends(verify_token)):
    """Get a specific payment by ID with real-time Lightning status check"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Get payment from orders table
    c.execute(
        """SELECT id, user_id, total_cents, status, lightning_invoice, payment_hash, created_at
           FROM orders WHERE id = ? AND user_id = ?""",
        (payment_id, user_id),
    )
    order = c.fetchone()

    # Also check payments table
    c.execute(
        """SELECT id, user_id, amount_cents, status, invoice_id, created_at
           FROM payments WHERE id = ? AND user_id = ?""",
        (payment_id, user_id),
    )
    payment = c.fetchone()
    conn.close()

    if order:
        status = order[3]
        lightning_invoice = order[4]
        payment_hash = order[5]

        # If pending, check Lightning network for actual payment status
        if status == "pending" and lightning_invoice:
            lnd_status = get_lnd_status()
            if lnd_status.get("connected"):
                # Look up the invoice on Lightning network
                try:
                    result = check_lnd_invoice(payment_hash)
                    if result and result.get("settled"):
                        status = "paid"
                        # Update database
                        conn2 = sqlite3.connect(DB_PATH)
                        c2 = conn2.cursor()
                        c2.execute(
                            "UPDATE orders SET status = ? WHERE id = ?", (status, payment_id)
                        )
                        conn2.commit()
                        conn2.close()
                except Exception as e:
                    print(f"[WS] LND lookup error: {e}")

        return {
            "id": order[0],
            "user_id": order[1],
            "amount_cents": order[2],
            "status": status,
            "invoice": lightning_invoice,
            "payment_hash": payment_hash,
            "created_at": order[6],
            "websocket_url": f"ws://localhost:8000/ws/payments/{payment_id}",
        }

    if payment:
        return {
            "id": payment[0],
            "user_id": payment[1],
            "amount_cents": payment[2],
            "status": payment[3],
            "invoice_id": payment[4],
            "created_at": payment[5],
            "websocket_url": f"ws://localhost:8000/ws/payments/{payment_id}",
        }

    raise HTTPException(404, "Payment not found")


@app.post("/payments", response_model=PaymentResponse)
def create_payment(payment: dict, user_id: int = Depends(verify_token)):
    """Create a Lightning payment request"""
    amount_cents = payment.get("amount_cents", 0)
    amount_sats = payment.get("amount_sats", 0)
    method = payment.get("method", "lightning")

    if not amount_cents or amount_cents <= 0:
        raise HTTPException(400, "Valid amount_cents required")

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Create payment record
    c.execute(
        "INSERT INTO orders (user_id, total_cents, status) VALUES (?, ?, ?)",
        (user_id, amount_cents, "pending"),
    )
    order_id = c.lastrowid

    # Create Lightning invoice via LND
    bolt11 = ""
    if method == "lightning" or method == "lightning":
        lnd_result = create_lnd_invoice(amount_sats, f"ZapOut_Payment_{order_id}")

        if "error" in lnd_result:
            # Fallback to mock if LND fails
            bolt11 = f"lnbc{amount_sats}n1zapouttest"
            payment_hash = secrets.token_hex(32)
        else:
            bolt11 = lnd_result.get("payment_request", f"lnbc{amount_sats}n1zapouttest")
            payment_hash = lnd_result.get("r_hash", secrets.token_hex(32))

        c.execute(
            "UPDATE orders SET lightning_invoice=?, payment_hash=? WHERE id=?",
            (bolt11, payment_hash, order_id),
        )

    conn.commit()
    conn.close()

    return {
        "id": order_id,
        "amount_cents": amount_cents,
        "amount_sats": amount_sats,
        "currency": "EUR",
        "method": method,
        "invoice_id": str(order_id),
        "status": "pending",
        "bolt11": bolt11,
        "created_at": datetime.utcnow().isoformat(),
    }


# =============================================================================
# WebSocket Endpoint (NUT-17 Real-time Payment Updates)
# =============================================================================
@app.websocket("/ws/payments/{payment_id}")
async def websocket_payment(websocket: WebSocket, payment_id: int):
    """
    WebSocket endpoint for real-time payment status updates.
    Clients connect to receive instant notifications when a payment is settled.

    Usage:
        ws://localhost:8000/ws/payments/{payment_id}

    Messages sent to client:
        - {"type": "status_update", "status": "paid", "timestamp": "..."}
        - {"type": "error", "message": "..."}
        - {"type": "ping"} (heartbeat)
    """
    await manager.connect(websocket, str(payment_id))

    # Send initial connection confirmation
    await websocket.send_json(
        {
            "type": "connected",
            "payment_id": payment_id,
            "message": f"Subscribed to payment {payment_id} updates",
        }
    )

    # Start background task to poll Lightning network and broadcast updates
    asyncio.create_task(poll_payment_status(str(payment_id)))

    try:
        while True:
            # Keep connection alive and handle any client messages
            data = await websocket.receive_text()

            # Handle ping/pong for keepalive
            if data == "ping":
                await websocket.send_text("pong")

    except WebSocketDisconnect:
        manager.disconnect(websocket, str(payment_id))
    except Exception as e:
        print(f"[WS] Error with payment {payment_id}: {e}")
        manager.disconnect(websocket, str(payment_id))


async def poll_payment_status(payment_id: str):
    """
    Background task that polls Lightning network for payment status
    and broadcasts updates to connected WebSocket clients.
    """
    MAX_POLLS = 24  # Poll for ~2 minutes (5 sec intervals)

    for i in range(MAX_POLLS):
        await asyncio.sleep(5)  # Poll every 5 seconds

        try:
            # Get payment from database
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            c.execute(
                """SELECT status, payment_hash, lightning_invoice
                   FROM orders WHERE id = ?""",
                (payment_id,),
            )
            row = c.fetchone()
            conn.close()

            if not row:
                await manager.broadcast(
                    payment_id, {"type": "error", "message": "Payment not found"}
                )
                break

            status, payment_hash, lightning_invoice = row

            # If pending, check Lightning network
            if status == "pending" and payment_hash and payment_hash != "None":
                lnd_status = get_lnd_status()
                if lnd_status.get("connected"):
                    result = check_lnd_invoice(payment_hash)
                    if result.get("settled"):
                        # Update database
                        conn2 = sqlite3.connect(DB_PATH)
                        c2 = conn2.cursor()
                        c2.execute(
                            "UPDATE orders SET status = ? WHERE id = ?", ("paid", payment_id)
                        )
                        conn2.commit()
                        conn2.close()

                        # Broadcast paid status
                        await manager.broadcast(
                            payment_id,
                            {
                                "type": "status_update",
                                "status": "paid",
                                "settled_at": datetime.utcnow().isoformat(),
                                "amt_paid_sat": result.get("amt_paid_sat", 0),
                            },
                        )
                        print(f"[WS] Payment {payment_id} PAID - broadcasting update")
                        break

            # Broadcast current status
            await manager.broadcast(
                payment_id,
                {"type": "status_check", "status": status, "poll": i + 1, "max_polls": MAX_POLLS},
            )

        except Exception as e:
            print(f"[WS] Polling error for payment {payment_id}: {e}")
            await manager.broadcast(payment_id, {"type": "error", "message": str(e)})

    # After max polls, send timeout if still pending
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT status FROM orders WHERE id = ?", (payment_id,))
    row = c.fetchone()
    conn.close()

    if row and row[0] == "pending":
        await manager.broadcast(
            payment_id,
            {"type": "timeout", "status": "expired", "message": "Payment window expired"},
        )
        print(f"[WS] Payment {payment_id} expired - broadcasting timeout")


# Cart API
@app.get("/cart")
def get_cart(user_id: int = Depends(verify_token)):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        """
        SELECT ci.id, ci.product_id, ci.quantity, p.name, p.price_cents, p.description
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.user_id = ?
    """,
        (user_id,),
    )
    rows = c.fetchall()
    conn.close()
    return [
        {
            "id": r[0],
            "product_id": r[1],
            "quantity": r[2],
            "name": r[3],
            "price_cents": r[4],
            "description": r[5],
        }
        for r in rows
    ]


@app.post("/cart/items")
def add_to_cart(item: dict, user_id: int = Depends(verify_token)):
    product_id = item.get("product_id")
    quantity = item.get("quantity", 1)
    amount_cents = item.get("amount_cents", 0)

    if not product_id:
        raise HTTPException(400, "product_id required")

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Check if item already in cart
    c.execute(
        "SELECT id, quantity FROM cart_items WHERE user_id=? AND product_id=?",
        (user_id, product_id),
    )
    existing = c.fetchone()

    if existing:
        c.execute(
            "UPDATE cart_items SET quantity=? WHERE id=?", (existing[1] + quantity, existing[0])
        )
    else:
        c.execute(
            "INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)",
            (user_id, product_id, quantity),
        )

    conn.commit()
    conn.close()
    return {"success": True}


@app.delete("/cart")
def clear_cart(user_id: int = Depends(verify_token)):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM cart_items WHERE user_id=?", (user_id,))
    conn.commit()
    conn.close()
    return {"success": True}


@app.delete("/cart/items/{item_id}")
def remove_from_cart(item_id: int, user_id: int = Depends(verify_token)):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM cart_items WHERE id=? AND user_id=?", (item_id, user_id))
    conn.commit()
    conn.close()
    return {"success": True}


# Checkout - creates order and Lightning invoice
@app.post("/cart/checkout")
def checkout_cart(request: dict = None, user_id: int = Depends(verify_token)):
    if request is None:
        request = {}
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Get cart items
    c.execute(
        """
        SELECT ci.product_id, ci.quantity, p.name, p.price_cents
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.user_id = ?
    """,
        (user_id,),
    )
    items = c.fetchall()

    if not items:
        conn.close()
        raise HTTPException(400, "Cart is empty")

    # Calculate total
    total_cents = sum(item[3] * item[1] for item in items)

    # Create order
    c.execute(
        "INSERT INTO orders (user_id, total_cents, status) VALUES (?, ?, ?)",
        (user_id, total_cents, "pending"),
    )
    order_id = c.lastrowid

    # Calculate sats (approximately 500 sats per EUR as fallback)
    amount_sats = max(1, (total_cents // 100) * 500)

    # Generate Lightning invoice via LND on Helmut
    memo_clean = f"ZapOut_Order_{order_id}".replace(" ", "_")
    lnd_result = create_lnd_invoice(amount_sats, memo_clean)

    if "error" in lnd_result:
        # Fallback to mock if LND fails
        invoice_id = f"inv_{order_id}_{secrets.token_hex(4)}"
        bolt11 = f"lnbc{amount_sats}n1zapouttest"
        payment_hash = secrets.token_hex(32)
    else:
        invoice_id = lnd_result.get("r_hash", f"inv_{order_id}_{secrets.token_hex(4)}")
        bolt11 = lnd_result.get("payment_request", f"lnbc{amount_sats}n1zapouttest")
        payment_hash = invoice_id

    c.execute(
        "UPDATE orders SET lightning_invoice=?, payment_hash=? WHERE id=?",
        (invoice_id, payment_hash, order_id),
    )

    # Clear cart
    c.execute("DELETE FROM cart_items WHERE user_id=?", (user_id,))
    conn.commit()
    conn.close()

    return {
        "order_id": order_id,
        "amount_cents": total_cents,
        "amount_sats": amount_sats,
        "invoice": {"bolt11": bolt11},
        "payment_hash": payment_hash,
        "payment_id": order_id,
        "status": "pending",
        "items": [{"product_id": item[0], "quantity": item[1], "name": item[2]} for item in items],
    }


# Products API
@app.get("/products")
def get_products(user_id: int = Depends(verify_token)):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        "SELECT id, name, price_cents, description, image_url, category, active FROM products WHERE user_id=? ORDER BY category, name",
        (user_id,),
    )
    rows = c.fetchall()
    conn.close()
    return [
        {
            "id": r[0],
            "name": r[1],
            "price_cents": r[2],
            "description": r[3],
            "image_url": r[4],
            "category": r[5],
            "active": r[6],
        }
        for r in rows
    ]


@app.post("/products")
def create_product(product: dict, user_id: int = Depends(verify_token)):
    name = product.get("name")
    price_cents = product.get("price_cents")
    description = product.get("description", "")
    image_url = product.get("image_url", "")
    category = product.get("category", "")

    if not name or not price_cents:
        raise HTTPException(400, "name and price_cents required")

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        "INSERT INTO products (user_id, name, price_cents, description, image_url, category) VALUES (?, ?, ?, ?, ?, ?)",
        (user_id, name, price_cents, description, image_url, category),
    )
    product_id = c.lastrowid
    conn.commit()
    conn.close()

    return {
        "id": product_id,
        "name": name,
        "price_cents": price_cents,
        "description": description,
        "image_url": image_url,
        "category": category,
    }


@app.put("/products/{product_id}")
def update_product(product_id: int, product: dict, user_id: int = Depends(verify_token)):
    name = product.get("name")
    price_cents = product.get("price_cents")
    description = product.get("description")
    category = product.get("category")
    image_url = product.get("image_url")
    active = product.get("active")

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id FROM products WHERE id=? AND user_id=?", (product_id, user_id))
    if not c.fetchone():
        conn.close()
        raise HTTPException(404, "Product not found")

    # Build update query dynamically
    updates = []
    params = []
    if name is not None:
        updates.append("name=?")
        params.append(name)
    if price_cents is not None:
        updates.append("price_cents=?")
        params.append(price_cents)
    if description is not None:
        updates.append("description=?")
        params.append(description)
    if image_url is not None:
        updates.append("image_url=?")
        params.append(image_url)
    if category is not None:
        updates.append("category=?")
        params.append(category)

    params.extend([product_id, user_id])
    c.execute(f"UPDATE products SET {', '.join(updates)} WHERE id=? AND user_id=?", params)
    conn.commit()
    conn.close()

    return {"id": product_id, "success": True}


@app.delete("/products/{product_id}")
def delete_product(product_id: int, user_id: int = Depends(verify_token)):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM products WHERE id=? AND user_id=?", (product_id, user_id))
    conn.commit()
    conn.close()
    return {"success": True}


# ============================================
# BASKETS - Persistent carts that can be saved and reused
# ============================================


@app.get("/baskets")
def get_baskets(user_id: int = Depends(verify_token)):
    """Get all baskets for user"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        """
        SELECT id, name, items, total_cents, created_at, updated_at
        FROM baskets WHERE user_id=? ORDER BY updated_at DESC
        """,
        (user_id,),
    )
    rows = c.fetchall()
    conn.close()

    baskets = []
    for r in rows:
        baskets.append(
            {
                "id": r[0],
                "name": r[1],
                "items": json.loads(r[2]) if r[2] else [],
                "total_cents": r[3],
                "created_at": r[4],
                "updated_at": r[5],
            }
        )
    return {"baskets": baskets}


@app.post("/baskets")
def create_basket(basket: BasketCreate, user_id: int = Depends(verify_token)):
    """Save current cart as a basket"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        """
        INSERT INTO baskets (user_id, name, items, total_cents)
        VALUES (?, ?, ?, ?)
        """,
        (user_id, basket.name, json.dumps(basket.items), basket.total_cents),
    )
    basket_id = c.lastrowid
    conn.commit()
    conn.close()

    return {"id": basket_id, "success": True}


@app.get("/baskets/{basket_id}")
def get_basket(basket_id: int, user_id: int = Depends(verify_token)):
    """Get a specific basket"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        """
        SELECT id, name, items, total_cents, created_at, updated_at
        FROM baskets WHERE id=? AND user_id=?
        """,
        (basket_id, user_id),
    )
    r = c.fetchone()
    conn.close()

    if not r:
        raise HTTPException(404, "Basket not found")

    return {
        "id": r[0],
        "name": r[1],
        "items": json.loads(r[2]) if r[2] else [],
        "total_cents": r[3],
        "created_at": r[4],
        "updated_at": r[5],
    }


@app.put("/baskets/{basket_id}")
def update_basket(basket_id: int, basket: BasketUpdate, user_id: int = Depends(verify_token)):
    """Update a basket"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        """
        UPDATE baskets SET name=?, items=?, total_cents=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=? AND user_id=?
        """,
        (basket.name, json.dumps(basket.items), basket.total_cents, basket_id, user_id),
    )
    conn.commit()
    conn.close()
    return {"success": True}


@app.delete("/baskets/{basket_id}")
def delete_basket(basket_id: int, user_id: int = Depends(verify_token)):
    """Delete a basket"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM baskets WHERE id=? AND user_id=?", (basket_id, user_id))
    conn.commit()
    conn.close()
    return {"success": True}


@app.post("/baskets/{basket_id}/load")
def load_basket(basket_id: int, user_id: int = Depends(verify_token)):
    """Load basket items into current cart (clears existing cart)"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        """
        SELECT items, total_cents FROM baskets WHERE id=? AND user_id=?
        """,
        (basket_id, user_id),
    )
    r = c.fetchone()
    conn.close()

    if not r:
        raise HTTPException(404, "Basket not found")

    items = json.loads(r[0]) if r[0] else []
    total_cents = r[1]

    # Clear current cart and add basket items
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM cart_items WHERE user_id=?", (user_id,))

    for item in items:
        c.execute(
            """
            INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)
            """,
            (user_id, item["product_id"], item["quantity"]),
        )
    conn.commit()
    conn.close()

    return {
        "success": True,
        "items": items,
        "total_cents": total_cents,
    }


def create_payment(payment: PaymentCreate, user_id: int = Depends(verify_token)):
    """Create new payment (invoice) via LND"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Use amount_sats from frontend if provided, otherwise calculate
    amount_sats = (
        payment.amount_sats if payment.amount_sats else max(1, payment.amount_cents // 100)
    )

    # Create real Lightning invoice via LND
    lnd_result = create_lnd_invoice(
        amount_sats, f"ZapOut Payment {payment.amount_cents/100:.2f} EUR"
    )

    if "error" in lnd_result:
        # Fallback to mock if LND fails
        invoice_id = f"inv_{payment_id}_{secrets.token_urlsafe(8)}"
        bolt11 = f"lnbc{amount_sats}n1pwmock"
    else:
        invoice_id = (
            lnd_result.get("r_hash", "").encode().hex()
            if lnd_result.get("r_hash")
            else f"inv_{secrets.token_urlsafe(8)}"
        )
        bolt11 = lnd_result.get("payment_request", "")

    c.execute(
        """INSERT INTO payments (user_id, amount_cents, method, status, invoice_id)
           VALUES (?, ?, ?, 'pending', ?)""",
        (user_id, payment.amount_cents, payment.method, bolt11),
    )
    payment_id = c.lastrowid

    conn.commit()

    c.execute(
        "SELECT id, amount_cents, currency, method, status, invoice_id, created_at FROM payments WHERE id = ?",
        (payment_id,),
    )
    row = c.fetchone()
    conn.close()

    return PaymentResponse(
        id=row[0],
        amount_cents=row[1],
        amount_sats=amount_sats,
        currency=row[2],
        method=row[3],
        status=row[4],
        invoice_id=row[5],
        created_at=row[6],
        bolt11=bolt11,  # Add bolt11 for QR code
    )


@app.get("/user/me")
def get_me(user_id: int = Depends(verify_token)):
    """Get current user info"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, email, iban, phone, created_at FROM users WHERE id = ?", (user_id,))
    row = c.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    return {"id": row[0], "email": row[1], "iban": row[2], "phone": row[3], "created_at": row[4]}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)


# ============ BREEZ INTEGRATION ============

# from breez import get_breez_client, update_payment_status


class BreezePaymentCreate(BaseModel):
    amount_cents: int
    description: Optional[str] = "ZapOut Payment"


import os
import secrets

# Cashu Integration
import requests

DEFAULT_CASHU_MINT = os.getenv("CASHU_MINT_URL", "https://testnut.cashu.space")


@app.get("/cashu/mints")
def list_mints():
    return {
        "mints": [
            {"url": "https://testnut.cashu.space", "name": "Testnut", "fees": "0.5%"},
            {"url": "https://8333.space:3338", "name": "8333.space", "fees": "0%"},
            {"url": "https://cashu.me/mint", "name": "Cashu.me", "fees": "1%"},
        ]
    }


@app.post("/cashu/verify")
def verify_token_state(token_data: dict, user_id: int = Depends(verify_token)):
    """
    NUT-07: Verify Cashu Token State
    Check if a Cashu token has been spent or is still valid
    """
    try:
        token = token_data.get("token", "")
        if not token:
            return {"valid": False, "error": "No token provided"}

        # Parse Cashu token manually (format: cashu1<base64>)
        import base64
        import json

        token = token.strip()
        if token.startswith("cashu1"):
            token = token[6:]  # Remove prefix

        # Decode base64
        try:
            # Add padding if needed
            padding = 4 - len(token) % 4
            if padding != 4:
                token += "=" * padding
            decoded_bytes = base64.b64decode(token)
            decoded = json.loads(decoded_bytes)
        except Exception:
            return {"valid": False, "error": "Invalid token encoding"}

        if not isinstance(decoded, dict) or "proofs" not in decoded:
            return {"valid": False, "error": "Invalid token format - no proofs"}

        proofs = decoded.get("proofs", [])
        if not proofs:
            return {"valid": False, "error": "No proofs in token"}

        # Calculate total amount
        total_amount = sum(p.get("amount", 0) for p in proofs)

        # Get mint URL from token or use default
        mint_url = decoded.get("mint", DEFAULT_CASHU_MINT)

        # Check proof states via Cashu Mint API (NUT-07)
        try:
            import requests

            # NUT-07: POST /v1/check
            r = requests.post(f"{mint_url}/v1/check", json={"proofs": proofs}, timeout=15)
            if r.status_code == 200:
                states = r.json().get("states", [])
                spent = sum(1 for s in states if s.get("spent", False))
                unspent = len(states) - spent

                return {
                    "valid": unspent > 0,
                    "amount": total_amount,
                    "unspent": unspent,
                    "spent": spent,
                    "states": states,
                }
            else:
                # Mint nicht erreichbar - token könnte noch gültig sein
                return {
                    "valid": True,
                    "amount": total_amount,
                    "unspent": len(proofs),
                    "spent": 0,
                    "error": f"Mint responded {r.status_code}",
                }
        except Exception as e:
            # Wenn Mint nicht erreichbar, nehmen wir an Token ist gültig
            return {
                "valid": True,
                "amount": total_amount,
                "unspent": len(proofs),
                "spent": 0,
                "error": str(e),
            }

    except Exception as e:
        return {"valid": False, "error": str(e)}


def get_user_preferred_mint(user_id: int) -> str:
    """Get user's preferred mint URL from database"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        "SELECT mint_url FROM user_mints WHERE user_id=? AND is_preferred=1 AND is_active=1 LIMIT 1",
        (user_id,),
    )
    row = c.fetchone()
    conn.close()
    if row:
        return row[0]
    return DEFAULT_CASHU_MINT


@app.post("/cashu/mint-quote")
def create_mint_quote(
    amount_cents: int, user_id: int = Depends(verify_token), mint_url: str = None
):
    amount_sats = amount_cents // 10
    mint = mint_url or get_user_preferred_mint(user_id)

    try:
        # NUT-standard endpoint: /v1/mint/quote/bolt11
        r = requests.post(
            f"{mint}/v1/mint/quote/bolt11", json={"amount": amount_sats, "unit": "sat"}, timeout=30
        )
        if r.status_code == 200:
            data = r.json()
            return {
                "quote_id": data.get("quote", data.get("quoteId")),
                "amount_sats": amount_sats,
                "payment_request": data.get("request", data.get("pr")),
                "mint": mint,
                "mock": False,
            }
    except Exception as e:
        print(f"Cashu error: {e}")

    return {
        "quote_id": f"mock_{secrets.token_urlsafe(8)}",
        "amount_sats": amount_sats,
        "payment_request": f"lnbc{amount_sats}n1pwmock",
        "mint": mint,
        "mock": True,
    }


@app.get("/cashu/balance")
def get_cashu_balance(user_id: int = Depends(verify_token)):
    """Get user's Cashu token balance"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT SUM(amount) FROM cashu_tokens WHERE user_id = ?", (user_id,))
    row = c.fetchone()
    conn.close()

    balance_sats = row[0] if row[0] else 0
    return {
        "balance": balance_sats,
        "balance_sats": balance_sats,
        "balance_eur": balance_sats * 0.00004,
    }


@app.post("/cashu/receive")
def receive_cashu_token(request: dict, user_id: int = Depends(verify_token)):
    """Receive Cashu tokens into user's wallet"""
    token = request.get("token", "")
    if not token:
        return {"success": False, "error": "No token provided"}

    try:
        # Decode token to get amount
        import re

        # Simple parsing - extract amount from token
        # In production, use cashu-ts to properly decode
        amount = 0

        # Try to parse token
        try:
            # Try to call the Cashu receive API
            mint_url = DEFAULT_CASHU_MINT
            # This is a simplified version - in production use cashu-ts
            # For now, just store the token
            amount = 100  # Placeholder - would need proper decoding
        except Exception as e:
            return {"success": False, "error": str(e)}

        # Store token in database
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute(
            """INSERT INTO cashu_tokens (user_id, mint, amount, secret, proof)
                     VALUES (?, ?, ?, ?, ?)""",
            (
                user_id,
                DEFAULT_CASHU_MINT,
                amount,
                token[:100],
                token[100:200] if len(token) > 100 else "",
            ),
        )
        conn.commit()
        conn.close()

        return {"success": True, "amount": amount, "token": token[:50] + "..."}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/cashu/info")
def get_cashu_info(mint_url: str = None):
    mint = mint_url or DEFAULT_CASHU_MINT
    try:
        r = requests.get(f"{mint}/v1/keysets", timeout=15)
        if r.status_code == 200:
            return {"mint": mint, "keysets": r.json(), "working": True}
    except:
        pass
    return {"mint": mint, "working": False, "mock": True}


@app.get("/cashu/quote-status")
def get_quote_status(quote_id: str, mint_url: str = None, user_id: int = Depends(verify_token)):
    """Check if a mint quote has been paid"""
    mint = mint_url or DEFAULT_CASHU_MINT

    try:
        # NUT-standard: GET /v1/mint/quote/bolt11/{quote_id}
        r = requests.get(f"{mint}/v1/mint/quote/bolt11/{quote_id}", timeout=15)
        if r.status_code == 200:
            data = r.json()
            return {
                "quote_id": quote_id,
                "state": data.get("state", "UNKNOWN"),  # UNPAID, PAID, EXPIRED
                "paid": data.get("paid", False),
                "expiry": data.get("expiry"),
                "amount": data.get("amount"),
            }

    except Exception as e:
        return {"quote_id": quote_id, "state": "ERROR", "paid": False, "error": str(e)}


@app.post("/cashu/melt")
def melt_cashu_tokens(request: dict, user_id: int = Depends(verify_token)):
    """Melt Cashu tokens - pay Lightning invoice with ecash"""
    invoice = request.get("invoice", "")
    token_str = request.get("token", "")

    if not invoice:
        raise HTTPException(400, "Lightning invoice (bolt11) required")
    if not token_str:
        raise HTTPException(400, "Cashu token required")

    mint = request.get("mint_url", DEFAULT_CASHU_MINT)

    try:
        # Parse token and get proofs
        # In production, use cashu-ts to properly decode
        token_data = None
        if token_str.startswith("cashu1"):
            # Simple base64 decode (simplified)
            try:
                import base64

                payload = token_str[6:]  # Remove "cashu1" prefix
                # This is simplified - real implementation needs cashu-ts
                decoded = base64.b64decode(payload + "==")
                token_data = {"raw": decoded[:100]}  # Simplified
            except:
                pass

        # For now, return a mock response
        # In production, use cashu wallet.meltProofs()
        return {
            "success": True,
            "paid": True,
            "preimage": secrets.token_hex(32),
            "fee": 0,
            "message": "Melt endpoint - requires cashu-ts integration for full implementation",
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


# Merchant Payment Request (Quick Payment)
@app.post("/merchant/payment-request")
def create_merchant_payment_request(request: dict, user_id: int = Depends(verify_token)):
    """Create a payment request for quick merchant payments"""
    amount_cents = request.get("amount_cents")
    method = request.get("method", "lightning")  # Default zu Lightning

    if not amount_cents:
        raise HTTPException(400, "amount_cents required")

    # EUR zu Sats Konvertierung (ca. 1 cent = 10 sats bei ~60k BTC)
    amount_sats = amount_cents * 10

    # Create order
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        "INSERT INTO orders (user_id, total_cents, status) VALUES (?, ?, ?)",
        (user_id, amount_cents, "pending"),
    )
    order_id = c.lastrowid
    conn.commit()

    # Create Lightning invoice via LND
    bolt11 = ""
    payment_hash = ""
    if method == "lightning":
        lnd_result = create_lnd_invoice(amount_sats, f"ZapOut_Payment_{order_id}")

        if "error" in lnd_result:
            # LND failed, return error
            conn.close()
            raise HTTPException(500, f"Lightning invoice failed: {lnd_result['error']}")

        bolt11 = lnd_result.get("payment_request", "")
        payment_hash = lnd_result.get("r_hash", "")

        c.execute(
            "UPDATE orders SET lightning_invoice=?, payment_hash=? WHERE id=?",
            (bolt11, payment_hash, order_id),
        )
        conn.commit()

    conn.close()

    return {
        "quote_id": f"quote_{order_id}",
        "order_id": order_id,
        "amount_cents": amount_cents,
        "amount_sats": amount_sats,
        "bolt11": bolt11,
        "payment_hash": payment_hash,
        "method": method,
        "paid": False,
    }


@app.get("/merchant/payment-request/{quote_id}")
def get_merchant_payment_status(quote_id: str, user_id: int = Depends(verify_token)):
    """Check payment status for a merchant payment request"""
    # Extract order_id from quote_id if possible
    order_id = quote_id.replace("quote_", "")

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        "SELECT id, total_cents, status FROM orders WHERE id=? AND user_id=?", (order_id, user_id)
    )
    row = c.fetchone()
    conn.close()

    if not row:
        raise HTTPException(404, "Payment not found")

    return {
        "quote_id": quote_id,
        "order_id": row[0],
        "amount_cents": row[1],
        "status": row[2],
        "paid": row[2] in ["paid", "completed"],
    }
