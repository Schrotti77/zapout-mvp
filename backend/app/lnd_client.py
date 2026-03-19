"""
LND Client Module für ZapOut Backend

Verbindet sich mit dem LND Node auf Helmut via SSH Tunnel.
"""

import logging
import os
import time
from typing import Optional

import lndgrpc
from sshtunnel import SSHTunnelForwarder

logger = logging.getLogger(__name__)

# LND auf Helmut
LND_HOST = "100.74.149.69"  # Helmut's public IP
LND_PORT = 10009

# Credentials
CREDENTIALS_DIR = os.path.expanduser("~/.openclaw/credentials/zapout")
TLS_CERT_PATH = os.path.join(CREDENTIALS_DIR, "lnd-tls.cert")
ADMIN_MACAROON_PATH = os.path.join(CREDENTIALS_DIR, "lnd-admin.macaroon.hex")

# SSH Tunnel wird als Singleton gehalten
_tunnel: Optional[SSHTunnelForwarder] = None
_lnd_client: Optional[lndgrpc.LNDClient] = None


def _read_macaroon_hex(path: str) -> bytes:
    """Liest Hex-encoded Macaroon und gibt Bytes zurück."""
    with open(path, "r") as f:
        hex_str = f.read().strip()
    return bytes.fromhex(hex_str)


def get_lnd_client() -> lndgrpc.LNDClient:
    """
    Gibt den LND Client zurück. Erstellt SSH Tunnel falls nötig.
    """
    global _tunnel, _lnd_client

    if _lnd_client is not None:
        return _lnd_client

    # SSH Tunnel erstellen
    logger.info("Creating SSH tunnel to LND on Helmut...")

    _tunnel = SSHTunnelForwarder(
        (LND_HOST, 22),
        ssh_username="umbrel",
        ssh_pkey=os.path.expanduser("~/.ssh/umbrel_tunnel"),
        remote_bind_address=("127.0.0.1", LND_PORT),
        local_bind_address=("127.0.0.1", LND_PORT),
    )

    _tunnel.start()
    logger.info(f"SSH tunnel established on local port {LND_PORT}")

    # LND Client erstellen
    _lnd_client = lndgrpc.LNDClient(
        f"127.0.0.1:{LND_PORT}",
        macaroon_path=ADMIN_MACAROON_PATH,
        cert_path=TLS_CERT_PATH,
    )

    # Kurze Pause damit Verbindung stabilisiert
    time.sleep(0.5)

    return _lnd_client


def close_lnd_connection():
    """Schließt SSH Tunnel und LND Verbindung."""
    global _tunnel, _lnd_client

    if _lnd_client:
        _lnd_client = None

    if _tunnel:
        _tunnel.stop()
        _tunnel = None
        logger.info("SSH tunnel closed")


def create_invoice(amount_sats: int, memo: str = "") -> dict:
    """
    Erstellt eine Lightning Rechnung.

    Args:
        amount_sats: Betrag in Satoshis
        memo: Beschreibung/Titel für die Rechnung

    Returns:
        Dict mit payment_request, payment_hash, etc.
    """
    client = get_lnd_client()

    # Invoice erstellen
    add_invoice_response = client.add_invoice(
        value=amount_sats,
        memo=memo or f"ZapOut Payment {amount_sats} sats",
    )

    return {
        "payment_request": add_invoice_response.payment_request,
        "payment_hash": add_invoice_response.r_hash.hex(),
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
    client = get_lnd_client()

    # Payment Hash als Bytes
    r_hash = bytes.fromhex(payment_hash)

    try:
        invoice = client.lookup_invoice(r_hash_hash=r_hash)

        if invoice.settled:
            return {"status": "settled", "amount_sats": invoice.amt_paid_sat}
        elif invoice.state == 1:  # OPEN
            return {"status": "pending", "amount_sats": 0}
        elif invoice.state == 3:  # EXPIRED
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
    client = get_lnd_client()

    wallet_balance = client.wallet_balance()
    channel_balance = client.channel_balance()

    return {
        "confirmed_balance": wallet_balance.confirmed_balance,
        "unconfirmed_balance": wallet_balance.unconfirmed_balance,
        "channel_balance": channel_balance.balance,
        "channel_pending_open": channel_balance.pending_open_balance,
    }


def get_node_info() -> dict:
    """
    Gibt Node Info zurück (Pubkey, Alias, etc.)
    """
    client = get_lnd_client()
    info = client.get_info()

    return {
        "pubkey": info.identity_pubkey,
        "alias": info.alias,
        "version": info.version,
        "num_channels": info.num_active_channels,
        "block_height": info.block_height,
    }
