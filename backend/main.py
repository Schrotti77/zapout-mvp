"""
ZapOut Backend - MVP
FastAPI based backend for ZapOut payments
Phase 1: Structured Logging, Typed Errors, Centralized Config
"""

import asyncio
import hashlib
import json
import logging
import os
import secrets
import sqlite3
import subprocess
import sys
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Set

import bcrypt

# Phase 1: Import new config, errors, logging modules
from app import auth_passkey  # Passkey auth module
from app.config import settings
from app.errors import (
    AppError,
    AuthenticationError,
    ConflictError,
    ExternalServiceError,
    NotFoundError,
    RateLimitError,
    ValidationError,
)
from app.logging_config import (
    RequestContextLogger,
    get_request_id,
    request_id_ctx,
    set_request_id,
    setup_logging,
)

# Import routers
from app.routers import mints, transactions
from app.routers.mints import router as mints_router
from fastapi import (
    Depends,
    FastAPI,
    Header,
    HTTPException,
    Request,
    Response,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator

# Setup structured logging
setup_logging(debug=settings.debug)
logger = logging.getLogger(__name__)

logger.info("Starting ZapOut API", extra={"version": settings.app_version})


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


# ============================================================================
# App Configuration (Phase 1: Centralized via config.py)
# ============================================================================
app = FastAPI(title=settings.app_name, version=settings.app_version)

# Register routers
app.include_router(transactions.router)
app.include_router(auth_passkey.router)  # Passkey authentication
app.include_router(mints_router)  # Mint Management

# CORS - Using centralized config
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


# SEC-CRIT-03: Security Headers Middleware
# Adds protection against common web vulnerabilities
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Add security headers to all responses"""
    response = await call_next(request)

    # Prevent MIME type sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"

    # Prevent clickjacking
    response.headers["X-Frame-Options"] = "DENY"

    # XSS protection (for older browsers)
    response.headers["X-XSS-Protection"] = "1; mode=block"

    # Referrer policy - don't leak referrer to external sites
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    # Content Security Policy (restrictive)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "connect-src 'self' https://api.coingecko.com; "
        "frame-ancestors 'none';"
    )

    return response


# ============================================================================
# Middleware: Request ID + Logging
# ============================================================================
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """Add unique request ID to each request for tracing"""
    request_id = str(uuid.uuid4())[:8]
    set_request_id(request_id)

    logger.info(
        f"Incoming request: {request.method} {request.url.path}",
        extra={
            "extra_fields": {
                "request_id": request_id,
                "method": request.method,
                "path": str(request.url.path),
                "client_ip": request.client.host if request.client else "unknown",
            }
        },
    )

    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id

    logger.info(
        f"Response: {response.status_code}",
        extra={
            "extra_fields": {
                "request_id": request_id,
                "status_code": response.status_code,
            }
        },
    )

    return response


# ============================================================================
# Global Exception Handler (Phase 1: Typed Error Hierarchy)
# ============================================================================
@app.exception_handler(AppError)
async def app_error_handler(request: Request, error: AppError):
    """Handle typed AppError exceptions"""
    logger.warning(
        f"AppError: {error.code} - {error.message}",
        extra={"extra_fields": {"error_code": error.code, "details": error.details}},
    )
    return Response(
        content=json.dumps(error.to_dict()),
        status_code=error.status_code,
        media_type="application/json",
    )


@app.exception_handler(Exception)
async def generic_error_handler(request: Request, error: Exception):
    """Handle unexpected exceptions - log and return generic 500"""
    logger.error(
        f"Unexpected error: {str(error)}",
        extra={"extra_fields": {"error_type": type(error).__name__}},
        exc_info=True,
    )
    return Response(
        content=json.dumps(
            {
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "An unexpected error occurred",
                    "status": 500,
                }
            }
        ),
        status_code=500,
        media_type="application/json",
    )


# ============================================================================
# Rate Limiting (using centralized config)
# ============================================================================
from collections import defaultdict
from time import time

# SEC-HIGH-06: Per-process rate limiting (in-memory)
# Limitation: In multi-worker deployments, each worker has separate rate limit state.
# For production with multiple workers, use Redis-based rate limiting:
#   - upstash/ratelimit: https://github.com/upstash/ratelimit-python
#   - Or slowapi with Redis backend
login_attempts: Dict[str, List[float]] = defaultdict(list)


def check_rate_limit(ip: str) -> bool:
    """Check if IP has exceeded rate limit

    Note: This is per-process. For multi-worker deployments,
    use Redis-based rate limiting (see SEC-HIGH-06 documentation).
    """
    now = time()
    # Clean old attempts
    login_attempts[ip] = [t for t in login_attempts[ip] if now - t < settings.rate_limit_window]

    if len(login_attempts[ip]) >= settings.max_login_attempts:
        return False

    login_attempts[ip].append(now)
    return True


# ============================================================================
# Database (using centralized config)
# ============================================================================
DB_PATH = settings.db_path


def calculate_vat(gross_cents, vat_rate):
    """Calculate VAT from gross amount. vat_rate is percentage (e.g., 19 for 19%)"""
    net = round(gross_cents * 100 / (100 + vat_rate))
    vat = gross_cents - net
    return net, vat


def calculate_vat_breakdown(items):
    """Calculate VAT breakdown by rate for a list of cart items.
    Each item should have: price_cents, quantity, vat_rate (optional, defaults to 19)
    Returns dict: {rate: {net, vat, subtotal, count}}
    """
    breakdown = {}
    for item in items:
        rate = item.get("vat_rate") or 19
        subtotal = item.get("price_cents", 0) * item.get("quantity", 1)
        net, vat = calculate_vat(subtotal, rate)

        if rate not in breakdown:
            breakdown[rate] = {"net": 0, "vat": 0, "subtotal": 0, "count": 0}
        breakdown[rate]["net"] += net
        breakdown[rate]["vat"] += vat
        breakdown[rate]["subtotal"] += subtotal
        breakdown[rate]["count"] += item.get("quantity", 1)
    return breakdown


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

    # Products table - add vat_rate column if not exists (MwSt Support)
    try:
        c.execute("ALTER TABLE products ADD COLUMN vat_rate INTEGER DEFAULT 19")
    except sqlite3.OperationalError:
        pass  # Column already exists

    # Cashu tokens table - store user's ecash tokens
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS cashu_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            mint_url TEXT NOT NULL,
            amount INTEGER NOT NULL,
            token TEXT NOT NULL,
            proof TEXT,
            keyset_id TEXT,
            status TEXT DEFAULT 'active',  -- active, spent, refreshed
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            spent_at TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """
    )

    # Cashu token history - track all token operations
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS cashu_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            action TEXT NOT NULL,  -- mint, receive, send, split, melt, refresh
            amount INTEGER NOT NULL,
            mint_url TEXT,
            token_preview TEXT,  -- First 50 chars for display
            description TEXT,
            related_token_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """
    )

    # User mints table - track user's configured mints
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS user_mints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            mint_url TEXT NOT NULL,
            name TEXT,
            is_active INTEGER DEFAULT 1,
            is_preferred INTEGER DEFAULT 0,
            last_used TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(user_id, mint_url)
        )
    """
    )

    # Categories table - for POS product organization
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            icon TEXT DEFAULT '📦',
            sort_order INTEGER DEFAULT 0,
            color TEXT DEFAULT '#f7931a',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(user_id, name)
        )
    """
    )

    # Products table
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            price_cents INTEGER NOT NULL,
            description TEXT,
            image_url TEXT,
            category_id INTEGER,
            category TEXT,
            sku TEXT,
            vat_rate INTEGER DEFAULT 19,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (category_id) REFERENCES categories(id)
        )
    """
    )

    # Cart items table
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS cart_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        )
    """
    )

    # Orders table
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            order_id TEXT UNIQUE NOT NULL,
            total_cents INTEGER NOT NULL,
            tip_cents INTEGER DEFAULT 0,
            tip_percentage INTEGER DEFAULT 0,
            method TEXT DEFAULT 'lightning',
            status TEXT DEFAULT 'pending',
            bolt11 TEXT,
            payment_hash TEXT,
            paid_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """
    )

    # Order items table
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER,
            product_name TEXT NOT NULL,
            price_cents INTEGER NOT NULL,
            quantity INTEGER DEFAULT 1,
            vat_rate INTEGER DEFAULT 19,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        )
    """
    )

    # Migrate: add category_id column if products exists but column is missing
    try:
        c.execute("ALTER TABLE products ADD COLUMN category_id INTEGER")
    except sqlite3.OperationalError:
        pass  # Column already exists

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
    """Password hashing with bcrypt (salt included)

    SEC-HIGH-05: Using explicit rounds=12 (OWASP 2023 recommendation)
    """
    salt = bcrypt.gensalt(rounds=12)
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
    expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.token_expiry_hours)

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
        raise AuthenticationError("Missing token")

    token = authorization.replace("Bearer ", "")

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT user_id, expires_at FROM tokens WHERE token = ?", (token,))
    row = c.fetchone()
    conn.close()

    if not row:
        raise AuthenticationError("Invalid token")

    user_id, expires_at = row

    # Check token expiration
    if expires_at:
        exp = datetime.fromisoformat(expires_at)
        if datetime.now(timezone.utc) > exp:
            raise AuthenticationError("Token expired")

    return user_id


# Routes
@app.get("/")
def root():
    return {"message": "ZapOut API", "version": "0.1.0"}


@app.get("/health")
def health():
    """Liveness check - is the app running?"""
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/ready")
def ready():
    """
    Readiness check - are all dependencies available?
    Used by load balancers and orchestrators (Kubernetes, etc.)
    """
    checks = {
        "database": check_database(),
    }

    all_ok = all(c["status"] == "ok" for c in checks.values())

    return {
        "status": "ready" if all_ok else "not_ready",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": checks,
    }


def check_database() -> dict:
    """Check database connectivity"""
    try:
        conn = sqlite3.connect(DB_PATH, timeout=5)
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        conn.close()
        return {"status": "ok", "message": "connected"}
    except Exception as e:
        logger.error(f"Database check failed: {e}")
        return {"status": "error", "message": str(e)}


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
        raise ConflictError("Email already registered", resource="user")

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
        raise RateLimitError("Too many login attempts. Try again later.", retry_after=60)

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.execute("SELECT id, password_hash FROM users WHERE email = ?", (credentials.email,))
    row = c.fetchone()

    if not row:
        conn.close()
        raise AuthenticationError("Invalid credentials")

    user_id, password_hash = row

    if not verify_password(credentials.password, password_hash):
        conn.close()
        raise AuthenticationError("Invalid credentials")

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


@app.get("/reports/daily")
def get_daily_report(
    date: Optional[str] = None,  # YYYY-MM-DD format, defaults to today
    user_id: int = Depends(verify_token),
):
    """
    Get daily sales report for a specific date.
    Includes total sales, transaction count, average transaction,
    VAT breakdown, and payment method breakdown.
    """
    if date is None:
        date = datetime.now().strftime("%Y-%m-%d")

    # Validate date format
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise ValidationError("Invalid date format. Use YYYY-MM-DD")

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Get orders for the date
    c.execute(
        """
        SELECT id, total_cents, tip_cents, method, status, created_at
        FROM orders
        WHERE user_id=? AND date(created_at) = ? AND status = 'completed'
        ORDER BY created_at DESC
        """,
        (user_id, date),
    )
    orders = c.fetchall()

    # Calculate totals
    total_sales_cents = sum(o[1] or 0 for o in orders)
    total_tips_cents = sum(o[2] or 0 for o in orders)
    transaction_count = len(orders)
    avg_transaction = total_sales_cents / transaction_count if transaction_count > 0 else 0

    # Payment method breakdown
    method_breakdown = defaultdict(lambda: {"count": 0, "total_cents": 0})
    for o in orders:
        method_breakdown[o[3]]["count"] += 1
        method_breakdown[o[3]]["total_cents"] += o[1] or 0

    # Lightning stats
    lightning_orders = [o for o in orders if o[3] == "lightning"]
    cashu_orders = [o for o in orders if o[3] == "cashu"]

    # Get hourly breakdown
    hourly_breakdown = defaultdict(lambda: {"count": 0, "total_cents": 0})
    for o in orders:
        hour = datetime.fromisoformat(o[5]).strftime("%H:00")
        hourly_breakdown[hour]["count"] += 1
        hourly_breakdown[hour]["total_cents"] += o[1] or 0

    conn.close()

    return {
        "date": date,
        "total_sales_cents": total_sales_cents,
        "total_sales_eur": total_sales_cents / 100,
        "total_tips_cents": total_tips_cents,
        "transaction_count": transaction_count,
        "avg_transaction_cents": round(avg_transaction),
        "avg_transaction_eur": round(avg_transaction) / 100,
        "lightning": {
            "count": len(lightning_orders),
            "total_cents": sum(o[1] or 0 for o in lightning_orders),
        },
        "cashu": {
            "count": len(cashu_orders),
            "total_cents": sum(o[1] or 0 for o in cashu_orders),
        },
        "hourly": dict(hourly_breakdown),
        "currency": "EUR",
    }


@app.get("/reports/date-range")
def get_date_range_report(
    start_date: str,  # YYYY-MM-DD
    end_date: str,  # YYYY-MM-DD
    user_id: int = Depends(verify_token),
):
    """
    Get sales report for a date range.
    Returns daily totals for each day in the range.
    """
    # Validate date formats
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        raise ValidationError("Invalid date format. Use YYYY-MM-DD")

    if start > end:
        raise ValidationError("start_date must be before end_date")

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.execute(
        """
        SELECT date(created_at) as day,
               COUNT(*) as count,
               SUM(total_cents) as total
        FROM orders
        WHERE user_id=? AND date(created_at) BETWEEN ? AND ? AND status = 'completed'
        GROUP BY day
        ORDER BY day
        """,
        (user_id, start_date, end_date),
    )
    rows = c.fetchall()
    conn.close()

    return {
        "start_date": start_date,
        "end_date": end_date,
        "days": [
            {
                "date": r[0],
                "transaction_count": r[1],
                "total_cents": r[2] or 0,
                "total_eur": (r[2] or 0) / 100,
            }
            for r in rows
        ],
    }


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

    raise NotFoundError("Payment", "not_found")


@app.post("/payments", response_model=PaymentResponse)
def create_payment(payment: dict, user_id: int = Depends(verify_token)):
    """Create a Lightning payment request"""
    amount_cents = payment.get("amount_cents", 0)
    amount_sats = payment.get("amount_sats", 0)
    method = payment.get("method", "lightning")

    if not amount_cents or amount_cents <= 0:
        raise ValidationError(
            "Valid amount_cents required",
            field_errors=[{"field": "amount_cents", "message": "Must be greater than 0"}],
        )

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
# SEC-CRIT-02: Authentication required for WebSocket connections
# =============================================================================
@app.websocket("/ws/payments/{payment_id}")
async def websocket_payment(websocket: WebSocket, payment_id: int, token: Optional[str] = None):
    """
    WebSocket endpoint for real-time payment status updates.
    Clients connect to receive instant notifications when a payment is settled.

    SEC-CRIT-02: Authentication is now REQUIRED.

    Usage:
        ws://localhost:8000/ws/payments/{payment_id}?token={bearer_token}

    Messages sent to client:
        - {"type": "status_update", "status": "paid", "timestamp": "..."}
        - {"type": "error", "message": "..."}
        - {"type": "ping"} (heartbeat)

    Error codes:
        - 4001: Authentication required
        - 4003: Payment not authorized for user
    """
    # SEC-CRIT-02: Verify token before accepting connection
    if not token:
        await websocket.close(code=4001)
        return

    # Verify token and get user_id
    try:
        # Remove 'Bearer ' prefix if present
        if token.startswith("Bearer "):
            token = token.replace("Bearer ", "")

        # Verify token (adapted from verify_token for WebSocket use)
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT user_id, expires_at FROM tokens WHERE token = ?", (token,))
        row = c.fetchone()
        conn.close()

        if not row:
            await websocket.close(code=4001)
            return

        user_id, expires_at = row

        # Check token expiration
        if expires_at:
            exp = datetime.fromisoformat(expires_at)
            if datetime.now(timezone.utc) > exp:
                await websocket.close(code=4001)
                return

    except Exception:
        await websocket.close(code=4001)
        return

    # SEC-CRIT-02: Verify payment belongs to user
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT user_id FROM orders WHERE id = ?", (payment_id,))
        row = c.fetchone()
        conn.close()

        if not row or row[0] != user_id:
            # Payment doesn't exist or doesn't belong to user
            await websocket.close(code=4003)
            return
    except Exception:
        await websocket.close(code=4003)
        return

    # All checks passed - accept connection
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
        SELECT ci.id, ci.product_id, ci.quantity, p.name, p.price_cents, p.description, COALESCE(p.vat_rate, 19)
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.user_id = ?
    """,
        (user_id,),
    )
    rows = c.fetchall()
    conn.close()

    items = [
        {
            "id": r[0],
            "product_id": r[1],
            "quantity": r[2],
            "name": r[3],
            "price_cents": r[4],
            "description": r[5],
            "vat_rate": r[6],
        }
        for r in rows
    ]

    # Calculate VAT breakdown
    vat_breakdown = calculate_vat_breakdown(items)

    return {
        "items": items,
        "vat_breakdown": vat_breakdown,
    }


