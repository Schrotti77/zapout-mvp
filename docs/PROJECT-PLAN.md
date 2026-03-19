# ZapOut - Project Plan

> **Version:** 5.0 | **Datum:** 19.03.2026
> **Status:** MVP Phase 2 Complete

---

## 1. Vision

**ZapOut** ist ein modernes **Bitcoin Point-of-Sale (POS) System** mit integriertem Cashu Support, Multi-Mint Management und automatischer EUR-Auszahlung.

**Zielgruppen:**

- 🎪 Marktstände (Flohmärkte, Weihnachtsmärkte, Festivals)
- 🏪 Cafés und Restaurants mit Bitcoin-fokussiertem Angebot
- 🚚 Foodtrucks und Imbissstände
- 📱 Jeder, der Bitcoin-Zahlungen professionell entgegennehmen möchte

**Kernprinzip:** Schnell, einfach, selbstverwaltet - ohne technisches Wissen bedienbar.

---

## 2. Current Status

```
Phase 1: Foundation           ████████████ 100% ✅
Phase 2: Key Management        ████████████ 100% ✅
Phase 3: Watch-Only Wallet    █████████░░░░  80% ⏳
Phase 3.5: Cashu Management   ░░░░░░░░░░░░░░   0% 🔴
Phase 4: Multi-Device         ░░░░░░░░░░░░░░   0% ⏸️
Phase 5: Backup/Recovery      ░░░░░░░░░░░░░░   0% ⏸️
Phase 6: Employee Roles       ░░░░░░░░░░░░░░   0% ⏸️
Phase 7: POS Optimization     ░░░░░░░░░░░░░░   0% ⏸️
Phase 8: External Integrations░░░░░░░░░░░░░   0% 🟡
SEC-001: Assertion Verify      ░░░░░░░░░░░░░░   0% 🔴
WAL-001: Per-User Wallets     ░░░░░░░░░░░░░░   0% 🔴
```

### Implemented Steps

| Step | Feature                     | Status | Date       |
| ---- | --------------------------- | ------ | ---------- |
| 0    | Project Setup               | ✅     | 12.03.2026 |
| 1    | Basic Auth (Email/Password) | ✅     | 12.03.2026 |
| 2    | Passkey Registration        | ✅     | 19.03.2026 |
| 3    | LND Integration             | ✅     | 19.03.2026 |
| 4    | PRF Key Derivation          | ✅     | 19.03.2026 |

### Security Improvements (For Production)

> ⚠️ Diese Features sind für Production-Release geplant.
> Details: [`docs/FEATURES.md`](docs/FEATURES.md)

| Ticket    | Feature                         | Priority | Status             |
| --------- | ------------------------------- | -------- | ------------------ |
| `SEC-001` | WebAuthn Assertion Verification | 🔴 HIGH  | ⚠️ Not implemented |
| `WAL-001` | Per-User Watch-Only Wallets     | 🔴 HIGH  | ⚠️ Not implemented |
| `REC-001` | Seed Recovery System            | 🟡 MED   | ❌ Not planned     |
| `DEV-001` | Multi-Device Support            | 🟢 LOW   | ❌ Not planned     |

---

## 3. Feature Roadmap

### Phase 3: Watch-Only Wallet (80%)

| Feature              | Status | Priority |
| -------------------- | ------ | -------- |
| LND Invoice Creation | ✅     | Must     |
| Payment Status Check | ✅     | Must     |
| Balance Display      | ✅     | Must     |
| Watch-Only Import    | ⏳     | Should   |
| Address Generation   | ⏳     | Should   |

### Phase 3.1: Security Improvements (0%)

> ⚠️ **Für Production-Release erforderlich**
> Details: [`docs/FEATURES.md`](docs/FEATURES.md)

| Feature                             | Status  | Priority |
| ----------------------------------- | ------- | -------- |
| **SEC-001: Assertion Verification** | 🔴 HIGH | Must     |
| **WAL-001: Per-User Watch-Only**    | 🔴 HIGH | Must     |
| REC-001: Seed Recovery              | 🟡 MED  | Should   |
| DEV-001: Multi-Device Support       | 🟢 LOW  | Nice     |

**SEC-001: Assertion Verification**

