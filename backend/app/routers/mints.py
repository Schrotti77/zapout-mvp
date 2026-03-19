"""
Mint Management for ZapOut
Multi-mint support like Numo
"""

import logging
import os
import sqlite3
from datetime import datetime, timezone
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

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


# =============================================================================
# Swap to Lightning (Numo's Killer Feature)
# =============================================================================
import base64
import json
import re


class SwapRequest(BaseModel):
    token: str


class SwapResponse(BaseModel):
    success: bool
    amount_sats: int
    payment_hash: Optional[str] = None
    bolt11: Optional[str] = None
    mint_url: Optional[str] = None
    message: Optional[str] = None


def decode_cashu_token(token: str) -> dict:
    """
    Decode a Cashu token to extract mint URL and amount.
    Supports both cashuA... and cashuB... formats.
    """
    try:
        # Remove cashuA/cashuB prefix if present (cashuA is 6 chars)
        if token.startswith("cashuA"):
            encoded = token[6:]
        elif token.startswith("cashuB"):
            encoded = token[6:]
        elif token.startswith("cashu"):
            # Try to find the actual encoded part
            match = re.search(r"cashu[AB]?(.*)$", token)
            if match:
                encoded = match.group(1)
            else:
                encoded = token[5:]
        else:
            encoded = token

        # Add proper padding if needed
        padding_needed = (4 - len(encoded) % 4) % 4
        encoded_padded = encoded + "=" * padding_needed

        # Try to decode as base64
        try:
            decoded = base64.urlsafe_b64decode(encoded_padded)
            data = json.loads(decoded)
        except Exception as e:
            return {"mint_url": None, "amount_sats": 0, "error": str(e)}

        # Extract mint URL from proofs or token structure
        mint_url = None
        amount_sats = 0

        # Cashu token structure varies, try to extract
        if isinstance(data, dict):
            # Look for mint URL in various places
            mint_url = data.get("mint") or data.get("mintUrl") or data.get("mint_url")

            # Sum up amounts from proofs
            proofs = data.get("proofs", [])
            if proofs:
                amount_sats = sum(p.get("amount", 0) for p in proofs)
            elif "amount" in data:
                amount_sats = data["amount"]

        elif isinstance(data, list):
            # List of proofs
            amount_sats = sum(p.get("amount", 0) for p in data)

        return {"mint_url": mint_url, "amount_sats": amount_sats, "raw": data}
    except Exception as e:
        logger.error(f"Failed to decode token: {e}")
        return {"mint_url": None, "amount_sats": 0, "raw": None, "error": str(e)}