@app.post("/cart/items")
def add_to_cart(item: dict, user_id: int = Depends(verify_token)):
    product_id = item.get("product_id")
    quantity = item.get("quantity", 1)
    amount_cents = item.get("amount_cents", 0)

    if not product_id:
        raise ValidationError(
            "product_id required", field_errors=[{"field": "product_id", "message": "Required"}]
        )

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

    # Get cart items with VAT rate
    c.execute(
        """
        SELECT ci.product_id, ci.quantity, p.name, p.price_cents, COALESCE(p.vat_rate, 19)
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.user_id = ?
    """,
        (user_id,),
    )
    rows = c.fetchall()

    if not rows:
        conn.close()
        raise ValidationError(
            "Cart is empty", field_errors=[{"field": "cart", "message": "No items in cart"}]
        )

    # Build items with vat_rate
    items = [
        {
            "product_id": r[0],
            "quantity": r[1],
            "name": r[2],
            "price_cents": r[3],
            "vat_rate": r[4],
        }
        for r in rows
    ]

    # Calculate total and VAT breakdown
    total_cents = sum(item["price_cents"] * item["quantity"] for item in items)
    vat_breakdown = calculate_vat_breakdown(items)

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
        "items": items,
        "vat_breakdown": vat_breakdown,
    }