```python
# Aktuell (UNSICHER):
def prf_login(data: PRFLoginRequest):
    credential = db.query(...).first()
    return {"token": create_token(...)}  # Keine Verifizierung!

# Ziel (SICHER):
def prf_login(data: PRFLoginRequest):
    # 1. Client Data JSON verifizieren
    client_data = verify_client_data(data.credential.response.clientDataJSON)

    # 2. Authenticator Data parsen
    auth_data = parse_auth_data(data.credential.response.authenticatorData)

    # 3. Signatur mit Public Key verifizieren
    verify_signature(auth_data, client_data, credential.public_key)

    return {"token": create_token(...)}
```

**WAL-001: Per-User Watch-Only Wallets**

```
Aktuell (SHARED):              Ziel (PER-USER):
User A ──┐                     User A ──► Watch-Only-A (pubkey)
User B ──┼──► Helmut LND      User B ──► Watch-Only-B (pubkey)
User C ──┘                     User C ──► Watch-Only-C (pubkey)
                               │
                               └──► Alle → Helmut LND (via Submarine Swap)
```

### Phase 3.5: Cashu Management (50%)

> **Übernommen von Numo** - Multi-Mint Support und Auto-Swap
> **Helmut Mint läuft:** `http://100.74.149.69:3338` (cdk-mintd v0.15.0)

| Feature                         | Status | Priority | Quelle |
| ------------------------------- | ------ | -------- | ------ |
| **Helmut Mint Setup**           | ✅     | 🔴 HIGH  | -      |
| **Mint Management UI**          | ✅     | 🔴 HIGH  | -      |
| **Add/Remove Mints**            | ✅     | 🔴 HIGH  | -      |
| **Preferred Mint Selection**    | ✅     | 🔴 HIGH  | -      |
| **Balance per Mint**            | 🔴     | 🟡 MED   | Numo   |
| **Swap to Lightning**           | ⚠️ 50% | 🔴 HIGH  | Numo   |
| **Accept Unknown Mints Toggle** | ✅     | 🔴 HIGH  | -      |
| Mint Health Check               | 🔴     | 🟡 MED   | -      |

**Helmut Mint Status:**

- ✅ cdk-mintd läuft auf Port 3338
- ✅ LND Backend verbunden (SynapseLN)
- ✅ Öffentlich erreichbar
- ✅ Swap Engine implementiert (`POST /cashu/pay`)
- ⚠️ NUT-05 Melt funktioniert, aber testnut FakeWallet
- ⚠️ Helmut Mint Token können nicht lokal getestet werden
- 🔴 Monitoring/Backups fehlen

**Swap to Lightning - Einschränkungen:**

```
Cross-Mint Swap (Token von Mint X → Lightning) erfordert:
1. Mint X muss Lightning haben + externe Invoices akzeptieren
2. Die meisten public Mints sind FakeWallet oder offline
3. Real Swap: NUT-05 Melt mit echter Lightning-Anbindung
```

**Swap Optionen:**
| Option | Beschreibung | Status |
|--------|--------------|--------|
| Same-Mint | Nur Helmut Mint akzeptieren | ✅ Jetzt |
| Melt at Mint | Kunde meltet bei eigener Mint | ⚠️ Komplex |
| Managed Mint | Wir hosten Mint für Kunden | 💡 Service-Idee |

**→ Siehe:** `docs/HELMUT-MINT.md` für Details + Service-Potential

### Phase 4: Multi-Device (0%)

| Feature                  | Status | Priority |
| ------------------------ | ------ | -------- |
| Backup Device Setup      | ⏸️     | Must     |
| Device Sync Protocol     | ⏸️     | Must     |
| Device Management UI     | ⏸️     | Should   |
| Primary/Backup Selection | ⏸️     | Should   |

### Phase 5: Backup & Recovery (0%)

| Feature                  | Status | Priority |
| ------------------------ | ------ | -------- |
| Paper Backup (12 words)  | ⏸️     | Must     |
| Cloud Backup (encrypted) | ⏸️     | Should   |
| Recovery Flow UI         | ⏸️     | Must     |
| Backup Reminder Schedule | ⏸️     | Should   |
| Emergency Kit            | ⏸️     | Should   |

### Phase 6: Employee Roles (0%)

| Feature                          | Status | Priority |
| -------------------------------- | ------ | -------- |
| Staff Account Creation           | ⏸️     | Must     |
| PIN-Code Auth for Staff          | ⏸️     | Must     |
| Role Permissions (Cashier/Admin) | ⏸️     | Should   |
| Shift Management                 | ⏸️     | Nice     |
| Audit Log                        | ⏸️     | Nice     |

