"""
Cashu Integration for ZapOut
Ecash tokens for offline payments
"""

import os
import httpx
import json
import base64
import asyncio
from typing import Optional, Dict, Any, List
from datetime import datetime
import sqlite3

# Cashu Configuration
CASHU_MINT_URL = os.getenv("CASHU_MINT_URL", "")  # Empty = Mock mode
CASHU_MINT_KEY = os.getenv("CASHU_MINT_KEY", "")  # Optional

DB_PATH = "zapout.db"


class CashuClient:
    """Cashu Mint API Client"""
    
    def __init__(self, mint_url: str = None, mint_key: str = None):
        self.mint_url = mint_url or CASHU_MINT_URL
        self.mint_key = mint_key or CASHU_MINT_KEY
    
    async def _request(self, method: str, endpoint: str, data: dict = None) -> dict:
        """Make request to Cashu Mint"""
        headers = {"Content-Type": "application/json"}
        if self.mint_key:
            headers["Authorization"] = f"Bearer {self.mint_key}"
        
        async with httpx.AsyncClient() as client:
            url = f"{self.mint_url}{endpoint}"
            
            if method == "GET":
                response = await client.get(url, headers=headers)
            elif method == "POST":
                response = await client.post(url, json=data or {}, headers=headers)
            else:
                raise ValueError(f"Unsupported: {method}")
            
            if response.status_code >= 400:
                return {"error": response.text, "status_code": response.status_code}
            
            return response.json() if response.text else {}
    
    async def get_mint_info(self) -> Dict[str, Any]:
        """Get mint information (keysets, etc)"""
        if not self.mint_url:
            return {"name": "ZapOut Mock Mint", "version": "1.0", "mock": True}
        # NUT-standard endpoint
        return await self._request("GET", "/v1/mint")
    
    async def create_mintquote(self, amount: int, unit: str = "sat") -> Dict[str, Any]:
        """
        Create a mint quote - user sends sats, gets ecash tokens
        amount: in sats (or other unit)
        unit: sat, msat, usd, eur
        """
        # Mock mode if no mint configured
        if not self.mint_url or self.mint_url == "":
            import secrets
            return {
                "quote_id": f"mock_{secrets.token_urlsafe(8)}",
                "amount": amount,
                "payment_request": f"lnbc{amount * 1000}n1pwtfmock",
                "expiry": 300,
                "created_at": datetime.utcnow().isoformat(),
                "mock": True
            }
        
        # NUT-standard endpoint: /v1/mint/quote/bolt11
        data = {"amount": amount, "unit": unit}
        result = await self._request("POST", "/v1/mint/quote/bolt11", data)
        
        if "error" in result:
            return result
        
        return {
            "quote_id": result.get("quote", result.get("quoteId")),
            "amount": amount,
            "payment_request": result.get("request", result.get("pr")),
            "expiry": result.get("expiry", 300),
            "created_at": datetime.utcnow().isoformat()
        }
    
    async def mint_tokens(self, quote_id: str) -> Dict[str, Any]:
        """
        Mint tokens after payment received
        """
        # NUT-standard endpoint: /v1/mint/quote/bolt11/{quote_id}
        data = {"quote": quote_id}
        result = await self._request("POST", f"/v1/mint/quote/bolt11/{quote_id}", data)
        
        if "error" in result:
            return result
        
        return {
            "tokens": result.get("proofs", []),  # Ecash tokens
            "quote_id": quote_id,
            "created_at": datetime.utcnow().isoformat()
        }
    
    async def check_mintquote(self, quote_id: str) -> Dict[str, Any]:
        """Check if mint quote is paid"""
        result = await self._request("GET", f"/v1/mint/quote/{quote_id}")
        
        if "error" in result:
            return result
        
        return {
            "quote_id": quote_id,
            "paid": result.get("paid", False),
            "amount": result.get("amount", 0)
        }
    
    async def melt_tokens(self, pr: str) -> Dict[str, Any]:
        """
        Melt tokens - spend ecash (send to Lightning)
        pr: Payment request (Lightning invoice)
        """
        # First, get quote for melting
        data = {"pr": pr}
        result = await self._request("POST", "/v1/melt/quote", data)
        
        if "error" in result:
            return result
        
        quote_id = result.get("quote")
        
        # Return the quote - user needs to provide proofs
        return {
            "quote_id": quote_id,
            "amount": result.get("amount", 0),
            "fee": result.get("fee", 0),
            "payment_request": pr
        }
    
    async def melt_prove(self, quote_id: str, proofs: List[dict]) -> Dict[str, Any]:
        """
        Submit proofs to melt tokens
        """
        data = {"quote": quote_id, "proofs": proofs}
        result = await self._request("POST", "/v1/melt", data)
        
        if "error" in result:
            return result
        
        return {
            "success": True,
            "quote_id": quote_id,
            "preimage": result.get("preimage")
        }
    
    async def decode_token(self, token: str) -> Dict[str, Any]:
        """Decode an ecash token"""
        try:
            # Token is base64 encoded JSON
            decoded = base64.b64decode(token).decode()
            data = json.loads(decoded)
            return {
                "valid": True,
                "token": data
            }
        except Exception as e:
            return {"valid": False, "error": str(e)}
    
    async def get_balance(self, proofs: List[dict]) -> int:
        """Calculate total balance from proofs"""
        return sum(p.get("amount", 0) for p in proofs)


