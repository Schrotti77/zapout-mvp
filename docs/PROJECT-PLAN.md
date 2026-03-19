# ZapOut - Project Plan

> **Version:** 4.0 | **Datum:** 19.03.2026
> **Status:** MVP Phase 2 Complete

---

## 1. Vision

**ZapOut** ist ein modernes **Bitcoin Point-of-Sale (POS) System** für:

- 🎪 Marktstände (Flohmärkte, Weihnachtsmärkte, Festivals)
- 🏪 Ladeninhaber mit Bitcoin-fokussiertem Geschäft
- ☕ Cafés und Restaurants
- 🚚 Foodtrucks und Imbissstände
- 📱 Jeder, der Bitcoin-Zahlungen physisch entgegennehmen möchte

**Kernprinzip:** Schnell, einfach, professionell - ohne technisches Wissen bedienbar.

---

## 2. Current Status

```
Phase 1: Foundation         ████████████ 100% ✅
Phase 2: Key Management     ████████████ 100% ✅
Phase 3: Watch-Only Wallet  █████████░░░░  80% ⏳
Phase 4: Multi-Device       ░░░░░░░░░░░░░░░   0% ⏸️
Phase 5: Backup/Recovery    ░░░░░░░░░░░░░░░   0% ⏸️
Phase 6: Employee Roles     ░░░░░░░░░░░░░░░   0% ⏸️
Phase 7: POS Optimierung    ░░░░░░░░░░░░░░░   0% ⏸️
```

### Implemented Steps

| Step | Feature                     | Status | Date       |
| ---- | --------------------------- | ------ | ---------- |
| 0    | Project Setup               | ✅     | 12.03.2026 |
| 1    | Basic Auth (Email/Password) | ✅     | 12.03.2026 |
| 2    | Passkey Registration        | ✅     | 19.03.2026 |
| 3    | LND Integration             | ✅     | 19.03.2026 |
| 4    | PRF Key Derivation          | ✅     | 19.03.2026 |

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

| Feature                      | Status | Priority |
| ---------------------------- | ------ | -------- |
| POS-Kassenoberfläche         | ⏸️     | Must     |
| Produkt-Kategorien           | ⏸️     | Must     |
| Bon-Funktion                 | ⏸️     | Should   |
| Trinkgeld (+10%, +15%, +20%) | ⏸️     | Should   |
| NFC Tap-to-Add               | ⏸️     | Nice     |
| Barcode-Scanner              | ⏸️     | Nice     |
| Split Payment (LN + Cashu)   | ⏸️     | Nice     |
| Tagesbericht                 | ⏸️     | Should   |

### Phase 3.5: External Integrations (NEW)

| Feature                      | Status         | Priority |
| ---------------------------- | -------------- | -------- |
| **Bringin EUR Settlement**   | 📋 Design Done | 🔴 HIGH  |
| Bringin Wallet Connection UI | ❌             | 🔴 HIGH  |
| Auto-Settlement (EUR)        | ❌             | 🟡 MED   |
| On-Ramp (EUR → BTC)          | ❌             | 🟡 MED   |
| **Numo NFC Bridge**          | 📋 Design Done | 🟡 MED   |
| Numo Deep Link               | ❌             | 🟡 MED   |
| Numo WebNFC Reader           | ❌             | 🟡 MED   |

### Phase 8: Advanced (Backlog)

| Feature                | Status | Priority |
| ---------------------- | ------ | -------- |
| Nostr NIP-57 Receipts  | ⏸️     | Nice     |
| LNbits Integration     | ⏸️     | Nice     |
| Numo NFC Bridge        | 📋     | 🟡 MED   |
| Offline-Modus          | ⏸️     | Nice     |
| Multi-Location         | ⏸️     | Nice     |
| Bringin EUR Settlement | 📋     | 🔴 HIGH  |

---

## 4. Tech Stack

### Current

| Layer     | Technology                     |
| --------- | ------------------------------ |
| Frontend  | React + Vite + Tailwind CSS v4 |
| Backend   | FastAPI (Python)               |
| Database  | SQLite                         |
| Lightning | LND on Helmut (SSH tunnel)     |
| Cashu     | NUT-04/05/07 compatible        |
| Auth      | WebAuthn Passkey + JWT         |

### Planned

| Layer      | Technology                       |
| ---------- | -------------------------------- |
| Payments   | LND Watch-Only + Hardware Wallet |
| Backup     | Nostr Relays (encrypted)         |
| Receipts   | Nostr NIP-57                     |
| NFC        | Numo Bridge Integration          |
| Settlement | **Bringin** (EUR Auszahlung)     |

---

## 5. Screen Overview

### Current Screens

```
┌─────────────────────────────────────────┐
│  Dashboard    - Quick Amounts, QR-Code │
│  Cashu        - Token Balance, Mint     │
│  Swap         - LN ↔ Cashu Swap       │
│  Merchant     - Payment Requests        │
│  Products     - Product Management      │
│  Settings     - Account, Language       │
└─────────────────────────────────────────┘
```

### Planned Screens

```
┌─────────────────────────────────────────┐
│  POS Screen     - NEW: Produkt-Buttons │
│  Receipt View   - NEW: Bezahlt-Bestätigung │
│  Backup Flow    - NEW: Paper/Cloud Backup │
│  Recovery Flow  - NEW: Key Recovery     │
│  Staff Manager  - NEW: Employee Mgmt   │
│  Reports        - NEW: Tagesberichte    │
└─────────────────────────────────────────┘
```

---

## 6. API Endpoints

### Auth

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
POST /merchant/payment-request
GET  /merchant/payment/{hash}
```

### Cashu

```
GET  /cashu/mints
GET  /cashu/balance
POST /cashu/mint-quote
POST /cashu/verify
POST /cashu/receive
```

---

## 7. Database Schema

### Core Tables

```sql
users (id, user_id, email, password_hash, display_name, created_at)
products (id, user_id, name, price_cents, description, image_url, category, active)
cart_items (id, user_id, product_id, quantity, added_at)
orders (id, user_id, total_cents, status, lightning_invoice, payment_hash, tip_cents, created_at)
order_items (id, order_id, product_id, product_name, price_cents, quantity)
payments (id, order_id, method, amount_cents, status, created_at)
```

### Auth Tables

```sql
passkey_credentials (id, user_id, credential_id, email, display_name, public_key, prf_salt, counter, created_at, last_used)
passkey_challenges (id, challenge, user_id, email, type, expires_at, used, created_at)
passkey_users (id, user_id, email, display_name, created_at)
```

---

## 8. Design System

### Colors

| Element        | Hex       |
| -------------- | --------- |
| Primary        | `#f7931a` |
| Background     | `#0a0a0a` |
| Surface        | `#141414` |
| Surface Light  | `#1f1f1f` |
| Border         | `#222222` |
| Text           | `#ffffff` |
| Text Secondary | `#c0c0c0` |
| Text Muted     | `#666666` |
| Success        | `#22c55e` |
| Warning        | `#f59e0b` |
| Error          | `#ef4444` |

### Touch Targets

- Minimum size: 60×60px for buttons
- Border radius: 12-16px
- Grid spacing: 12px

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

## 10. Changelog

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