### Phase 7: POS Optimization (0%)

| Feature                     | Status | Priority | Quelle |
| --------------------------- | ------ | -------- | ------ |
| **Tips (+10%, +15%, +20%)** | ✅     | 🔴 HIGH  | Numo   |
| **Product Catalogs**        | ✅     | 🔴 HIGH  | Numo   |
| **Basket System**           | ✅     | 🟡 MED   | Numo   |
| POS-Kassenoberfläche        | ⏸️     | Must     | -      |
| Produkt-Kategorien          | ⏸️     | Must     | -      |
| **VAT/MwSt Support**        | ✅     | 🟡 MED   | Numo   |
| Bon-Funktion                | ⏸️     | Should   | -      |
| Tagesbericht                | ⏸️     | Should   | -      |
| NFC Tap-to-Add              | ⏸️     | Nice     | Numo   |
| Barcode-Scanner             | ⏸️     | Nice     | -      |
| Split Payment (LN + Cashu)  | ⏸️     | Nice     | -      |

### Phase 8: External Integrations (0%)

| Feature                         | Status         | Priority | Quelle |
| ------------------------------- | -------------- | -------- | ------ |
| **Bringin EUR Settlement**      | 📋 Design Done | 🔴 HIGH  | -      |
| Bringin Wallet Connection       | ❌             | 🔴 HIGH  | -      |
| **Auto-Withdrawal (Threshold)** | ❌             | 🟡 MED   | Numo   |
| On-Ramp (EUR → BTC)             | ❌             | 🟡 MED   | -      |
| **Numo Webhook Receiver**       | ❌             | 🟡 MED   | Numo   |
| Numo Deep Link                  | ❌             | 🟡 MED   | Numo   |
| **Webhook Outbound**            | ❌             | 🟡 MED   | Numo   |
| Nostr NIP-57 Receipts           | ❌             | 🟢 Nice  | Numo   |
| LNbits Integration              | ❌             | 🟢 Nice  | -      |
| Offline-Modus                   | ⏸️             | 🟢 Nice  | -      |
| Multi-Location                  | ⏸️             | 🟢 Nice  | -      |
| **BTCPay Server**               | 📋 Analysed    | 🟢 Nice  | BTCPay |
| **Blink LN Backend**            | 📋 Analysed    | 🟢 Nice  | Blink  |

**BTCPay Server & Blink:** Siehe `docs/BTCPAY_BLINK_ANALYSIS.md`

---

## 4. Feature Details (Numo-Übernahmen)

### 4.1 Tips (Trinkgeld)

**Numo bietet:** `+10%`, `+15%`, `+20%`, Custom Amount

**ZapOut UI:**

```
┌─────────────────────────────────────────┐
|  💰 5.00 €                              │
├─────────────────────────────────────────┤
|  [+10%]  [+15%]  [+20%]  [Custom]       │
│                                         │
│  Basis:      5.00 €                     │
│  +20% Tip:   1.00 €                     │
│  ─────────────────                       │
│  Gesamt:     6.00 € / 13,914 sats      │
├─────────────────────────────────────────┤
|           [ ⚡ Bezahlen ]                │
└─────────────────────────────────────────┘
```

**Backend:**

```python
TIP_PRESETS = [0.10, 0.15, 0.20]  # Percentages

@app.post("/merchant/payment-request")
async def create_payment_request(
    amount_cents: int,
    tip_percentage: Optional[float] = None,
    tip_custom_sats: Optional[int] = None,
):
    tip_amount = 0
    if tip_percentage:
        tip_amount = int(amount_cents * tip_percentage)
    elif tip_custom_sats:
        tip_amount = tip_custom_sats

    total_cents = amount_cents + tip_amount
```

### 4.2 Mint Management

Numo erlaubt: Mehrere Mints, Preferred Mint, "Accept unknown mints" Toggle

**Settings UI:**