# Sync wrapper
class CashuSync:
    """Synchronous wrapper"""
    
    def __init__(self, mint_url: str = None, mint_key: str = None):
        self.async_client = CashuClient(mint_url, mint_key)
    
    def _run(self, coro):
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        return loop.run_until_complete(coro)
    
    def get_mint_info(self):
        return self._run(self.async_client.get_mint_info())
    
    def create_mintquote(self, amount: int):
        return self._run(self.async_client.create_mintquote(amount))
    
    def mint_tokens(self, quote_id: str):
        return self._run(self.async_client.mint_tokens(quote_id))
    
    def check_mintquote(self, quote_id: str):
        return self._run(self.async_client.check_mintquote(quote_id))
    
    def melt_tokens(self, pr: str):
        return self._run(self.async_client.melt_tokens(pr))
    
    def melt_prove(self, quote_id: str, proofs: List[dict]):
        return self._run(self.async_client.melt_prove(quote_id, proofs))


# Database helpers
def save_cashu_tokens(user_id: int, tokens: List[dict]):
    """Save ecash tokens for user"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # Create table if not exists
    c.execute("""
        CREATE TABLE IF NOT EXISTS cashu_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token_data TEXT NOT NULL,
            amount INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    for token in tokens:
        token_json = json.dumps(token)
        c.execute(
            "INSERT INTO cashu_tokens (user_id, token_data, amount) VALUES (?, ?, ?)",
            (user_id, token_json, token.get("amount", 0))
        )
    
    conn.commit()
    conn.close()


def get_cashu_balance(user_id: int) -> int:
    """Get user's Cashu balance"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT SUM(amount) FROM cashu_tokens WHERE user_id = ?", (user_id,))
    result = c.fetchone()[0]
    conn.close()
    return result or 0


def get_cashu_tokens(user_id: int) -> List[dict]:
    """Get user's Cashu tokens"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT token_data FROM cashu_tokens WHERE user_id = ?", (user_id,))
    rows = c.fetchall()
    conn.close()
    return [json.loads(r[0]) for r in rows]


# Global client
_cashu_client = None

def get_cashu_client() -> CashuSync:
    global _cashu_client
    if _cashu_client is None:
        _cashu_client = CashuSync()
    return _cashu_client


# Test
def test_cashu():
    client = get_cashu_client()
    try:
        info = client.get_mint_info()
        print("Mint Info:", info)
    except Exception as e:
        print("Error:", e)


if __name__ == "__main__":
    test_cashu()
