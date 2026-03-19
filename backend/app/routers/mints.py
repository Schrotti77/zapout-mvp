"""
Mint Management for ZapOut
Multi-mint support like Numo
"""

import os
import sqlite3
from datetime import datetime, timezone
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

# DB_PATH - use absolute path to avoid circular import
# Go up 3 levels: app/routers/mints.py -> app/routers -> app -> backend -> project
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(BACKEND_DIR, "zapout.db")

router = APIRouter(prefix="/cashu", tags=["cashu"])


# =============================================================================
# Token verification (inlined to avoid circular import)
# =============================================================================
def verify_token_inline(authorization: str = Header(None)) -> int:
    """Verify token from Authorization header"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")

    token = authorization.replace("Bearer ", "")

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT user_id, expires_at FROM tokens WHERE token = ?", (token,))
    row = c.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id, expires_at = row

    if expires_at:
        exp = datetime.fromisoformat(expires_at)
        if datetime.now(timezone.utc) > exp:
            raise HTTPException(status_code=401, detail="Token expired")

    return user_id


# =============================================================================
# Database Models
# =============================================================================
def init_mint_tables():
    """Initialize mint-related database tables"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # User's connected mints
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS user_mints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            mint_url TEXT NOT NULL,
            mint_name TEXT,
            is_preferred INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            last_checked TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(user_id, mint_url)
        )
    """
    )

    # User cashu settings
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS user_cashu_settings (
            user_id INTEGER PRIMARY KEY,
            accept_unknown_mints INTEGER DEFAULT 1,
            auto_swap_to_lightning INTEGER DEFAULT 1,
            swap_fee_reserve_max REAL DEFAULT 0.05,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """
    )

    conn.commit()
    conn.close()


# Initialize tables on module load
init_mint_tables()


# =============================================================================
# Pydantic Models
# =============================================================================
class MintInfo(BaseModel):
    id: Optional[int] = None
    mint_url: str
    mint_name: Optional[str] = None
    is_preferred: bool = False
    is_active: bool = True
    balance_sats: int = 0
    last_checked: Optional[str] = None


class MintAddRequest(BaseModel):
    mint_url: str
    mint_name: Optional[str] = None


class MintUpdateRequest(BaseModel):
    mint_name: Optional[str] = None
    is_preferred: Optional[bool] = None
    is_active: Optional[bool] = None


class CashuSettings(BaseModel):
    accept_unknown_mints: bool = True
    auto_swap_to_lightning: bool = True
    swap_fee_reserve_max: float = 0.05


# =============================================================================
# Mint Management Endpoints
# =============================================================================
@router.get("/mints", response_model=List[MintInfo])
async def list_mints(user_id: int = Depends(verify_token_inline)):
    """
    List all mints connected to user's account
    Like Numo's mint settings UI
    """
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        """
        SELECT id, mint_url, mint_name, is_preferred, is_active, last_checked
        FROM user_mints
        WHERE user_id = ?
        ORDER BY is_preferred DESC, mint_name ASC, mint_url ASC
    """,
        (user_id,),
    )
    rows = c.fetchall()
    conn.close()

    mints = []
    for row in rows:
        mint_url = row[1]
        balance = await check_mint_balance(mint_url)

        mints.append(
            MintInfo(
                id=row[0],
                mint_url=mint_url,
                mint_name=row[2],
                is_preferred=bool(row[3]),
                is_active=bool(row[4]),
                balance_sats=balance,
                last_checked=row[5],
            )
        )

    return mints