```
┌─────────────────────────────────────────┐
|  🏦 Cashu Mint Einstellungen             │
├─────────────────────────────────────────┤
│  Verbundene Mints:                      │
│  ┌─────────────────────────────────┐    │
│  │ ✅ Cashu.HOST (Preferred)       │    │
│  │    Balance: 12,345 sats        │    │
│  ├─────────────────────────────────┤    │
│  │ ☐ NUTstash Mint                │    │
│  │    Balance: 0 sats             │    │
│  └─────────────────────────────────┘    │
│  [+ Mint hinzufügen]                    │
│  ─────────────────────────────────────  │
│  ◉ Accept payments from any mint        │
│    (Auto-Swap zu Lightning)             │
│  ◉ Nur akzeptierte Mints               │
└─────────────────────────────────────────┘
```

**Database Schema:**

```sql
CREATE TABLE user_mints (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    mint_url TEXT NOT NULL,
    is_preferred INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN accept_unknown_mints INTEGER DEFAULT 1;
```

### 4.3 Swap to Lightning (Numo Killer-Feature)

Akzeptiert Token von ANY Mint, swapped automatisch zu Lightning.

**Flow:**

```
Customer Token (Mint X)     ZapOut
      │                        │
      │ Token (ecash)          │
      │ ──────────────────────▶│
      │                        │
      │         1. Decode Token
      │         2. Get Lightning Invoice from LND
      │         3. Melt Token at Source Mint
      │         4. Receive sats on LND
      │                        │
      │         ✅ Payment Success
      │ ◀──────────────────────│
```

**Backend:**

```python
async def swap_unknown_mint_token(
    token: str,
    amount_sats: int,
):
    # 1. Decode token to get mint URL
    decoded = decode_token(token)
    source_mint_url = decoded["mint"]

    # 2. Get Lightning invoice from LND
    lnd_invoice = await lnd_client.add_invoice(
        value=amount_sats,
        memo="ZapOut Swap",
        expiry=600
    )

    # 3. Create melt quote at source mint
    melt_quote = await melt_quote_at_mint(
        mint_url=source_mint_url,
        invoice=lnd_invoice.payment_request
    )

    # 4. Execute melt
    melt_result = await melt_token(
        mint_url=source_mint_url,
        quote_id=melt_quote.id,
        token=token
    )

    return {"success": melt_result.paid}
```

### 4.4 Auto-Withdrawal (Bringin)

Numo: Threshold-basiert → automatisch auf Lightning Address auszahlen

**ZapOut mit Bringin:**

```
┌─────────────────────────────────────────┐
|  💰 Auto-Auszahlung                      │
├─────────────────────────────────────────┤
│  Status:        [EIN] [AUS]             │
│  Threshold:     50 €                    │
│  ┌─────────────────────────────────┐    │
│  │ Balance: 87.45 €                │    │
│  │ Wallet: DE89 002...            │    │
│  └─────────────────────────────────┘    │
│  Letzte: 18.03.2026 (45 €)            │
└─────────────────────────────────────────┘
```

### 4.5 Numo Webhook Receiver

Numo sendet Webhooks bei payment.received. ZapOut kann diese empfangen.

```python
@app.post("/webhooks/numo")
async def receive_numo_webhook(payload: dict):
    """
    Empfängt Numo payment.received Webhooks
    Numo als NFC-Terminal, ZapOut als Management
    """
    if payload["event"] != "payment.received":
        return {"status": "ignored"}

    payment = payload["payment"]

    await save_payment(
        amount_sats=payment["amountSats"],
        payment_type=payment["paymentType"],
        source="numo",
        external_id=payment["paymentId"],
        tip_sats=payment.get("tipAmountSats", 0)
    )
```

### 4.6 VAT/MwSt Support (Numo)

Numo berechnet MWSt automatisch:

```typescript
interface NumoCheckoutLineItem {
  netPriceCents: number;
  vatRate: number; // 0.19 = 19%
  vatPerUnitCents: number;
  totalVatCents: number;
}

// ZapOut:
// 19% MWSt (Deutschland Standard)
// 7% MWSt (Ermäßigt, z.B. Speisen)
```

### 4.7 Product Catalogs (Numo)

**Database Schema:**

```sql
CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    name TEXT NOT NULL,
    price_cents INTEGER NOT NULL,
    price_type TEXT DEFAULT 'fiat',  -- 'fiat' or 'sats'
    category_id INTEGER REFERENCES categories(id),
    vat_rate REAL DEFAULT 0.19,
    sku TEXT,
    is_active INTEGER DEFAULT 1
);

CREATE TABLE categories (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
);

CREATE TABLE variations (
    id INTEGER PRIMARY KEY,
    product_id INTEGER REFERENCES products(id),
    name TEXT NOT NULL,
    price_adjustment_cents INTEGER DEFAULT 0
);
```