# Products API
@app.get("/products")
def get_products(user_id: int = Depends(verify_token)):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        "SELECT id, name, price_cents, description, image_url, category, active, COALESCE(vat_rate, 19) FROM products WHERE user_id=? ORDER BY category, name",
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
            "vat_rate": r[7],
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
    vat_rate = product.get("vat_rate", 19)  # Default 19% MwSt

    if not name or not price_cents:
        raise ValidationError(
            "name and price_cents required",
            field_errors=[
                {"field": "name", "message": "Required" if not name else None},
                {"field": "price_cents", "message": "Required" if not price_cents else None},
            ],
        )

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        "INSERT INTO products (user_id, name, price_cents, description, image_url, category, vat_rate) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (user_id, name, price_cents, description, image_url, category, vat_rate),
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
        "vat_rate": vat_rate,
    }


@app.put("/products/{product_id}")
def update_product(product_id: int, product: dict, user_id: int = Depends(verify_token)):
    name = product.get("name")
    price_cents = product.get("price_cents")
    description = product.get("description")
    category = product.get("category")
    image_url = product.get("image_url")
    active = product.get("active")
    vat_rate = product.get("vat_rate")  # MwSt Satz

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id FROM products WHERE id=? AND user_id=?", (product_id, user_id))
    if not c.fetchone():
        conn.close()
        raise NotFoundError("Product", str(product_id))

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
    if vat_rate is not None:
        updates.append("vat_rate=?")
        params.append(vat_rate)

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
# CATEGORIES - POS product organization
# ============================================


