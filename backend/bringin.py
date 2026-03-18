"""
Bringin Integration for ZapOut
Handles EUR settlements via Bringin API
"""

import asyncio
import os
import sqlite3
from datetime import datetime
from typing import Any, Dict, Optional

import httpx

# Bringin Configuration
BRINGIN_API_URL = os.getenv("BRINGIN_API_URL", "https://api.bringin.io/v1")
BRINGIN_API_KEY = os.getenv("BRINGIN_API_KEY", "")  # Set via environment

DB_PATH = "zapout.db"


class BringinClient:
    """Bringin API Client for EUR settlements"""

    def __init__(self, api_key: str = None):
        self.api_key = api_key or BRINGIN_API_KEY
        self.base_url = BRINGIN_API_URL

    async def _request(self, method: str, endpoint: str, data: dict = None) -> dict:
        """Make API request to Bringin"""
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}

        async with httpx.AsyncClient() as client:
            url = f"{self.base_url}/{endpoint}"

            if method == "GET":
                response = await client.get(url, headers=headers)
            elif method == "POST":
                response = await client.post(url, json=data or {}, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")

            if response.status_code >= 400:
                return {"error": response.text, "status_code": response.status_code}

            return response.json() if response.text else {}

    async def create_wallet(self, email: str, phone: str) -> Dict[str, Any]:
        """
        Create a Bringin wallet for EUR payouts
        """
        data = {"email": email, "phone": phone, "type": "individual"}

        result = await self._request("POST", "wallets", data)

        if "error" in result:
            return result

        return {
            "wallet_id": result.get("id"),
            "email": result.get("email"),
            "status": result.get("status", "active"),
            "created_at": result.get("created_at"),
        }

    async def add_bank_account(self, wallet_id: str, iban: str, bank_name: str) -> Dict[str, Any]:
        """
        Link bank account (IBAN) to wallet
        """
        data = {"iban": iban, "bank_name": bank_name, "account_holder": "ZapOut User"}

        result = await self._request("POST", f"wallets/{wallet_id}/bank-accounts", data)

        if "error" in result:
            return result

        return {
            "account_id": result.get("id"),
            "iban_last4": result.get("iban", {}).get("last4", ""),
            "status": result.get("status", "pending"),
        }

    async def create_payout(
        self, wallet_id: str, amount_eur: int, reference: str
    ) -> Dict[str, Any]:
        """
        Create EUR payout to bank account
        amount_eur: in cents
        """
        data = {
            "amount": amount_eur,  # in cents
            "currency": "EUR",
            "reference": reference,
            "schedule": "now",
        }

        result = await self._request("POST", f"wallets/{wallet_id}/payouts", data)

        if "error" in result:
            return result

        return {
            "payout_id": result.get("id"),
            "amount": result.get("amount"),
            "status": result.get("status", "pending"),
            "reference": result.get("reference"),
            "created_at": result.get("created_at"),
        }

    async def get_payout_status(self, payout_id: str) -> Dict[str, Any]:
        """Get payout status"""
        result = await self._request("GET", f"payouts/{payout_id}")

        if "error" in result:
            return result

        return {
            "payout_id": payout_id,
            "status": result.get("status"),  # pending, processing, completed, failed
            "amount": result.get("amount"),
            "completed_at": result.get("completed_at"),
        }

    async def get_wallet_balance(self, wallet_id: str) -> Dict[str, Any]:
        """Get wallet balance"""
        result = await self._request("GET", f"wallets/{wallet_id}")

        if "error" in result:
            return result

        return {
            "wallet_id": wallet_id,
            "balance_eur": result.get("balance", {}).get("eur", 0),
            "available_eur": result.get("balance", {}).get("available", 0),
        }

    async def create_onramp_quote(self, amount_eur: int) -> Dict[str, Any]:
        """
        Create EUR to BTC quote (on-ramp)
        """
        data = {"amount": amount_eur, "from_currency": "EUR", "to_currency": "BTC"}

        result = await self._request("POST", "onramp/quotes", data)

        if "error" in result:
            return result

        return {
            "quote_id": result.get("id"),
            "amount_eur": amount_eur,
            "amount_sats": result.get("btc_amount"),
            "expires_at": result.get("expires_at"),
            "payment_instruction": result.get("payment_instruction"),
        }


# Sync wrapper
class BringinSync:
    """Synchronous wrapper for Bringin client"""

    def __init__(self, api_key: str = None):
        self.async_client = BringinClient(api_key)

    def create_wallet(self, email: str, phone: str) -> Dict[str, Any]:
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        return loop.run_until_complete(self.async_client.create_wallet(email, phone))

    def add_bank_account(self, wallet_id: str, iban: str, bank_name: str) -> Dict[str, Any]:
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        return loop.run_until_complete(
            self.async_client.add_bank_account(wallet_id, iban, bank_name)
        )

    def create_payout(self, wallet_id: str, amount_eur: int, reference: str) -> Dict[str, Any]:
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        return loop.run_until_complete(
            self.async_client.create_payout(wallet_id, amount_eur, reference)
        )

    def get_payout_status(self, payout_id: str) -> Dict[str, Any]:
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        return loop.run_until_complete(self.async_client.get_payout_status(payout_id))

    def get_wallet_balance(self, wallet_id: str) -> Dict[str, Any]:
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        return loop.run_until_complete(self.async_client.get_wallet_balance(wallet_id))

    def create_onramp_quote(self, amount_eur: int) -> Dict[str, Any]:
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        return loop.run_until_complete(self.async_client.create_onramp_quote(amount_eur))


# Global client
_bringin_client = None


def get_bringin_client() -> BringinSync:
    """Get or create Bringin client"""
    global _bringin_client
    if _bringin_client is None:
        api_key = os.getenv("BRINGIN_API_KEY", "")
        if not api_key:
            print("WARNING: BRINGIN_API_KEY not set")
        _bringin_client = BringinSync(api_key)
    return _bringin_client


# Database helpers
def save_user_wallet(user_id: int, wallet_id: str):
    """Save user's Bringin wallet ID"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("UPDATE users SET wallet_id = ? WHERE id = ?", (wallet_id, user_id))
    conn.commit()
    conn.close()


# Test
def test_bringin():
    client = get_bringin_client()
    try:
        # This will fail without valid API key
        balance = client.get_wallet_balance("test")
        print("Balance:", balance)
    except Exception as e:
        print("Error (expected without API key):", e)


if __name__ == "__main__":
    test_bringin()