### 4.8 Basket System (Numo)

Warenkorb der persistent ist:

```sql
CREATE TABLE baskets (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    name TEXT,  -- "Tisch 3", "Stammtisch"
    items TEXT NOT NULL,  -- JSON
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5. Tech Stack

### Current

| Layer     | Technology                     |
| --------- | ------------------------------ |
| Frontend  | React + Vite + Tailwind CSS v4 |
| Backend   | FastAPI (Python)               |
| Database  | SQLite                         |
| Lightning | LND on Helmut (SSH tunnel)     |
| Cashu     | NUT-04/05/07 compatible        |
| Auth      | WebAuthn Passkey + JWT         |

### Planned (from Numo)

| Layer      | Technology                       |
| ---------- | -------------------------------- |
| Cashu Swap | cashu-ts melt/swap               |
| Payments   | LND Watch-Only + Hardware Wallet |
| Backup     | Nostr Relays (encrypted)         |
| Receipts   | Nostr NIP-57                     |
| NFC        | Numo Bridge Integration          |
| Settlement | **Bringin** (EUR Auszahlung)     |
| Webhooks   | Outbound + Numo Inbound          |

---

## 6. API Endpoints

### Auth (Complete)

```
POST /auth/register
POST /auth/login
POST /auth/passkey/register
POST /auth/passkey/login
POST /auth/passkey/prf/register
POST /auth/passkey/prf/login
GET  /auth/passkey/wallet
```

### Products

```
GET    /products
POST   /products
PUT    /products/{id}
DELETE /products/{id}
```

### Cart

```
GET    /cart
POST   /cart/items
DELETE /cart/items/{id}
DELETE /cart
POST   /cart/checkout
```

### Payments

```
POST /merchant/payment-request     # Neu: tip_percentage
GET  /merchant/payment/{hash}
```

### Cashu (NEW)

```
GET  /cashu/mints                   # User's connected mints
POST /cashu/mints                   # Add mint
DELETE /cashu/mints/{id}           # Remove mint
GET  /cashu/balance                # Balance per mint
GET  /cashu/balance/all             # Total balance all mints
POST /cashu/swap                    # Swap token to Lightning
POST /cashu/receive                # Receive token
```

### Webhooks (NEW)

```
POST /webhooks/numo                 # Receive Numo payments
POST /webhooks/outbound             # Send payment webhooks
GET  /webhooks/config               # Configure outgoing webhooks
```

### Bringin (NEW)

```
POST /bringin/wallet                # Create Bringin wallet
GET  /bringin/balance               # Wallet balance
POST /bringin/payout               # Manual payout
GET  /bringin/auto-withdrawal      # Get settings
PUT  /bringin/auto-withdrawal      # Update threshold/settings
```

---

## 7. Database Schema

### Core Tables

```sql
users (id, user_id, email, password_hash, display_name,
      preferred_mint_url, accept_unknown_mints,
      auto_withdrawal_enabled, withdrawal_threshold_eur,
      bringin_wallet_id, created_at)

products (id, user_id, name, price_cents, price_type,
          category_id, vat_rate, sku, is_active, created_at)

categories (id, user_id, name, sort_order)
variations (id, product_id, name, price_adjustment_cents)

cart_items (id, user_id, product_id, quantity, added_at)
orders (id, user_id, total_cents, tip_cents, tip_percentage,
        status, lightning_invoice, payment_hash, created_at)
order_items (id, order_id, product_id, product_name, price_cents, quantity)
payments (id, order_id, method, amount_cents, status,
          source_mint_url, swap_to_lightning, external_id, created_at)
```

### Cashu Tables (NEW)

```sql
user_mints (id, user_id, mint_url, is_preferred, is_active, created_at)

CREATE INDEX idx_user_mints_user ON user_mints(user_id);
CREATE INDEX idx_user_mints_preferred ON user_mints(user_id, is_preferred);
```

### Webhook Tables (NEW)

```sql
webhook_configs (id, user_id, url, secret, events, is_active, created_at)
webhook_logs (id, webhook_config_id, event, payload, status, response, created_at)
```

### Auth Tables

```sql
passkey_credentials (id, user_id, credential_id, email, display_name,
                    public_key, prf_salt, counter, created_at, last_used)