class CategoryCreate(BaseModel):
    name: str
    icon: Optional[str] = "📦"
    sort_order: Optional[int] = 0
    color: Optional[str] = "#f7931a"


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    sort_order: Optional[int] = None
    color: Optional[str] = None


@app.get("/categories")
def get_categories(user_id: int = Depends(verify_token)):
    """Get all categories for user"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        """
        SELECT id, name, icon, sort_order, color, created_at
        FROM categories WHERE user_id=? ORDER BY sort_order, name
        """,
        (user_id,),
    )
    rows = c.fetchall()
    conn.close()
    return [
        {
            "id": r[0],
            "name": r[1],
            "icon": r[2],
            "sort_order": r[3],
            "color": r[4],
            "created_at": r[5],
        }
        for r in rows
    ]


@app.post("/categories")
def create_category(category: CategoryCreate, user_id: int = Depends(verify_token)):
    """Create a new category"""
    if not category.name or len(category.name.strip()) == 0:
        raise ValidationError("Category name is required")

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    try:
        c.execute(
            """
            INSERT INTO categories (user_id, name, icon, sort_order, color)
            VALUES (?, ?, ?, ?, ?)
            """,
            (user_id, category.name.strip(), category.icon, category.sort_order, category.color),
        )
        category_id = c.lastrowid
        conn.commit()
        conn.close()
        return {
            "success": True,
            "id": category_id,
            "name": category.name,
            "icon": category.icon,
            "sort_order": category.sort_order,
            "color": category.color,
        }
    except sqlite3.IntegrityError:
        conn.close()
        raise ConflictError("Category", f"Category '{category.name}' already exists")


@app.put("/categories/{category_id}")
def update_category(
    category_id: int, category: CategoryUpdate, user_id: int = Depends(verify_token)
):
    """Update a category"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Check ownership
    c.execute("SELECT id FROM categories WHERE id=? AND user_id=?", (category_id, user_id))
    if not c.fetchone():
        conn.close()
        raise NotFoundError("Category", str(category_id))

    # Build update dynamically
    updates = []
    params = []
    if category.name is not None:
        updates.append("name=?")
        params.append(category.name.strip())
    if category.icon is not None:
        updates.append("icon=?")
        params.append(category.icon)
    if category.sort_order is not None:
        updates.append("sort_order=?")
        params.append(category.sort_order)
    if category.color is not None:
        updates.append("color=?")
        params.append(category.color)

    if updates:
        params.extend([category_id, user_id])
        c.execute(f"UPDATE categories SET {', '.join(updates)} WHERE id=? AND user_id=?", params)

    conn.commit()
    conn.close()
    return {"success": True, "id": category_id}