@router.post("/mints", response_model=MintInfo)
async def add_mint(request: MintAddRequest, user_id: int = Depends(verify_token_inline)):
    """
    Add a new mint to user's account
    Like Numo's "+ Mint hinzufügen"
    """
    mint_url = request.mint_url.strip().rstrip("/")

    # Validate mint URL
    if not mint_url.startswith(("http://", "https://")):
        raise HTTPException(400, "Invalid mint URL - must start with http:// or https://")

    # Check if mint is reachable
    mint_working = await verify_mint_connection(mint_url)
    if not mint_working:
        raise HTTPException(400, f"Mint not reachable: {mint_url}")

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Check if already exists
    c.execute("SELECT id FROM user_mints WHERE user_id=? AND mint_url=?", (user_id, mint_url))
    if c.fetchone():
        conn.close()
        raise HTTPException(400, "Mint already added")

    # Get mint name if not provided
    mint_name = request.mint_name or mint_url.split("//")[1].split("/")[0]

    # Insert new mint
    c.execute(
        """
        INSERT INTO user_mints (user_id, mint_url, mint_name, is_preferred, is_active, last_checked)
        VALUES (?, ?, ?, 0, 1, ?)
    """,
        (user_id, mint_url, mint_name, datetime.utcnow().isoformat()),
    )

    mint_id = c.lastrowid
    conn.commit()
    conn.close()

    return MintInfo(
        id=mint_id,
        mint_url=mint_url,
        mint_name=mint_name,
        is_preferred=False,
        is_active=True,
        balance_sats=0,
    )


@router.put("/mints/{mint_id}", response_model=MintInfo)
async def update_mint(
    mint_id: int, request: MintUpdateRequest, user_id: int = Depends(verify_token_inline)
):
    """
    Update mint settings
    - Set preferred mint
    - Enable/disable mint
    - Update name
    """
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Verify ownership
    c.execute(
        "SELECT mint_url, mint_name FROM user_mints WHERE id=? AND user_id=?", (mint_id, user_id)
    )
    row = c.fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Mint not found")

    mint_url = row[0]
    mint_name = row[1]

    # Update fields
    updates = []
    params = []

    if request.mint_name is not None:
        updates.append("mint_name=?")
        params.append(request.mint_name)
        mint_name = request.mint_name

    if request.is_preferred is not None:
        updates.append("is_preferred=?")
        params.append(1 if request.is_preferred else 0)

        # If setting as preferred, unset other preferred mints
        if request.is_preferred:
            c.execute(
                """
                UPDATE user_mints SET is_preferred=0
                WHERE user_id=? AND id!=?
            """,
                (user_id, mint_id),
            )

    if request.is_active is not None:
        updates.append("is_active=?")
        params.append(1 if request.is_active else 0)

    if updates:
        updates.append("last_checked=?")
        params.append(datetime.utcnow().isoformat())

        params.extend([mint_id, user_id])
        c.execute(f"UPDATE user_mints SET {', '.join(updates)} WHERE id=? AND user_id=?", params)

    conn.commit()

    # Get updated balance
    balance = await check_mint_balance(mint_url)

    # Fetch final state
    c.execute(
        """
        SELECT id, mint_url, mint_name, is_preferred, is_active, last_checked
        FROM user_mints WHERE id=?
    """,
        (mint_id,),
    )
    row = c.fetchone()
    conn.close()

    return MintInfo(
        id=row[0],
        mint_url=row[1],
        mint_name=row[2],
        is_preferred=bool(row[3]),
        is_active=bool(row[4]),
        balance_sats=balance,
        last_checked=row[5],
    )


@router.delete("/mints/{mint_id}")
async def remove_mint(mint_id: int, user_id: int = Depends(verify_token_inline)):
    """Remove a mint from user's account"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Verify ownership and delete
    c.execute("DELETE FROM user_mints WHERE id=? AND user_id=?", (mint_id, user_id))
    if c.rowcount == 0:
        conn.close()
        raise HTTPException(404, "Mint not found")

    conn.commit()
    conn.close()

    return {"success": True, "message": "Mint removed"}


@router.post("/mints/{mint_id}/refresh-balance")
async def refresh_mint_balance(mint_id: int, user_id: int = Depends(verify_token_inline)):
    """Refresh balance for a specific mint"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.execute("SELECT mint_url FROM user_mints WHERE id=? AND user_id=?", (mint_id, user_id))
    row = c.fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Mint not found")

    mint_url = row[0]
    balance = await check_mint_balance(mint_url)

    c.execute(
        "UPDATE user_mints SET last_checked=? WHERE id=?", (datetime.utcnow().isoformat(), mint_id)
    )
    conn.commit()
    conn.close()

    return {"mint_id": mint_id, "balance_sats": balance}