passkey_challenges (id, challenge, user_id, email, type, expires_at, used)
passkey_users (id, user_id, email, display_name, created_at)
```

---

## 8. Screen Overview

### Current Screens

```
┌─────────────────────────────────────────┐
│  Dashboard    - Quick Amounts, QR-Code │
│  Cashu        - Token Balance, Mint     │
│  Swap         - LN ↔ Cashu Swap       │
│  Merchant     - Payment Requests        │
│  Products     - Product Management       │
│  Settings     - Account, Language       │
└─────────────────────────────────────────┘
```

### New Screens (from Numo)

```
┌─────────────────────────────────────────┐
│  POS Screen     - NEW: Product-Buttons  │
│                 - NEW: Tips UI          │
│                 - NEW: Basket           │
│  Mint Settings  - NEW: Multi-Mint Mgmt  │
│  Receipt View   - NEW: Payment Confirm   │
│  Backup Flow    - NEW: Paper/Cloud       │
│  Recovery Flow  - NEW: Key Recovery      │
│  Staff Manager  - NEW: Employee Mgmt    │
│  Reports        - NEW: Tagesberichte    │
│  Auto-Withdraw  - NEW: Bringin Settings │
│  Webhooks       - NEW: Outbound Config  │
│  Numo Devices   - NEW: Paired Terminals │
└─────────────────────────────────────────┘
```

---

## 9. Deployment

### Helmut (Umbrel Server)

```
Services:
- LND (SynapseLN) - Lightning Node
- LNbits - Alternative Wallet UI
- Cashu Mint - Self-hosted e-cash

Access:
- SSH Tunnel for backend
- Tor hidden service for remote
```

### Frontend

```
Platforms: PWA (Web)
Deployment: Static build
Install: Add to Home Screen
Offline: Service Worker cache
```

---

## 10. Implementation Priority

| Feature           | Komplexität | Nutzen  | Priorität |
| ----------------- | ----------- | ------- | --------- |
| Tips              | 1 Tag       | Hoch    | 🔴 NOW    |
| Mint Management   | 1 Tag       | Hoch    | 🔴 NOW    |
| Swap to Lightning | 2 Tage      | Hoch    | 🔴 NOW    |
| Numo Webhook      | 1 Tag       | Mittel  | 🟡 Soon   |
| Auto-Withdrawal   | 2 Tage      | Mittel  | 🟡 Soon   |
| Product Catalogs  | 3 Tage      | Hoch    | 🟡 Soon   |
| Basket System     | 2 Tage      | Mittel  | 🟢 Later  |
| VAT Support       | 3 Tage      | Mittel  | 🟢 Later  |
| Nostr Receipts    | 2 Tage      | Niedrig | ⚪ Nice   |

---

## 11. Changelog

### v5.1 (19.03.2026)

- **NEU:** `docs/FEATURES.md` - Security & Wallet Feature Requests
- **NEU:** Phase 3.1: Security Improvements (SEC-001, WAL-001)
- **UPDATE:** Current Status mit Security-Tickets

### v5.0 (19.03.2026)

- **NEU:** Phase 3.5 Cashu Management (Mint Management + Swap)
- **NEU:** Tip-Funktion (von Numo)
- **NEU:** Swap to Lightning ANY Mint (von Numo)
- **NEU:** Numo Webhook Receiver
- **NEU:** Auto-Withdrawal mit Bringin
- **NEU:** Product Catalogs + Basket System + VAT (von Numo)
- **NEU:** Webhooks Outbound
- Komplette Feature-Integration von Numo-Analyse

### v4.0 (19.03.2026)

- Complete documentation restructure
- Added ARCHITECTURE.md
- Updated STATUS.md
- Consolidated PROJECT-PLAN.md

### v3.0 (18.03.2026)

- Konzept überarbeitet: E-Commerce → Bitcoin POS
- POS-Screens definiert
- Feature-Prioritäten neu geordnet

### v2.0 (17.03.2026)

- Lightning Payments (echte LND Invoices)
- Cashu Integration
- UI/UX komplett neu

### v1.0 (12.03.2026)

- Initial MVP
- Basic Auth
- Mock Cashu

---

_Letztes Update: 2026-03-19_
