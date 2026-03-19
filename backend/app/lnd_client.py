"""
LND Client Module für ZapOut Backend

Verbindet sich mit dem LND Node auf Helmut via SSH + lncli.
"""

import json
import logging
import subprocess
import tempfile
from typing import Optional

logger = logging.getLogger(__name__)

# LND auf Helmut
LND_HOST = "100.74.149.69"
SSH_KEY = "~/.ssh/umbrel_tunnel"


def _run_lncli(command: list) -> dict:
    """
    Führt einen lncli Befehl auf Helmut aus.

    Args:
        command: Liste von lncli Argumenten (z.B. ['addinvoice', '--amt', '100'])

    Returns:
        Dict mit dem JSON Output von lncli
    """

    # Baue Command - sudo docker exec mit shell=True für korrekte Argument-Parsing
    # Args mit Leerzeichen müssen gequotet werden
    def quote_arg(arg):
        if " " in arg or '"' in arg:
            return f'"{arg}"'
        return arg

    lncli_args = " ".join(quote_arg(a) for a in command)
    ssh_cmd = f"sudo docker exec lightning_lnd_1 lncli {lncli_args}"

    cmd = [
        "ssh",
        "-o",
        "StrictHostKeyChecking=no",
        "-o",
        "ConnectTimeout=10",
        "-i",
        SSH_KEY,
        f"umbrel@{LND_HOST}",
        ssh_cmd,
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30,
        )

        if result.returncode != 0:
            logger.error(f"lncli failed: {result.stderr}")
            raise Exception(f"lncli error: {result.stderr}")

        # Parse JSON output
        if result.stdout.strip():
            return json.loads(result.stdout)
        return {}

    except subprocess.TimeoutExpired:
        raise Exception("lncli command timed out")
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse lncli output: {result.stdout}")
        raise Exception(f"JSON parse error: {e}")


def create_invoice(amount_sats: int, memo: str = "") -> dict:
    """
    Erstellt eine Lightning Rechnung.

    Args:
        amount_sats: Betrag in Satoshis
        memo: Beschreibung/Titel für die Rechnung

    Returns:
        Dict mit payment_request, payment_hash, etc.
    """
    # lncli addinvoice --amt 100 --expiry 3600
    result = _run_lncli(
        [
            "addinvoice",
            "--amt",
            str(amount_sats),
            "--expiry",
            "3600",
            "--memo",
            memo or f"ZapOut {amount_sats} sats",
        ]
    )

    return {
        "payment_request": result.get("payment_request", ""),
        "payment_hash": result.get("r_hash", ""),
        "amount_sats": amount_sats,
        "memo": memo,
    }


def check_invoice(payment_hash: str) -> dict:
    """
    Prüft ob eine Rechnung bezahlt wurde.

    Args:
        payment_hash: Hex-encoded Payment Hash

    Returns:
        Dict mit status (pending, settled, expired)
    """
    try:
        # lookupinvoice braucht den r_hash als hex
        result = _run_lncli(["lookupinvoice", "--r_hash", payment_hash])

        state = result.get("state", 0)

        if state == 1:  # SETTLED
            return {"status": "settled", "amount_sats": result.get("amt_paid_sat", 0)}
        elif state == 0:  # ACCEPTED
            return {"status": "pending", "amount_sats": 0}
        elif state == 2:  # CANCELLED
            return {"status": "expired", "amount_sats": 0}
        else:
            return {"status": "open", "amount_sats": 0}

    except Exception as e:
        logger.error(f"Error checking invoice: {e}")
        return {"status": "error", "error": str(e)}


def get_wallet_balance() -> dict:
    """
    Gibt den Wallet Balance zurück.
    """
    wallet = _run_lncli(["walletbalance"])
    channel = _run_lncli(["channelbalance"])

    return {
        "confirmed_balance": wallet.get("confirmed_balance", 0),
        "unconfirmed_balance": wallet.get("unconfirmed_balance", 0),
        "channel_balance": channel.get("balance", 0),
        "channel_pending_open": channel.get("pending_open_balance", 0),
    }


def get_node_info() -> dict:
    """
    Gibt Node Info zurück (Pubkey, Alias, etc.)
    """
    info = _run_lncli(["getinfo"])

    return {
        "pubkey": info.get("identity_pubkey", ""),
        "alias": info.get("alias", ""),
        "version": info.get("version", ""),
        "num_channels": info.get("num_active_channels", 0),
        "block_height": info.get("block_height", 0),
    }