@app.delete("/categories/{category_id}")
def delete_category(category_id: int, user_id: int = Depends(verify_token)):
    """Delete a category (products will have NULL category_id)"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Set products in this category to NULL category_id (keep their category name)
    c.execute(
        "UPDATE products SET category_id=NULL WHERE category_id=? AND user_id=?",
        (category_id, user_id),
    )

    # Delete category
    c.execute("DELETE FROM categories WHERE id=? AND user_id=?", (category_id, user_id))
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
        raise NotFoundError("Basket", str(basket_id))

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
        raise NotFoundError("Basket", str(basket_id))

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
        raise NotFoundError("User", str(user_id))

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

DEFAULT_CASHU_MINT = settings.default_cashu_mint


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
        raise ValidationError(
            "Lightning invoice (bolt11) required",
            field_errors=[{"field": "invoice", "message": "Required"}],
        )
    if not token_str:
        raise ValidationError(
            "Cashu token required", field_errors=[{"field": "token", "message": "Required"}]
        )

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


# ============ CASHU TOKEN SPLIT ============
@app.post("/cashu/split")
def split_cashu_token(request: dict, user_id: int = Depends(verify_token)):
    """
    Split a Cashu token into two tokens.
    Used when customer pays with a token larger than the payment amount.

    NUT-08: Swap endpoint for token splitting
    """
    token = request.get("token", "")
    amount_requested = request.get("amount", 0)  # Amount to extract
    mint_url = request.get("mint_url", DEFAULT_CASHU_MINT)

    if not token:
        raise ValidationError(
            "Token required", field_errors=[{"field": "token", "message": "Required"}]
        )

    if amount_requested <= 0:
        raise ValidationError(
            "Amount must be positive",
            field_errors=[{"field": "amount", "message": "Must be > 0"}],
        )

    try:
        # Parse the token to get total amount
        import base64
        import json

        token_clean = token.strip()
        if token_clean.startswith("cashu1"):
            token_clean = token_clean[6:]

        # Decode base64
        try:
            padding = 4 - len(token_clean) % 4
            if padding != 4:
                token_clean += "=" * padding
            decoded_bytes = base64.b64decode(token_clean)
            token_data = json.loads(decoded_bytes)
        except Exception as e:
            raise ValidationError(
                "Invalid token format",
                field_errors=[{"field": "token", "message": str(e)}],
            )

        proofs = token_data.get("proofs", [])
        if not proofs:
            raise ValidationError("No proofs in token")

        total_amount = sum(p.get("amount", 0) for p in proofs)

        if total_amount < amount_requested:
            raise ValidationError(
                f"Token amount ({total_amount} sats) less than requested ({amount_requested} sats)",
                field_errors=[{"field": "amount", "message": "Insufficient token amount"}],
            )

        change_amount = total_amount - amount_requested

        # Call the mint's swap endpoint (NUT-08)
        # The mint will split the proofs and return new proofs for both amounts
        try:
            # NUT-08: POST /v1/swap
            swap_request = {"proofs": proofs, "amount": amount_requested}
            r = requests.post(
                f"{mint_url}/v1/swap",
                json=swap_request,
                timeout=30,
            )

            if r.status_code == 200:
                swap_response = r.json()
                payment_proofs = swap_response.get("signatures", [])

                # Generate change token from remaining proofs (if any)
                change_proofs = [p for p in proofs if p not in payment_proofs]
                change_token_str = None

                if change_amount > 0 and change_proofs:
                    # Create change token
                    change_token_data = {
                        "proofs": change_proofs,
                        "mint": mint_url,
                    }
                    change_json = json.dumps(change_token_data)
                    change_b64 = base64.b64encode(change_json.encode()).decode().rstrip("=")
                    change_token_str = f"cashu1{change_b64}"

                # Generate payment token
                payment_token_data = {
                    "proofs": payment_proofs,
                    "mint": mint_url,
                }
                payment_json = json.dumps(payment_token_data)
                payment_b64 = base64.b64encode(payment_json.encode()).decode().rstrip("=")
                payment_token_str = f"cashu1{payment_b64}"

                # Record in history
                _record_cashu_history(
                    user_id=user_id,
                    action="split",
                    amount=amount_requested,
                    mint_url=mint_url,
                    token_preview=token[:50],
                    description=f"Split: {amount_requested} sats payment, {change_amount} sats change",
                )

                return {
                    "success": True,
                    "payment_token": payment_token_str,
                    "change_token": change_token_str,
                    "payment_amount": amount_requested,
                    "change_amount": change_amount,
                    "total_amount": total_amount,
                }
        except requests.RequestException as e:
            # Mint nicht erreichbar - return mock split for testing
            pass

        # Fallback: Mock split response (for testing without mint)
        mock_payment_token = f"cashu1{payment_amount_mock(total_amount)}"
        mock_change_token = (
            f"cashu1{payment_amount_mock(change_amount)}" if change_amount > 0 else None
        )

        return {
            "success": True,
            "payment_token": mock_payment_token,
            "change_token": mock_change_token,
            "payment_amount": amount_requested,
            "change_amount": change_amount,
            "total_amount": total_amount,
            "mock": True,
            "message": "Mock split - mint not reachable",
        }

    except AppError:
        raise
    except Exception as e:
        raise ExternalServiceError("Cashu", str(e))


@app.post("/cashu/split-check")
def check_split_needed(request: dict, user_id: int = Depends(verify_token)):
    """
    Check if a token needs to be split before payment.
    Returns split info if token amount > payment amount.
    """
    token = request.get("token", "")
    payment_amount = request.get("payment_amount", 0)  # Amount needed for payment
    mint_url = request.get("mint_url", DEFAULT_CASHU_MINT)

    if not token:
        raise ValidationError(
            "Token required", field_errors=[{"field": "token", "message": "Required"}]
        )

    try:
        import base64
        import json

        token_clean = token.strip()
        if token_clean.startswith("cashu1"):
            token_clean = token_clean[6:]

        try:
            padding = 4 - len(token_clean) % 4
            if padding != 4:
                token_clean += "=" * padding
            decoded_bytes = base64.b64decode(token_clean)
            token_data = json.loads(decoded_bytes)
        except Exception:
            raise ValidationError("Invalid token format")

        proofs = token_data.get("proofs", [])
        total_amount = sum(p.get("amount", 0) for p in proofs)

        needs_split = total_amount > payment_amount and payment_amount > 0
        change_amount = total_amount - payment_amount if needs_split else 0

        return {
            "needs_split": needs_split,
            "token_amount": total_amount,
            "payment_amount": payment_amount,
            "change_amount": change_amount,
        }

    except AppError:
        raise
    except Exception as e:
        raise ExternalServiceError("Cashu", str(e))


# ============ CASHU TOKEN REFRESH ============
@app.post("/cashu/refresh")
def refresh_cashu_tokens(request: dict, user_id: int = Depends(verify_token)):
    """
    Refresh Cashu tokens - exchange old proofs for new ones with fresh keys.
    Used when a mint rotates keys and old tokens become invalid.

    NUT-09: Refresh endpoint
    """
    tokens = request.get("tokens", [])  # List of tokens to refresh
    mint_url = request.get("mint_url", DEFAULT_CASHU_MINT)

    if not tokens or len(tokens) == 0:
        raise ValidationError(
            "Tokens required",
            field_errors=[{"field": "tokens", "message": "At least one token required"}],
        )

    try:
        # Collect all proofs from all tokens
        all_proofs = []
        for token_str in tokens:
            token_clean = token_str.strip()
            if token_clean.startswith("cashu1"):
                token_clean = token_clean[6:]

            try:
                import base64
                import json

                padding = 4 - len(token_clean) % 4
                if padding != 4:
                    token_clean += "=" * padding
                decoded = base64.b64decode(token_clean)
                token_data = json.loads(decoded)
                proofs = token_data.get("proofs", [])
                all_proofs.extend(proofs)
            except:
                continue

        if not all_proofs:
            raise ValidationError("No valid proofs found in tokens")

        total_amount = sum(p.get("amount", 0) for p in all_proofs)

        # Call mint refresh endpoint (NUT-09)
        try:
            # NUT-09: POST /v1/refresh
            refresh_request = {"proofs": all_proofs}
            r = requests.post(
                f"{mint_url}/v1/refresh",
                json=refresh_request,
                timeout=30,
            )

            if r.status_code == 200:
                refresh_response = r.json()
                new_proofs = refresh_response.get("signatures", [])

                # Create new token from refreshed proofs
                new_token_data = {
                    "proofs": new_proofs,
                    "mint": mint_url,
                }
                new_token_json = json.dumps(new_token_data)
                new_token_b64 = base64.b64encode(new_token_json.encode()).decode().rstrip("=")
                new_token = f"cashu1{new_token_b64}"

                # Record in history
                _record_cashu_history(
                    user_id=user_id,
                    action="refresh",
                    amount=total_amount,
                    mint_url=mint_url,
                    token_preview=tokens[0][:50] if tokens else "",
                    description=f"Refreshed {len(all_proofs)} proofs ({total_amount} sats)",
                )

                return {
                    "success": True,
                    "new_token": new_token,
                    "new_proofs_count": len(new_proofs),
                    "total_amount": total_amount,
                    "refreshed_proofs": len(all_proofs),
                }
        except requests.RequestException:
            pass

        # Fallback: Return error if mint not reachable
        raise ExternalServiceError(
            "Cashu",
            f"Mint at {mint_url} not reachable for refresh",
        )

    except AppError:
        raise
    except Exception as e:
        raise ExternalServiceError("Cashu", str(e))


@app.get("/cashu/mint-keys")
def get_mint_keys(mint_url: str = None):
    """
    Get the public keys from a mint.
    Used to check if a mint has rotated keys (keyset_id changed).
    """
    mint = mint_url or DEFAULT_CASHU_MINT

    try:
        r = requests.get(f"{mint}/v1/keys", timeout=15)
        if r.status_code == 200:
            keys = r.json()
            return {
                "mint": mint,
                "keys": keys,
                "keyset_id": list(keys.values())[0] if keys else None,
            }
    except Exception as e:
        return {"mint": mint, "error": str(e), "reachable": False}


@app.get("/cashu/mint-keysets")
def get_mint_keysets(mint_url: str = None):
    """
    Get available keysets from a mint.
    NUT-10: Keyset IDs for identifying key rotations.
    """
    mint = mint_url or DEFAULT_CASHU_MINT

    try:
        r = requests.get(f"{mint}/v1/keysets", timeout=15)
        if r.status_code == 200:
            keysets = r.json()
            return {
                "mint": mint,
                "keysets": keysets,
                "active_keyset": keysets[0].get("id") if keysets else None,
            }
    except Exception as e:
        return {"mint": mint, "error": str(e), "reachable": False}


# ============ CASHU HISTORY ============
@app.get("/cashu/history")
def get_cashu_history(
    user_id: int = Depends(verify_token),
    limit: int = 50,
    offset: int = 0,
):
    """Get user's Cashu token history"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        """
        SELECT id, action, amount, mint_url, token_preview, description, created_at
        FROM cashu_history
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
        """,
        (user_id, limit, offset),
    )
    rows = c.fetchall()
    conn.close()

    history = [
        {
            "id": row[0],
            "action": row[1],
            "amount": row[2],
            "mint_url": row[3],
            "token_preview": row[4],
            "description": row[5],
            "created_at": row[6],
        }
        for row in rows
    ]

    return {"history": history, "limit": limit, "offset": offset}


# ============ MINT MANAGEMENT ============
@app.get("/cashu/user-mints")
def get_user_mints(user_id: int = Depends(verify_token)):
    """Get all mints configured by the user"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        """
        SELECT id, mint_url, name, is_active, is_preferred, last_used
        FROM user_mints
        WHERE user_id = ?
        ORDER BY is_preferred DESC, last_used DESC
        """,
        (user_id,),
    )
    rows = c.fetchall()
    conn.close()

    mints_list = []
    for row in rows:
        mint_url = row[1]
        # Try to get mint balance
        balance = 0
        try:
            c2 = sqlite3.connect(DB_PATH)
            c2.execute(
                "SELECT SUM(amount) FROM cashu_tokens WHERE user_id = ? AND mint_url = ? AND status = 'active'",
                (user_id, mint_url),
            )
            bal = c2.fetchone()[0]
            balance = bal if bal else 0
            c2.close()
        except:
            pass

        mints_list.append(
            {
                "id": row[0],
                "url": mint_url,
                "name": row[2] or mint_url,
                "is_active": bool(row[3]),
                "is_preferred": bool(row[4]),
                "last_used": row[5],
                "balance": balance,
            }
        )

    return {"mints": mints_list}


@app.post("/cashu/user-mints")
def add_user_mint(request: dict, user_id: int = Depends(verify_token)):
    """Add a new mint to user's configuration"""
    mint_url = request.get("url", "")
    name = request.get("name", "")

    if not mint_url:
        raise ValidationError(
            "Mint URL required", field_errors=[{"field": "url", "message": "Required"}]
        )

    # Validate mint URL
    if not mint_url.startswith(("http://", "https://")):
        raise ValidationError(
            "Invalid mint URL",
            field_errors=[{"field": "url", "message": "Must start with http:// or https://"}],
        )

    # Verify mint is reachable
    try:
        r = requests.get(f"{mint_url}/v1/info", timeout=10)
        if r.status_code != 200:
            raise ValidationError(
                "Mint not reachable",
                field_errors=[{"field": "url", "message": "Mint did not respond correctly"}],
            )
    except requests.RequestException:
        raise ValidationError(
            "Mint not reachable",
            field_errors=[{"field": "url", "message": "Could not connect to mint"}],
        )

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    try:
        c.execute(
            """
            INSERT INTO user_mints (user_id, mint_url, name, is_active, is_preferred)
            VALUES (?, ?, ?, 1, 0)
            """,
            (user_id, mint_url, name),
        )
        mint_id = c.lastrowid
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise ConflictError(
            "Mint already added", field_errors=[{"field": "url", "message": "Already in your list"}]
        )
    finally:
        conn.close()

    return {"success": True, "id": mint_id, "url": mint_url}