async def is_trusted_mint(user_id: int, mint_url: str) -> bool:
    """Check if mint is in user's trusted mints"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        """
        SELECT 1 FROM user_mints
        WHERE user_id=? AND mint_url=? AND is_active=1
        LIMIT 1
    """,
        (user_id, mint_url),
    )
    row = c.fetchone()
    conn.close()
    return row is not None


async def get_swap_settings(user_id: int) -> dict:
    """Get swap settings for user"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        """
        SELECT accept_unknown_mints, auto_swap_to_lightning, swap_fee_reserve_max
        FROM cashu_settings WHERE user_id=?
    """,
        (user_id,),
    )
    row = c.fetchone()
    conn.close()

    if row:
        return {
            "accept_unknown_mints": bool(row[0]),
            "auto_swap_to_lightning": bool(row[1]),
            "swap_fee_reserve_max": row[2],
        }
    return {
        "accept_unknown_mints": True,
        "auto_swap_to_lightning": True,
        "swap_fee_reserve_max": 0.05,
    }


async def melt_token_to_ln(mint_url: str, invoice: str, proofs: list) -> dict:
    """
    Melt Cashu proofs at mint to pay a Lightning invoice.

    Args:
        mint_url: The mint's URL
        invoice: BOLT11 Lightning invoice to pay
        proofs: List of Cashu proofs to spend

    Returns:
        Dict with success status and details
    """
    try:
        async with httpx.AsyncClient() as client:
            # Step 1: Get melt quote (NUT-11)
            quote_response = await client.post(
                f"{mint_url}/v1/melt/quote/bolt11",
                json={"request": invoice},
                timeout=30,
            )

            if quote_response.status_code != 200:
                return {"success": False, "error": f"Mint quote failed: {quote_response.text}"}

            quote_data = quote_response.json()
            melt_quote_id = quote_data.get("quote_id")
            amount_sats = quote_data.get("amount", 0)
            fee_reserve = quote_data.get("fee_reserve", 0)

            # Step 2: Send proofs to mint (NUT-12)
            melt_response = await client.post(
                f"{mint_url}/v1/melt",
                json={
                    "quote_id": melt_quote_id,
                    "proofs": proofs,
                },
                timeout=30,
            )

            if melt_response.status_code != 200:
                return {"success": False, "error": f"Melt failed: {melt_response.text}"}

            melt_data = melt_response.json()

            # Check if payment was successful
            if melt_data.get("paid"):
                return {
                    "success": True,
                    "amount_sats": amount_sats,
                    "fee_paid": melt_data.get("fee"),
                    "preimage": melt_data.get("preimage"),
                }
            else:
                return {"success": False, "error": "Payment not completed", "data": melt_data}

    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/swap", response_model=SwapResponse)
async def swap_token_to_lightning(
    request: SwapRequest,
    user_id: int = Depends(verify_token_inline),
):
    """
    Swap a Cashu token from any mint to Lightning.

    This is Numo's "Killer Feature": Accept payments from ANY Cashu mint,
    and automatically swap them to Lightning so the merchant receives sats.

    Flow:
    1. Decode token to get mint URL and amount
    2. Check if mint is trusted
    3. If not trusted and auto_swap enabled:
       a. Create LND invoice for the amount
       b. Melt the token at the mint (mint pays our invoice)
       c. Return success with payment details
    4. If trusted mint, just verify (no swap needed)
    """
    # Import LND client
    try:
        from app.lnd_client import check_invoice, create_invoice
    except ImportError:
        return SwapResponse(success=False, amount_sats=0, message="LND client not available")

    # Decode the token
    token_data = decode_cashu_token(request.token)

    if not token_data["mint_url"] or token_data["amount_sats"] == 0:
        return SwapResponse(
            success=False,
            amount_sats=0,
            message=f"Could not decode token: {token_data.get('error', 'Unknown error')}",
        )

    mint_url = token_data["mint_url"]
    amount_sats = token_data["amount_sats"]

    # Check if mint is trusted
    trusted = await is_trusted_mint(user_id, mint_url)
    swap_settings = await get_swap_settings(user_id)

    if trusted:
        # Trusted mint - no swap needed, just verify
        return SwapResponse(
            success=True,
            amount_sats=amount_sats,
            mint_url=mint_url,
            message="Trusted mint - no swap needed",
        )

    # Unknown mint - check if we accept unknown mints
    if not swap_settings["accept_unknown_mints"]:
        return SwapResponse(
            success=False,
            amount_sats=amount_sats,
            mint_url=mint_url,
            message="Unknown mint not accepted. Please add this mint first.",
        )

    # Auto-swap to Lightning
    if not swap_settings["auto_swap_to_lightning"]:
        return SwapResponse(
            success=False,
            amount_sats=amount_sats,
            mint_url=mint_url,
            message="Auto-swap to Lightning is disabled. Enable it in Mint Settings.",
        )

    # Create LND invoice to receive the sats
    try:
        invoice = create_invoice(
            amount_sats=amount_sats,
            memo=f"Swap from {mint_url[:30]}...",
        )
        bolt11 = invoice["payment_request"]
        payment_hash = invoice["payment_hash"]
    except Exception as e:
        return SwapResponse(
            success=False,
            amount_sats=amount_sats,
            mint_url=mint_url,
            message=f"Failed to create Lightning invoice: {str(e)}",
        )

    # Extract proofs from token
    proofs = []
    raw_data = token_data.get("raw", {})
    if isinstance(raw_data, dict):
        proofs = raw_data.get("proofs", [])
    elif isinstance(raw_data, list):
        proofs = raw_data

    # Melt the token at the mint (pay our LND invoice)
    melt_result = await melt_token_to_ln(mint_url, bolt11, proofs)

    if melt_result["success"]:
        return SwapResponse(
            success=True,
            amount_sats=melt_result["amount_sats"],
            payment_hash=payment_hash,
            bolt11=bolt11,
            mint_url=mint_url,
            message=f"Swapped {amount_sats} sats from {mint_url[:40]}... to Lightning!",
        )
    else:
        return SwapResponse(
            success=False,
            amount_sats=amount_sats,
            mint_url=mint_url,
            message=f"Swap failed: {melt_result.get('error', 'Unknown error')}",
        )
