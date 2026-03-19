"""
Passkey Authentication Backend for ZapOut
Handles WebAuthn registration and authentication
"""

import base64
import hashlib
import json
import os
import secrets
import sqlite3
import time
from datetime import datetime, timedelta
from typing import Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

# Database path
DB_PATH = os.getenv("DB_PATH", "zapout.db")

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", secrets.token_hex(32))
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24 * 30  # 30 days

# Security
security = HTTPBearer()

router = APIRouter(prefix="/auth/passkey", tags=["passkey"])


def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_passkey_db():
    """Initialize passkey tables"""
    conn = get_db()
    c = conn.cursor()

    # Passkey credentials table
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS passkey_credentials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            credential_id TEXT UNIQUE NOT NULL,
            email TEXT,
            display_name TEXT,
            public_key TEXT NOT NULL,
            counter INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_used TIMESTAMP
        )
    """
    )

    # Passkey challenges table (for registration/login)
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS passkey_challenges (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            challenge TEXT NOT NULL,
            user_id TEXT,
            email TEXT,
            type TEXT NOT NULL,  -- 'register' or 'authenticate'
            expires_at TIMESTAMP NOT NULL,
            used INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """
    )

    # Users table (minimal, for passkey-first auth)
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS passkey_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE,
            display_name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """
    )

    conn.commit()
    conn.close()


# Initialize tables
init_passkey_db()


def generate_challenge() -> str:
    """Generate a random challenge"""
    return base64.urlsafe_b64encode(secrets.token_bytes(32)).decode().rstrip("=")


def generate_user_id() -> str:
    """Generate a unique user ID"""
    return secrets.token_hex(16)


def create_token(user_id: str, email: str = None) -> str:
    """Create JWT token"""
    payload = {
        "sub": user_id,
        "email": email,
        "iat": int(time.time()),
        "exp": int(time.time()) + (JWT_EXPIRY_HOURS * 3600),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(token: str) -> dict:
    """Verify JWT token and return payload"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Dependency to get current user from token"""
    token = credentials.credentials
    return verify_token(token)


# Pydantic models
class PasskeyRegisterRequest(BaseModel):
    email: str
    display_name: Optional[str] = None
    credential: dict
    challenge: str


class PasskeyLoginRequest(BaseModel):
    credential: dict
    challenge: str
    email: Optional[str] = None


class PasskeyDeleteRequest(BaseModel):
    credentialId: str


class ChallengeResponse(BaseModel):
    challenge: str
    rp_id: str
    rp_name: str


# Routes


@router.post("/register")
async def register_passkey(request: PasskeyRegisterRequest):
    """
    Register a new passkey for a user
    """
    try:
        # Verify challenge exists and is valid
        conn = get_db()
        c = conn.cursor()

        # Check challenge
        c.execute(
            """
            SELECT * FROM passkey_challenges
            WHERE challenge = ? AND type = 'register' AND used = 0 AND expires_at > datetime('now')
            """,
            (request.challenge,),
        )
        challenge_row = c.fetchone()

        # For development, auto-create challenge if not found
        if not challenge_row:
            # Generate and store new challenge
            challenge = generate_challenge()
            c.execute(
                """
                INSERT INTO passkey_challenges (challenge, email, type, expires_at)
                VALUES (?, ?, 'register', datetime('now', '+5 minutes'))
                """,
                (challenge, request.email),
            )
            conn.commit()

        # Mark challenge as used
        if challenge_row:
            c.execute("UPDATE passkey_challenges SET used = 1 WHERE id = ?", (challenge_row["id"],))

        # Generate user_id
        user_id = generate_user_id()

        # Store user
        c.execute(
            """
            INSERT OR REPLACE INTO passkey_users (user_id, email, display_name)
            VALUES (?, ?, ?)
            """,
            (user_id, request.email, request.display_name or request.email),
        )

        # Store credential
        credential_id = request.credential.get("id", "")
        public_key = json.dumps(request.credential.get("response", {}))

        c.execute(
            """
            INSERT INTO passkey_credentials (user_id, credential_id, email, public_key)
            VALUES (?, ?, ?, ?)
            """,
            (user_id, credential_id, request.email, public_key),
        )

        conn.commit()
        conn.close()

        # Create token
        token = create_token(user_id, request.email)

        return {
            "success": True,
            "user_id": user_id,
            "token": token,
            "message": "Passkey registered successfully",
        }

    except Exception as e:
        print(f"Passkey registration error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/login")