@app.delete("/cashu/user-mints/{mint_id}")
def delete_user_mint(mint_id: int, user_id: int = Depends(verify_token)):
    """Remove a mint from user's configuration"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM user_mints WHERE id = ? AND user_id = ?", (mint_id, user_id))
    deleted = c.rowcount > 0
    conn.commit()
    conn.close()

    if not deleted:
        raise NotFoundError("Mint", mint_id)

    return {"success": True}


@app.put("/cashu/user-mints/{mint_id}/activate")
def activate_mint(mint_id: int, active: bool = True, user_id: int = Depends(verify_token)):
    """Activate or deactivate a mint"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        "UPDATE user_mints SET is_active = ? WHERE id = ? AND user_id = ?",
        (1 if active else 0, mint_id, user_id),
    )
    updated = c.rowcount > 0
    conn.commit()
    conn.close()

    if not updated:
        raise NotFoundError("Mint", mint_id)

    return {"success": True}


@app.put("/cashu/user-mints/{mint_id}/prefer")
def prefer_mint(mint_id: int, user_id: int = Depends(verify_token)):
    """Set a mint as the preferred mint for the user"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # First, remove preferred from all other mints
    c.execute("UPDATE user_mints SET is_preferred = 0 WHERE user_id = ?", (user_id,))
    # Then set this one as preferred
    c.execute(
        "UPDATE user_mints SET is_preferred = 1 WHERE id = ? AND user_id = ?",
        (mint_id, user_id),
    )
    updated = c.rowcount > 0
    conn.commit()
    conn.close()

    if not updated:
        raise NotFoundError("Mint", mint_id)

    return {"success": True}


# Helper function for recording history
def _record_cashu_history(
    user_id: int,
    action: str,
    amount: int,
    mint_url: str = None,
    token_preview: str = None,
    description: str = None,
    related_token_id: int = None,
):
    """Record a Cashu operation in history"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        """
        INSERT INTO cashu_history (user_id, action, amount, mint_url, token_preview, description, related_token_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (user_id, action, amount, mint_url, token_preview, description, related_token_id),
    )
    conn.commit()
    conn.close()


