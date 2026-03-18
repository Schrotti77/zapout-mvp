"""
Breez Spark Integration for ZapOut
Handles Lightning payments via Breez API
"""

import os
import httpx
import asyncio
from typing import Optional, Dict, Any
from datetime import datetime
import sqlite3

# Breez API Configuration
BREEZ_API_URL = os.getenv("BREEZ_API_URL", "https://api.breez.technology/v1")
BREEZ_API_KEY = os.getenv("BREEZ_API_KEY", "")  # Set via environment

DB_PATH = "zapout.db"


class BreezClient:
    """Breez Spark API Client"""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or BREEZ_API_KEY
        self.base_url = BREEZ_API_URL
    
    async def _request(self, method: str, endpoint: str, data: dict = None) -> dict:
        """Make API request to Breez"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient() as client:
            url = f"{self.base_url}/{endpoint}"
            
            if method == "GET":
                response = await client.get(url, headers=headers)
            elif method == "POST":
                response = await client.post(url, json=data, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            if response.status_code >= 400:
                return {"error": response.text, "status_code": response.status_code}
            
            return response.json() if response.text else {}
    
    async def create_invoice(self, amount_sats: int, description: str = "ZapOut Payment") -> Dict[str, Any]:
        """
        Create a Lightning invoice
        Returns: bolt11 invoice, payment_hash, expiry
        """
        data = {
            "amount_msat": amount_sats * 1000,  # Convert sats to msats
            "description": description,
            "expiry_seconds": 300  # 5 minutes
        }
        
        result = await self._request("POST", "invoice", data)
        
        if "error" in result:
            return result
        
        return {
            "invoice_id": result.get("payment_hash"),
            "bolt11": result.get("bolt11"),
            "payment_request": result.get("bolt11"),
            "amount_sats": amount_sats,
            "description": description,
            "expiry": result.get("expiry", 300),
            "created_at": datetime.utcnow().isoformat()
        }
    
    async def check_invoice(self, payment_hash: str) -> Dict[str, Any]:
        """
        Check invoice/payment status
        Returns: status (pending/paid/failed)
        """
        result = await self._request("GET", f"invoice/{payment_hash}")
        
        if "error" in result:
            return result
        
        # Map Breez status to our status
        status_map = {
            "OPEN": "pending",
            "SETTLED": "completed", 
            "FAILED": "failed",
            "EXPIRED": "expired"
        }
        
        return {
            "invoice_id": payment_hash,
            "status": status_map.get(result.get("state", "").upper(), "pending"),
            "amount_msat": result.get("amount_msat", 0),
            "paid_at": result.get("settled_at")
        }
    
    async def send_payment(self, bolt11: str) -> Dict[str, Any]:
        """
        Pay a Lightning invoice (BOLT11)
        Returns: payment result
        """
        data = {
            "bolt11": bolt11
        }
        
        result = await self._request("POST", "pay", data)
        
        if "error" in result:
            return result
        
        return {
            "payment_hash": result.get("payment_hash"),
            "status": "completed" if result.get("status") == "SUCCESS" else "pending",
            "amount_msat": result.get("amount_msat", 0),
            "fee_msat": result.get("fee_msat", 0)
        }
    
    async def get_balance(self) -> Dict[str, Any]:
        """
        Get on-chain and Lightning balance
        """
        result = await self._request("GET", "balance")
        
        if "error" in result:
            return result
        
        return {
            "onchain_sats": result.get("onchain", {}).get("satoshi", 0),
            "lightning_sats": result.get("lightning", {}).get("satoshi", 0)
        }


# Sync wrapper for FastAPI
class BreezSync:
    """Synchronous wrapper for Breez client"""
    
    def __init__(self, api_key: str = None):
        self.async_client = BreezClient(api_key)
    
    def create_invoice(self, amount_sats: int, description: str = "ZapOut Payment") -> Dict[str, Any]:
        """Create invoice synchronously"""
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        return loop.run_until_complete(
            self.async_client.create_invoice(amount_sats, description)
        )
    
    def check_invoice(self, payment_hash: str) -> Dict[str, Any]:
        """Check invoice synchronously"""
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        return loop.run_until_complete(
            self.async_client.check_invoice(payment_hash)
        )
    
    def send_payment(self, bolt11: str) -> Dict[str, Any]:
        """Send payment synchronously"""
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        return loop.run_until_complete(
            self.async_client.send_payment(bolt11)
        )
    
    def get_balance(self) -> Dict[str, Any]:
        """Get balance synchronously"""
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        return loop.run_until_complete(
            self.async_client.get_balance()
        )


# Global client instance
_breez_client = None

def get_breez_client() -> BreezSync:
    """Get or create Breez client"""
    global _breez_client
    if _breez_client is None:
        api_key = os.getenv("BREEZ_API_KEY", "")
        if not api_key:
            print("WARNING: BREEZ_API_KEY not set")
        _breez_client = BreezSync(api_key)
    return _breez_client


# Database helpers
def update_payment_status(invoice_id: str, status: str):
    """Update payment status in database"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        "UPDATE payments SET status = ? WHERE invoice_id = ?",
        (status, invoice_id)
    )
    conn.commit()
    conn.close()


# Webhook handler
async def handle_breez_webhook(data: dict):
    """
    Handle Breez webhook events
    Event types: invoice_payment, payment_failed
    """
    event_type = data.get("type", "")
    
    if event_type == "invoice_payment":
        payment_hash = data.get("payment_hash")
        amount_msat = data.get("amount_msat", 0)
        
        # Update payment status
        update_payment_status(payment_hash, "completed")
        
        return {
            "event": "payment_received",
            "payment_hash": payment_hash,
            "amount_sats": amount_msat // 1000
        }
    
    elif event_type == "payment_failed":
        payment_hash = data.get("payment_hash")
        
        update_payment_status(payment_hash, "failed")
        
        return {
            "event": "payment_failed",
            "payment_hash": payment_hash
        }
    
    return {"event": "unknown"}


# Test function
def test_breez():
    """Test Breez connection"""
    client = get_breez_client()
    
    # Test balance (will fail without valid API key)
    balance = client.get_balance()
    print("Balance:", balance)
    
    # Test create invoice
    invoice = client.create_invoice(1000, "Test payment 10 EUR")
    print("Invoice:", invoice)


if __name__ == "__main__":
    test_breez()
