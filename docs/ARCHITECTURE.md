# ZapOut - Technical Architecture

> **Version:** 2.0 | **Datum:** 19.03.2026
> **Status:** LND + Passkey PRF + Cashu Management

---

## 1. Overview

ZapOut nutzt eine selbst-gehostete Architektur mit Helmut (Umbrel) als Backend-Server und Passkey-basiertem Login ohne Seed-Phrase.

```
┌─────────────────────────────────────────────────────────────────┐
│                         MERCHANT DEVICE                         │
│  ┌─────────────┐                                                │
│  │ Passkey     │ ◀── WebAuthn (Fingerprint/Face/PIN)           │
│  │ (Biometric) │                                                │
│  └──────┬──────┘                                                │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              BROWSER / REACT APP                          │  │
│  │                                                           │  │
│  │  PRF Extension:                                           │  │
│  │  seed = navigator.credentials.get({                      │  │
│  │    publicKey: {                                          │  │
│  │      challenge: server_challenge,                         │  │
│  │      extensions: { prf: { eval: { first: challenge } } }  │  │
│  │    }                                                      │  │
│  │  })                                                       │  │
│  │                                                           │  │
│  │  derive_prf_seed(challenge, salt) ──▶ BIP32 Master Key    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                      │
│                          │ HTTPS + JWT                          │
│                          ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    ZAPOUT BACKEND                         │  │
│  │                   (FastAPI + SQLite)                      │  │
│  │                                                           │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐  │  │
│  │  │ Passkey     │  │ Auth        │  │ Payment           │  │  │
│  │  │ Auth        │  │ (JWT)       │  │ (LND + Cashu)    │  │  │
│  │  └─────────────┘  └─────────────┘  └──────────────────┘  │  │
│  │                                                           │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐  │  │
│  │  │ Cashu       │  │ Mint        │  │ Swap             │  │  │
│  │  │ Management  │  │ Manager     │  │ Engine           │  │  │
│  │  └─────────────┘  └─────────────┘  └──────────────────┘  │  │
│  │                                                           │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐  │  │
│  │  │ Bringin     │  │ Webhooks    │  │ Numo             │  │  │
│  │  │ Settlement  │  │ Manager     │  │ Receiver         │  │  │
│  │  └─────────────┘  └─────────────┘  └──────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                      │
│                          │ SSH Tunnel                           │
│                          ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                     HELMUT (Umbrel)                        │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐  │  │
│  │  │ LND         │  │ LNbits      │  │ Cashu Mint       │  │  │
│  │  │ (SynapseLN) │  │             │  │                  │  │  │
│  │  └─────────────┘  └─────────────┘  └──────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Key Architecture Decisions

### 2.1 Watch-Only Wallet via LND

**Warum nicht Breez SDK Spark?**

- Wir haben bereits LND auf Helmut (SynapseLN)
- Selbst-gehostet = mehr Kontrolle
- Keine Abhängigkeit von externen Services für Lightning
- Kostenlos (keine Greenlight/Breez Gebühren)

### 2.2 Cashu Multi-Mint Architecture

**Helmut's Cashu Mint (LÄUFT ✅):**

- URL: `http://100.74.149.69:3338`
- Software: cdk-mintd v0.15.0
- Backend: Helmut's LND (SynapseLN)
- Ports: NUT-04, NUT-05, NUT-07, NUT-08, NUT-09, NUT-10, NUT-11, NUT-12, NUT-14, NUT-15, NUT-17, NUT-19, NUT-20

**Im Gegensatz zu Numo:**

- Helmut hat Cashu Mint + LNbits
- ZapOut kann aber ANY Mint akzeptieren via Swap
- User kann preferred Mint wählen
- Auto-Swap zu Lightning bei unbekannten Mints

**→ Details:** Siehe `docs/HELMUT-MINT.md`

### 2.3 Numo Integration Strategy

**Zwei Optionen:**

1. **Numo als NFC-Terminal** - ZapOut empfängt Webhooks von Numo
2. **ZapOut als Alternative** - Eigene Web-basierte Lösung