def payment_amount_mock(amount: int) -> str:
    """Generate a mock Cashu token for given amount (testing only)"""
    import base64
    import json

    # Create a minimal mock proof
    mock_proof = {
        "amount": amount,
        "secret": secrets.token_hex(32),
        "C": "02" + secrets.token_hex(64),  # Mock Pedersen commitment
    }

    token_data = {
        "proofs": [mock_proof],
        "mint": DEFAULT_CASHU_MINT,
    }

    token_json = json.dumps(token_data)
    return base64.b64encode(token_json.encode()).decode().rstrip("=")


# Merchant Payment Request (Quick Payment)
# SEC-HIGH-04: Added user verification before creating order
@app.post("/merchant/payment-request")
def create_merchant_payment_request(request: dict, user_id: int = Depends(verify_token)):
    """Create a payment request for quick merchant payments"""
    amount_cents = request.get("amount_cents")
    method = request.get("method", "lightning")  # Default zu Lightning

    if not amount_cents:
        raise ValidationError(
            "amount_cents required", field_errors=[{"field": "amount_cents", "message": "Required"}]
        )

    # SEC-HIGH-04: Verify user exists before creating order
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id FROM users WHERE id = ?", (user_id,))
    user_row = c.fetchone()
    if not user_row:
        conn.close()
        raise NotFoundError("User", str(user_id))
    conn.close()

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
            raise ExternalServiceError("LND", lnd_result["error"])

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
        raise NotFoundError("Payment", str(order_id))

    return {
        "quote_id": quote_id,
        "order_id": row[0],
        "amount_cents": row[1],
        "status": row[2],
        "paid": row[2] in ["paid", "completed"],
    }
