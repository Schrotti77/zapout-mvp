# ZapOut - Technical Architecture

> **Version:** 1.0 | **Datum:** 19.03.2026
> **Status:** Aktuell - LND + Passkey PRF

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
│  │    publicKey: {                                           │  │
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
│  │  │ Passkey     │  │ Auth        │  │ Payment          │  │  │
│  │  │ Auth        │  │ (JWT)       │  │ (LND + Cashu)    │  │  │
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
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Key Architecture Decision

### Gewählt: Watch-Only Wallet via LND

**Warum nicht Breez SDK Spark?**

- Wir haben bereits LND auf Helmut (SynapseLN)
- Selbst-gehostet = mehr Kontrolle
- Keine Abhängigkeit von externen Services für Lightning
- Kostenlos (keine Greenlight/Breez Gebühren)

**Trade-offs:**

- ⚠️ Kein Native Passkey Login (wie bei Breez SDK)
- ✅ Aber: Passkey PRF + Watch-Only funktioniert gut
- ✅ Keys werden aus Passkey abgeleitet (nicht gespeichert)
- ⚠️ Watch-Only = muss mit Hardware Wallet signieren für Senden

---

## 3. Passkey + PRF Flow

### 3.1 Registration Flow

```
MERCHANT                                    BACKEND
   │                                           │
   │  1. GET /auth/passkey/challenge/register?email=xxx
   │ ─────────────────────────────────────────▶
   │                                           │
   │   ◀── { challenge, rpId, timeout }
   │                                           │
   │  2. navigator.credentials.create({        │
   │       publicKey: {                        │
   │         challenge: server_challenge,       │
   │         rp: { name: "ZapOut", id: "xxx" },│
   │         user: { id: email_bytes, name },  │
   │         pubKeyCredParams: [{alg: -7}],    │
   │         extensions: {                      │
   │           prf: {                          │
   │             eval: { first: challenge }    │
   │           }                              │
   │         }                                 │
   │       }                                   │
   │     })
   │ ─────────────────────────────────────────▶
   │       POST /auth/passkey/register          │
   │       { credential, email }                │
   │                                           │
   │   ◀── { token }                           │
   │                                           │
   │  3. Save credentialId in localStorage     │
   │                                           │
   │  4. PRF Result in credential:              │
   │     const prfResult =                      │
   │       credential.getClientExtensionResults │
   │         ().prf.results.first               │
   │                                           │
   │  5. Store prf_salt (from server) locally  │
```

### 3.2 Login Flow

```
MERCHANT                                    BACKEND
   │                                           │
   │  1. credentialId from localStorage        │
   │       GET /auth/passkey/challenge/authenticate?credentialId=xxx
   │ ─────────────────────────────────────────▶
   │                                           │
   │   ◀── { challenge, allowCredentials }
   │                                           │
   │  2. navigator.credentials.get({            │
   │       publicKey: {                         │
   │         challenge: server_challenge,       │
   │         allowCredentials: [{id, type}],    │
   │         extensions: {                      │
   │           prf: { eval: { first: challenge } }
   │         }                                 │
   │       }                                   │
   │     })
   │ ─────────────────────────────────────────▶
   │       POST /auth/passkey/login            │
   │       { credential, prfResult }            │
   │                                           │
   │  3. Backend verifies signature            │
   │     and PRF with stored salt               │
   │                                           │
   │   ◀── { token }                           │
```

### 3.3 PRF Key Derivation

```javascript
// Frontend: PRF Extension liefert Result
const prfResult = credential.getClientExtensionResults().prf.results.first;
// prfResult = Uint8Array (32 bytes)

// Server: Seed ableiten mit HMAC-SHA512
function deriveSeed(prfResult, salt) {
  return hmac_sha512(salt, prfResult); // 64 bytes → first 32 = BIP32 seed
}
```

---

## 4. Watch-Only Wallet

### 4.1 Wie es funktioniert

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
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
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ XPUB (nur Public Keys)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     HELMUT (LND)                            │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  importwallet (watch-only)                           │  │
│  │                                                     │  │
│  │  Watch: m/44'/0'/0'/0/* (receive addresses)         │  │
│  │                                                     │  │
│  │  Result: LND zeigt Balance, kann empfangen           │  │
│  │          Aber: CANNOT SPEND (no private keys)        │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  Für Senden: Hardware Wallet (Numo, BitBox02, etc.)         │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Warum Watch-Only?

| Aspekt       | Full Node | Watch-Only | Breez SDK Spark |
| ------------ | --------- | ---------- | --------------- |
| Private Keys | On Server | On Device  | On Device       |
| Senden       | ✅        | ❌         | ✅              |
| Empfangen    | ✅        | ✅         | ✅              |
| Komplexität  | Hoch      | Niedrig    | Niedrig         |
| Self-Custody | ⚠️ Server | ✅ Device  | ✅ Device       |

**Kompromiss:** Merchant kann empfangen (Watch-Only reicht für POS). Für Senden muss Hardware Wallet ran.

---

## 5. Database Schema

### Users

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,  -- UUID
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    display_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Passkey Credentials

```sql
CREATE TABLE passkey_credentials (
    id INTEGER PRIMARY KEY,
    user_id TEXT NOT NULL,
    credential_id TEXT UNIQUE NOT NULL,
    email TEXT,
    display_name TEXT,
    public_key TEXT NOT NULL,
    prf_salt TEXT,              -- Salt für PRF key derivation
    counter INTEGER DEFAULT 0,  -- Sign counter (replay protection)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP
);
```

### Passkey Challenges

```sql
CREATE TABLE passkey_challenges (
    id INTEGER PRIMARY KEY,
    challenge TEXT NOT NULL,
    user_id TEXT,
    email TEXT,
    type TEXT NOT NULL,         -- 'register' or 'authenticate'
    expires_at TIMESTAMP NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Passkey Users

```sql
CREATE TABLE passkey_users (
    id INTEGER PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    display_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. API Reference

### Authentication Endpoints

#### POST /auth/passkey/register

Register a new passkey credential.

**Request:**

```json
{
  "email": "merchant@cafe.de",
  "display_name": "Café Berlin",
  "credential": {
    "id": "credential_id",
    "rawId": "base64_raw_id",
    "response": {
      "attestationObject": "base64_attestation",
      "clientDataJSON": "base64_client_data"
    },
    "type": "public-key"
  }
}
```

**Response:**

```json
{
  "success": true,
  "token": "jwt_token_here"
}
```

#### POST /auth/passkey/login

Authenticate with passkey.

**Request:**

```json
{
  "credential": {
    "id": "credential_id",
    "rawId": "base64_raw_id",
    "response": {
      "authenticatorData": "base64_auth_data",
      "clientDataJSON": "base64_client_data",
      "signature": "base64_signature",
      "userHandler": "base64_user_handle"
    },
    "type": "public-key"
  }
}
```

**Response:**

```json
{
  "success": true,
  "token": "jwt_token_here"
}
```

#### GET /auth/passkey/challenge/register

Get registration challenge.

**Query Parameters:**

- `email` (required): Merchant email

**Response:**

```json
{
  "challenge": "base64_urlsafe_challenge",
  "rp_id": "zapout.local",
  "rp_name": "ZapOut",
  "user_id": "base64_email_bytes",
  "timeout": 60000
}
```

#### GET /auth/passkey/challenge/authenticate

Get authentication challenge.

**Query Parameters:**

- `credential_id` (required): Previously registered credential ID

**Response:**

```json
{
  "challenge": "base64_urlsafe_challenge",
  "rp_id": "zapout.local",
  "timeout": 60000,
  "allow_credentials": [
    {
      "id": "credential_id",
      "type": "public-key"
    }
  ]
}
```

#### GET /auth/passkey/wallet

Get LND wallet info for authenticated user.

**Headers:**

- `Authorization: Bearer <jwt_token>`

**Response:**

```json
{
  "pubkey": "03534ada4a452825de8133701b1a8ca1dfd916336045e6a6f562fdb734ec0bc9f3",
  "alias": "SynapseLN",
  "balance_sats": 150000,
  "num_channels": 3,
  "watch_only": true
}
```

### Payment Endpoints

#### POST /merchant/payment-request

Create Lightning invoice via LND.

**Headers:**

- `Authorization: Bearer <jwt_token>`

**Request:**

```json
{
  "amount_cents": 500,
  "method": "lightning",
  "memo": "Bestellung #123"
}
```

**Response:**

```json
{
  "invoice": "lnbc5u1p5mhjvgpp5...",
  "payment_hash": "2f32c86de02430cfa390ecaf748e0f316b4ce00a6e19ba72557b800dae455fbe",
  "amount_sats": 2100,
  "expires_at": "2026-03-19T12:00:00Z"
}
```

---

## 7. Security Considerations

### 7.1 Passkey Security

- **Private Keys:** Werden vom Browser/TEE generiert, verlassen das Gerät nie
- **Challenge:** Server-seitig generiert, 30s Timeout
- **Replay Protection:** credential.counter wird geprüft
- **RP ID:** Beschränkt Passkey auf spezifische Domain

### 7.2 JWT Security

- **Expiry:** 24 hours
- **Refresh:** Email-based für Passkey-User
- **Storage:** HttpOnly cookie (backend) oder secure storage (frontend)

### 7.3 Watch-Only Limitation

- **Empfangen:** ✅ Funktioniert
- **Senden:** ❌ Braucht Hardware Wallet
- **Risiko:** Wenn Server kompromittiert, nur Public Keys exposed

---

## 8. Helmut Integration

### SSH Tunnel Setup

```python
import sshtunnel

with sshtunnel.SSHTunnelForwarder(
    ("helmut-tail", 22),
    ssh_username="umbrel",
    ssh_pkey="/home/user/.ssh/umbrel_tunnel",
    remote_bind_address=("127.0.0.1", 10009)
) as tunnel:
    # LND RPC via tunnel
    lnd = grpc.insecure_channel(
        f"localhost:{tunnel.local_bind_port}"
    )
```

### LND Container

```
Container: lightning_lnd_1
RPC Port: 10009
REST Port: 8080
gRPC Port: 10009
Lightning Port: 9735
```

---

## 9. Future: Multi-Device Architecture

Geplant für Step 4:

```
┌─────────────────────────────────────────────────────────────────┐
│                     MERCHANT ECOSYSTEM                           │
│                                                                 │
│  ┌─────────────┐                                                │
│  │ Main Device │ ◀── Primary Passkey + Wallet                   │
│  │  (Tablet)   │                                                │
│  └──────┬──────┘                                                │
│         │                                                        │
│         │ Backup Sync (Nostr?)                                   │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────┐                                                │
│  │ Backup      │ ◀── Secondary Passkey                          │
│  │ (Phone)     │     Kann bei Verlust des Main Devices          │
│  └─────────────┘     als Fallback dienen                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. Glossary

| Term       | Description                                                    |
| ---------- | -------------------------------------------------------------- |
| PRF        | Pseudo-Random Function - WebAuthn Extension für Key Derivation |
| Watch-Only | Wallet mit nur Public Keys, keine Private Keys                 |
| LND        | Lightning Network Daemon - Lightning Node Software             |
| RP         | Relying Party - Der Server/Dienst der Passkeys verwendet       |
| BIP32      | Bitcoin Improvement Proposal - Hierarchische Wallet Struktur   |

---

_Letztes Update: 2026-03-19_