@router.get("/balance/all")
async def get_total_balance(user_id: int = Depends(verify_token_inline)):
    """
    Get total Cashu balance across all mints
    Like Numo's total balance display
    """
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.execute("SELECT mint_url FROM user_mints WHERE user_id=? AND is_active=1", (user_id,))
    mints = c.fetchall()
    conn.close()

    total_balance = 0
    mint_balances = []

    for mint_row in mints:
        mint_url = mint_row[0]
        balance = await check_mint_balance(mint_url)
        total_balance += balance
        mint_balances.append({"mint_url": mint_url, "balance_sats": balance})

    return {
        "total_balance_sats": total_balance,
        "total_balance_eur": total_balance * 0.00004,  # Approximate
        "mints": mint_balances,
    }


# =============================================================================
# Cashu Settings Endpoints
# =============================================================================
@router.get("/settings", response_model=CashuSettings)
async def get_cashu_settings(user_id: int = Depends(verify_token_inline)):
    """Get user's Cashu settings"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.execute(
        """
        SELECT accept_unknown_mints, auto_swap_to_lightning, swap_fee_reserve_max
        FROM user_cashu_settings WHERE user_id=?
    """,
        (user_id,),
    )
    row = c.fetchone()

    if not row:
        conn.close()
        return CashuSettings()

    conn.close()
    return CashuSettings(
        accept_unknown_mints=bool(row[0]),
        auto_swap_to_lightning=bool(row[1]),
        swap_fee_reserve_max=row[2],
    )


@router.put("/settings", response_model=CashuSettings)
async def update_cashu_settings(
    settings: CashuSettings, user_id: int = Depends(verify_token_inline)
):
    """Update user's Cashu settings"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.execute(
        """
        INSERT INTO user_cashu_settings
            (user_id, accept_unknown_mints, auto_swap_to_lightning, swap_fee_reserve_max, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            accept_unknown_mints = excluded.accept_unknown_mints,
            auto_swap_to_lightning = excluded.auto_swap_to_lightning,
            swap_fee_reserve_max = excluded.swap_fee_reserve_max,
            updated_at = excluded.updated_at
    """,
        (
            user_id,
            1 if settings.accept_unknown_mints else 0,
            1 if settings.auto_swap_to_lightning else 0,
            settings.swap_fee_reserve_max,
            datetime.utcnow().isoformat(),
        ),
    )

    conn.commit()
    conn.close()

    return settings


# =============================================================================
# Helper Functions
# =============================================================================
async def verify_mint_connection(mint_url: str) -> bool:
    """Check if a mint is reachable and responding"""
    try:
        async with httpx.AsyncClient() as client:
            # Try NUT-09 /v1/mint endpoint
            response = await client.get(f"{mint_url}/v1/mint", timeout=10)
            if response.status_code == 200:
                return True

            # Try older /info endpoint
            response = await client.get(f"{mint_url}/info", timeout=10)
            if response.status_code == 200:
                return True

            return False
    except Exception:
        return False


async def check_mint_balance(mint_url: str) -> int:
    """
    Check balance on a mint for a user
    Note: This requires the user's proofs from their wallet
    In a full implementation, we'd fetch proofs from local storage
    """
    # For now, return 0
    # In production: load proofs from user_cashu_tokens table
    # and call /v1/check to verify which are unspent
    return 0


async def get_preferred_mint(user_id: int) -> Optional[str]:
    """Get user's preferred mint URL"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        """
        SELECT mint_url FROM user_mints
        WHERE user_id=? AND is_preferred=1 AND is_active=1
        LIMIT 1
    """,
        (user_id,),
    )
    row = c.fetchone()
    conn.close()

    return row[0] if row else None