**Entscheidung:** Beides - Numo für NFC, ZapOut als Management Dashboard

---

## 3. Passkey + PRF Flow

### 3.1 Registration Flow

```
MERCHANT                                    BACKEND
   │                                           │
   │  1. GET /auth/passkey/challenge/register
   │ ─────────────────────────────────────────▶
   │   ◀── { challenge, rpId, timeout }
   │                                           │
   │  2. navigator.credentials.create({...})
   │ ─────────────────────────────────────────▶
   │       POST /auth/passkey/register
   │   ◀── { token }
```

### 3.2 Login Flow

```
MERCHANT                                    BACKEND
   │                                           │
   │  1. GET /auth/passkey/challenge/authenticate
   │ ─────────────────────────────────────────▶
   │   ◀── { challenge, allowCredentials }
   │                                           │
   │  2. navigator.credentials.get({...})
   │ ─────────────────────────────────────────▶
   │       POST /auth/passkey/login
   │   ◀── { token }
```

---

## 4. Watch-Only Wallet

```
┌─────────────────────────────────────────────────────────────┐
│  Merchant Device                                             │
│  ┌─────────────────┐                                        │
│  │ Passkey → PRF   │ ──▶ Master Key (BIP32)                │
│  │ (lokal, nie     │                                        │
│  │  gespeichert)   │                                        │
│  └─────────────────┘                                        │
│          │                                                   │
│          │ derive                                           │
│          ▼                                                   │
│  ┌─────────────────┐     Public Key only                     │
│  │ BIP32 Path      │ ──────────────────────────────────────▶│
│  │ m/44'/0'/0'/0/0 │                                        │
│  └─────────────────┘                                        │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ XPUB (nur Public Keys)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     HELMUT (LND)                            │
│  importwallet (watch-only)                                   │
│  Watch: m/44'/0'/0'/0/* (receive addresses)                │
│  Result: LND zeigt Balance, kann empfangen                   │
│          Aber: CANNOT SPEND (no private keys)                │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Cashu Management (NEW)

### 5.1 Multi-Mint Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ZAPOUT CASHU LAYER                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   Mint Manager                        │   │
│  │                                                     │   │
│  │  ┌───────────────┐  ┌───────────────┐              │   │
│  │  │ Helmut Mint   │  │ NUTstash Mint │  ...          │   │
│  │  │ (Preferred)   │  │               │              │   │
│  │  │ 45,000 sats   │  │ 12,500 sats   │              │   │
│  │  └───────┬───────┘  └───────┬───────┘              │   │
│  │          │                   │                        │   │
│  │          └────────┬──────────┘                        │   │
│  │                   ▼                                     │   │
│  │          ┌───────────────┐                            │   │
│  │          │ Total Balance │                            │   │
│  │          │   57,500 sats │                            │   │
│  │          └───────────────┘                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   Swap Engine                         │   │
│  │                                                     │   │
│  │  Unknown Mint Token ──▶ Melt at Source ──▶ LND Invoice│   │
│  │                                                     │   │
│  │  + Fee Reserve Check (< 5%)                         │   │
│  │  + Preimage Verification                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Mint Management Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      MINT MANAGEMENT                         │
│                                                             │
│  1. ADD MINT                                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ User enters mint URL                                 │   │
│  │ POST /cashu/mints { mint_url: "https://..." }      │   │
│  │                                                     │   │
│  │ Backend:                                            │   │
│  │ - Fetch mint info                                   │   │
│  │ - Verify mint is reachable                          │   │
│  │ - Add to user_mints table                          │   │
│  │ - Set as active                                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  2. SET PREFERRED                                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ User clicks "Set as Preferred"                       │   │
│  │ PUT /cashu/mints/{id} { is_preferred: true }       │   │
│  │                                                     │   │
│  │ Backend:                                            │   │
│  │ - Update user_mints.is_preferred                   │   │
│  │ - All others set to false                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  3. ACCEPT UNKNOWN MINTS                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Toggle: "Accept payments from any mint"              │   │
│  │ PUT /users/settings { accept_unknown_mints: true }  │   │
│  │                                                     │   │
│  │ If true: Unknown tokens auto-swap to LND            │   │
│  │ If false: Only tokens from configured mints          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Swap to Lightning Flow

**Das Numo Killer-Feature:**

```
┌─────────────────────────────────────────────────────────────┐
│                    SWAP TO LIGHTNING                         │
│                                                             │
│  Customer                    ZapOut                  Source Mint
│      │                         │                           │
│      │ Token (Mint XYZ)         │                           │
│      │ ───────────────────────▶│                           │
│      │                         │                           │
│      │                         │ 1. Decode token            │
│      │                         │    → Source Mint URL      │
│      │                         │                           │
│      │                         │ 2. Check if mint allowed  │
│      │                         │    (user settings)         │
│      │                         │                           │
│      │                         │ 3. Create LND Invoice      │
│      │                         │───────────────────────────▶│
│      │                         │◀───────────────────────────│
│      │                         │    BOLT11 Invoice         │
│      │                         │                           │
│      │                         │ 4. Create Melt Quote      │
│      │                         │───────────────────────────▶│
│      │                         │◀───────────────────────────│
│      │                         │    Melt Quote + Fee       │
│      │                         │                           │
│      │                         │ 5. Check fee (< 5%)       │
│      │                         │                           │
│      │                         │ 6. Execute Melt           │
│      │                         │───────────────────────────▶│
│      │                         │◀───────────────────────────│
│      │                         │    Melt Result            │
│      │                         │                           │
│      │                         │ 7. Verify Preimage        │
│      │                         │    SHA256(preimage)       │
│      │                         │    == payment_hash        │
│      │                         │                           │
│      │                         │ 8. LND confirms payment   │
│      │                         │                           │
│      │  ✅ Success             │                           │
│      │ ◀──────────────────────│                           │
│      │                         │                           │
└─────────────────────────────────────────────────────────────┘
```

### 5.4 Database Schema - Cashu

```sql
-- User's connected mints
CREATE TABLE user_mints (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    mint_url TEXT NOT NULL,
    mint_name TEXT,  -- Optional display name
    is_preferred INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    last_checked TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User settings for cashu
ALTER TABLE users ADD COLUMN accept_unknown_mints INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN preferred_mint_url TEXT;
ALTER TABLE users ADD COLUMN auto_swap_to_lightning INTEGER DEFAULT 1;
```

---

## 6. Numo Integration (NEW)

### 6.1 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    NUMO + ZAPOUT HYBRID                         │
│                                                                 │
│   Customer           Numo (Android)        ZapOut (Web)          │
│      │                    │                    │                │
│      │  Tap/QR Pay        │                    │                │
│      │ ──────────────────▶│                    │                │
│      │                    │                    │                │
│      │                    │  Webhook            │                │
│      │                    │  payment.received  │                │
│      │                    │ ──────────────────▶│                │
│      │                    │                    │                │
│      │                    │                    │  Dashboard     │
│      │                    │                    │  EUR Settlement│
│      │                    │                    │  Reports       │
│      │                    │                    │  All Payments  │
│      │                    │                    │                │
│      │                    │◀───────────────────│                │
│      │                    │  Config Updates     │                │
│      │                    │                    │                │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Numo Webhook Receiver

```python
@app.post("/webhooks/numo")
async def receive_numo_webhook(request: Request):
    """
    Empfängt Numo payment.received Webhooks
    Numo als NFC-Terminal, ZapOut als Management Dashboard
    """
    # Verify signature if configured
    signature = request.headers.get("Authorization")

    payload = await request.json()

    if payload["event"] != "payment.received":
        return {"status": "ignored"}

    payment = payload["payment"]
    checkout = payload.get("checkout", {})

    # Save payment to database
    await save_payment(
        source="numo",
        external_id=payment["paymentId"],
        amount_sats=payment["amountSats"],
        payment_type=payment["paymentType"],
        status=payment["status"],
        mint_url=payment.get("mintUrl"),
        tip_sats=payment.get("tipAmountSats", 0),
        tip_percentage=payment.get("tipPercentage", 0),
        lightning_invoice=payment.get("lightningInvoice"),
        checkout_data=checkout,
        terminal_info=payload.get("terminal"),
        timestamp=datetime.fromtimestamp(payload["timestampMs"] / 1000)
    )

    # Optionally: Trigger settlement
    if bringin_enabled:
        await settlement_service.add_payment(payment["amountSats"])

    return {"status": "received"}
```

### 6.3 Numo Webhook Payload (Reference)

```typescript
interface NumoPaymentReceivedWebhookV2 {
  event: 'payment.received';
  payloadVersion: 2;
  payment: {
    paymentId: string;
    amountSats: number;
    paymentType: 'cashu' | 'lightning';
    status: 'pending' | 'completed' | 'cancelled';
    mintUrl?: string;
    tipAmountSats: number;
    tipPercentage: number;
    basketId?: string;
    lightningInvoice?: string;
  };
  checkout?: {
    items: NumoCheckoutLineItem[];
    totalSatoshis: number;
    hasVat: boolean;
    vatBreakdown: Record<string, number>;
  };
  terminal: {
    platform: 'android';
    appPackage: string;
    appVersionName: string;
  };
}
```

---

## 7. Bringin Integration (NEW)

### 7.1 Auto-Withdrawal Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   AUTO-WITHDRAWAL (BRINGIN)                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Cron Job (hourly)                  │   │
│  └─────────────────────────┬───────────────────────────┘   │
│                            │                                 │
│                            ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  1. Get user settings                               │   │
│  │     - auto_withdrawal_enabled                        │   │
│  │     - withdrawal_threshold_eur                       │   │
│  │     - bringin_wallet_id                             │   │
│  └─────────────────────────┬───────────────────────────┘   │
│                            │                                 │
│                            ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  2. Check balance (EUR)                             │   │
│  │     GET /bringin/balance                            │   │
│  │     → Current: 87.45 €                              │   │
│  │     → Threshold: 50.00 €                           │   │
│  └─────────────────────────┬───────────────────────────┘   │
│                            │                                 │
│                            ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  3. Threshold exceeded?                              │   │
│  │     87.45 >= 50.00 → YES                            │   │
│  └─────────────────────────┬───────────────────────────┘   │
│                            │                                 │
│                            ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  4. Create payout                                   │   │
│  │     POST /bringin/payout                            │   │
│  │     { amount: 87.45, reference: "ZapOut Auto" }    │   │
│  └─────────────────────────┬───────────────────────────┘   │
│                            │                                 │
│                            ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  5. Notify user                                     │   │
│  │     "Auszahlung erfolgt: 87.45€"                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Bringin API Wrapper

```python
# backend/app/bringin.py (already exists)

class BringinClient:
    """Wrapper for Bringin API"""

    async def get_wallet_balance(self, wallet_id: str) -> float:
        """Get EUR balance"""

    async def create_payout(
        self,
        wallet_id: str,
        amount_eur: float,
        reference: str = None
    ) -> dict:
        """Create EUR payout"""

    async def add_bank_account(
        self,
        wallet_id: str,
        iban: str,
        bic: str = None
    ) -> dict:
        """Add bank account for withdrawals"""
```

---

## 8. Webhook Outbound (NEW)

```python
@app.post("/webhooks/config")
async def configure_webhook(
    url: str,
    events: list[str],  # ["payment.received", "payment.settled"]
    secret: str = None
):
    """Configure outbound webhook"""

@app.post("/webhooks/test")
async def test_webhook(webhook_id: int):
    """Send test webhook"""

async def send_webhook(user_id: int, event: str, payload: dict):
    """Send webhook to configured URL"""
    config = await get_webhook_config(user_id, event)

    if not config:
        return

    # Sign payload
    signature = hmac_sha256(config.secret, payload)

    await httpx.post(config.url, json=payload, headers={
        "Authorization": f"Bearer {signature}",
        "Content-Type": "application/json"
    })
```

---

## 9. Database Schema

### Complete Schema

```sql
-- Core Users
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    display_name TEXT,
    preferred_mint_url TEXT,
    accept_unknown_mints INTEGER DEFAULT 1,
    auto_swap_to_lightning INTEGER DEFAULT 1,
    auto_withdrawal_enabled INTEGER DEFAULT 0,
    withdrawal_threshold_eur REAL DEFAULT 50.0,
    bringin_wallet_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Passkey Auth
CREATE TABLE passkey_credentials (
    id INTEGER PRIMARY KEY,
    user_id TEXT NOT NULL,
    credential_id TEXT UNIQUE NOT NULL,
    email TEXT,
    display_name TEXT,
    public_key TEXT NOT NULL,
    prf_salt TEXT,
    counter INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP
);

CREATE TABLE passkey_challenges (
    id INTEGER PRIMARY KEY,
    challenge TEXT NOT NULL,
    user_id TEXT,
    email TEXT,
    type TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cashu Mints (NEW)
CREATE TABLE user_mints (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    mint_url TEXT NOT NULL,
    mint_name TEXT,
    is_preferred INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    last_checked TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products (NEW)
CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    name TEXT NOT NULL,
    price_cents INTEGER NOT NULL,
    price_type TEXT DEFAULT 'fiat',
    category_id INTEGER,
    vat_rate REAL DEFAULT 0.19,
    sku TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
);

-- Baskets (NEW)
CREATE TABLE baskets (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    name TEXT,
    items TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders & Payments
CREATE TABLE orders (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    total_cents INTEGER NOT NULL,
    tip_cents INTEGER DEFAULT 0,
    tip_percentage REAL,
    status TEXT DEFAULT 'pending',
    lightning_invoice TEXT,
    payment_hash TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payments (
    id INTEGER PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    method TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    source TEXT DEFAULT 'zapout',  -- 'zapout', 'numo'
    external_id TEXT,
    source_mint_url TEXT,
    swap_to_lightning INTEGER DEFAULT 0,
    tip_amount_sats INTEGER DEFAULT 0,
    lightning_invoice TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Webhooks (NEW)
CREATE TABLE webhook_configs (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    url TEXT NOT NULL,
    secret TEXT,
    events TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE webhook_logs (
    id INTEGER PRIMARY KEY,
    webhook_config_id INTEGER REFERENCES webhook_configs(id),
    event TEXT NOT NULL,
    payload TEXT,
    status TEXT,
    response_code INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 10. Security Considerations

### 10.1 Passkey Security

- Private Keys generiert vom Browser/TEE, verlassen Gerät nie
- Challenge: Server-seitig generiert, 30s Timeout
- credential.counter für Replay-Schutz
- RP ID beschränkt Passkey auf spezifische Domain

### 10.2 Cashu Security

- Tokens werden via HTTPS übertragen
- Swap prüft Fee Reserve (< 5%)
- Preimage Verifizierung nach Swap
- Private Keys nie auf Server

### 10.3 Webhook Security

- HMAC-Signatur für Outbound Webhooks
- Authorization Header für Inbound (Numo)
- Secrets werden gehasht gespeichert

---

## 11. Glossary

| Term       | Description                                                    |
| ---------- | -------------------------------------------------------------- |
| PRF        | Pseudo-Random Function - WebAuthn Extension für Key Derivation |
| Watch-Only | Wallet mit nur Public Keys, keine Private Keys                 |
| LND        | Lightning Network Daemon - Lightning Node Software             |
| Swap       | Cashu Token von Mint A → Lightning zu Mint B                   |
| Mint       | Cashu Mint Server - issuing und validating ecash tokens        |
| BOLT11     | Bitcoin Lightning Invoice Format                               |
| NUT-04/07  | Cashu Specification für Token Format                           |

---

_Letztes Update: 2026-03-19_