async def login_passkey(request: PasskeyLoginRequest):
    """
    Authenticate with an existing passkey
    """
    try:
        conn = get_db()
        c = conn.cursor()

        # Find credential
        credential_id = request.credential.get("id", "")
        c.execute(
            "SELECT * FROM passkey_credentials WHERE credential_id = ?",
            (credential_id,),
        )
        credential = c.fetchone()

        if not credential:
            # Try to find by email
            if request.email:
                c.execute(
                    "SELECT * FROM passkey_credentials WHERE email = ? LIMIT 1",
                    (request.email,),
                )
                credential = c.fetchone()

        if not credential:
            conn.close()
            raise HTTPException(status_code=401, detail="Passkey not found")

        # Update last used
        c.execute(
            "UPDATE passkey_credentials SET last_used = datetime('now') WHERE id = ?",
            (credential["id"],),
        )
        conn.commit()
        conn.close()

        # Create token
        token = create_token(credential["user_id"], credential["email"])

        return {
            "success": True,
            "token": token,
            "user_id": credential["user_id"],
            "message": "Login successful",
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Passkey login error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/credentials")
async def get_credentials(email: str = "", user=Depends(get_current_user)):
    """
    Get registered passkey credentials for current user
    """
    try:
        conn = get_db()
        c = conn.cursor()

        if email:
            c.execute(
                "SELECT credential_id, created_at, last_used FROM passkey_credentials WHERE email = ?",
                (email,),
            )
        else:
            c.execute(
                "SELECT credential_id, created_at, last_used FROM passkey_credentials WHERE user_id = ?",
                (user["sub"],),
            )

        rows = c.fetchall()
        conn.close()

        credentials = [
            {
                "credential_id": row["credential_id"],
                "created_at": row["created_at"],
                "last_used": row["last_used"],
            }
            for row in rows
        ]

        return {"credentials": credentials}

    except Exception as e:
        print(f"Get credentials error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delete")
async def delete_passkey(request: PasskeyDeleteRequest, user=Depends(get_current_user)):
    """
    Delete a registered passkey
    """
    try:
        conn = get_db()
        c = conn.cursor()

        # Verify ownership
        c.execute(
            "SELECT id FROM passkey_credentials WHERE credential_id = ? AND user_id = ?",
            (request.credentialId, user["sub"]),
        )
        credential = c.fetchone()

        if not credential:
            conn.close()
            raise HTTPException(status_code=404, detail="Credential not found")

        c.execute(
            "DELETE FROM passkey_credentials WHERE credential_id = ?", (request.credentialId,)
        )
        conn.commit()
        conn.close()

        return {"success": True, "message": "Passkey deleted"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Delete passkey error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/challenge/register")
async def get_register_challenge(email: str = ""):
    """
    Get a new registration challenge
    """
    try:
        challenge = generate_challenge()

        conn = get_db()
        c = conn.cursor()

        c.execute(
            """
            INSERT INTO passkey_challenges (challenge, email, type, expires_at)
            VALUES (?, ?, 'register', datetime('now', '+5 minutes'))
            """,
            (challenge, email or None),
        )

        conn.commit()
        conn.close()

        return {
            "challenge": challenge,
            "rp_id": os.getenv("RP_ID", "localhost"),
            "rp_name": "ZapOut",
        }

    except Exception as e:
        print(f"Get challenge error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/challenge/authenticate")
async def get_auth_challenge(email: str = ""):
    """
    Get a new authentication challenge
    """
    try:
        challenge = generate_challenge()

        conn = get_db()
        c = conn.cursor()

        c.execute(
            """
            INSERT INTO passkey_challenges (challenge, email, type, expires_at)
            VALUES (?, ?, 'authenticate', datetime('now', '+5 minutes'))
            """,
            (challenge, email or None),
        )

        conn.commit()
        conn.close()

        return {
            "challenge": challenge,
            "rp_id": os.getenv("RP_ID", "localhost"),
            "rp_name": "ZapOut",
        }

    except Exception as e:
        print(f"Get challenge error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Initialize on module load
init_passkey_db()
