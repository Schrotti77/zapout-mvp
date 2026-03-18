# ZapOut - Projektplan v2.0 (CashuBTC Integration)

> **Version:** 2.2 | **Datum:** 18.03.2026 | **Status:** Lightning Payments Fully Working

---

## ✅ Aktueller Stand (18.03.2026)

### Authentication & Core

| Feature                 | Status | Details                                   |
| ----------------------- | ------ | ----------------------------------------- |
| User Auth (JWT)         | ✅     | Login/Register, Token-based               |
| Lightning Payments      | ✅     | **LND on Helmut via SSH (REAL INVOICES)** |
| QR Code Display         | ✅     | qrcode library                            |
| Transaction History     | ✅     | Payment records                           |
| EUR Payouts             | ✅     | IBAN support (50€ demo)                   |
| **Live BTC Conversion** | ✅     | CoinGecko API in PaymentModal             |

### Cashu Integration (Phase 2)

| Feature             | Status | Details                       |
| ------------------- | ------ | ----------------------------- |
| NUT-04 (mint-quote) | ✅     | Lightning → Cashu             |
| NUT-05 (melt-quote) | ✅     | Cashu → Lightning             |
| NUT-07 Token Check  | ✅     | `/cashu/verify` endpoint      |
| Multi-Mint Support  | ✅     | testnut, 8333.space, cashu.me |
| Token Receive       | ✅     | `/cashu/receive` endpoint     |
| Balance Display     | ✅     | Per-user cashu balance        |

### Merchant Features (Phase 1)

| Feature         | Status | Details                        |
| --------------- | ------ | ------------------------------ |
| Products CRUD   | ✅     | Full Create/Read/Update/Delete |
| Shopping Cart   | ✅     | Add items, checkout            |
| Quick Amounts   | ✅     | 5, 10, 20, 50, 100, 200€       |
| Payment Request | ✅     | QR-Code generation             |
| Order History   | ✅     | Via `/orders` endpoint         |

### UI/UX Redesign (17.03.2026)

| Feature           | Status | Details                            |
| ----------------- | ------ | ---------------------------------- |
| Consistent Layout | ✅     | All 5 screens now match            |
| Dark Theme        | ✅     | #0a0a0a background, #141414 cards  |
| Bitcoin Orange    | ✅     | #f7931a accent color               |
| UI Components     | ✅     | Button, Card, Input, Badge, Loader |
| Responsive        | ✅     | Mobile-first design                |

---

## 🔧 Bug Fixes (18.03.2026)

### Kritische Fixes

| Bug                            | Status | Lösung                                      |
| ------------------------------ | ------ | ------------------------------------------- |
| Login failures (test2@cafe.de) | ✅     | SHA256 fallback in verify_password()        |
| Checkout 404 errors            | ✅     | Cart/Checkout endpoints restored            |
| Payment response format        | ✅     | Added amount_cents, amount_sats, bolt11     |
| Merchant payment-request       | ✅     | New endpoints added                         |
| Cart shows wrong prices/names  | ✅     | Fixed item.price_cents, item.name, quantity |
| PaymentModal Live-Conversion   | ✅     | CoinGecko API integration                   |
| **/payments endpoint missing** | ✅     | **Implemented with real LND invoices**      |

### LND Integration Details

- **Host:** Helmut (100.74.149.69) via SSH
- **Connection:** `ssh helmut-tail "lncli..."`
- **Invoice Creation:** `create_lnd_invoice(sats, memo)` function
- **Memo:** Replaced spaces with underscores to avoid hex encoding issues

---

## 📱 Screens Übersicht

### 1. Zahlung (Dashboard)

- Quick Amounts: 5, 10, 20, 50, 100, 200€
- Custom amount input
- Lightning Invoice creation
- Payment status polling

### 2. Cashu

- Balance display
- Multi-Mint selector (testnut, 8333.space, cashu.me)
- Cashu generieren (Lightning → Cashu)
- Token einlösen (NUT-07 verification)

### 3. Swap

- Balance display (Lightning + Cashu)
- Lightning → Cashu (Deposit)
- Cashu → Lightning (Withdraw)
- Real API calls to backend

### 4. Händler (Merchant)

- Quick payment (QR-Code)
- Quick Amounts: 5, 10, 20, 50, 100, 200€
- Products management link
- Orders management link

### 5. Produkte (Products)

- Product list with prices
- Add/Edit/Delete products
- Add to cart functionality
- Active/Inactive toggle

---

## 🎯 Phase 3: UX Verbesserungen (IN ARBEIT)

### 3.1 UI Consistency

| Feature           | Status           |
| ----------------- | ---------------- |
| Consistent Layout | ✅ Abgeschlossen |
| Dark Theme        | ✅ Abgeschlossen |
| Component Library | ✅ Abgeschlossen |

### 3.2 PWA Support

- Service Worker - **Nicht begonnen**
- Offline-Fallback - **Nicht begonnen**
- Installierbar als App - **Nicht begonnen**

### 3.3 i18n (Internationalization)

- Deutsche Labels - ✅
- Englisch - **Nicht begonnen**
- Weitere Sprachen - **Nicht begonnen**

### 3.4 WebSocket Updates (NUT-17)

- Real-time Payment Status - **Nicht begonnen**
- Balance Updates ohne Refresh - **Nicht begonnen**

---

## 🚀 Phase 4: Erweiterungen (Future)

### 4.1 NFC Tap-2-Pay (Numo Style)

- Android NFC HCE - **Nicht begonnen**
- Cashu Token via NDEF - **Nicht begonnen**

### 4.2 Nostr Integration (NIP-60/61)

- Cashu Wallet in Nostr Events - **Nicht begonnen**
- Nutzaps - Zaps als ecash - **Nicht begonnen**

### 4.3 LNbits Integration

- Bestehendes LNbits Backend nutzen - **Nicht begonnen**
- Mehr Payment Options - **Nicht begonnen**

---

## 🔧 Technische Details

### Backend Endpoints

```
POST /auth/register
POST /auth/login
POST /payments - Create payment
GET  /payments - List payments
POST /products - Create product
GET  /products - List products
PUT  /products/{id} - Update product
DELETE /products/{id} - Delete product
POST /cart/items - Add to cart
GET  /cart - Get cart
POST /cart/checkout - Checkout
POST /cashu/mint-quote - Lightning → Cashu
POST /cashu/melt - Cashu → Lightning
POST /cashu/verify - NUT-07 Token Check
GET  /cashu/balance - Cashu balance
POST /cashu/receive - Token receive
GET  /cashu/mints - List mints
```

### Frontend Screens

- `App.jsx` - Main app with routing
- `DashboardScreen` - Zahlung screen
- `CashuScreen` - Cashu operations
- `SwapScreen.jsx` - Swap functionality
- `MerchantScreen.jsx` - Merchant dashboard
- `Products.jsx` - Product management

### UI Component Library

- `Button.jsx` - Variants: primary, secondary, ghost, danger
- `Card.jsx` - Card, CardHeader, CardTitle, etc.
- `Input.jsx` - With label, error, icon support
- `Badge.jsx` - Status badges
- `Loader.jsx` - Spinner, PageLoader, Skeleton

### Design System

- **Background:** #0a0a0a
- **Cards:** #141414 with #222222 border
- **Primary:** #f7931a (Bitcoin Orange)
- **Success:** #22c55e
- **Error:** #ef4444
- **Text:** #ffffff (primary), #666666 (secondary)
- **Border Radius:** 16px (cards), 12px (buttons/inputs)
- **Spacing:** 20px padding, 20px margin-bottom

---

## 📝 Aktuelle Todo-Liste

### Sofort:

- [x] UI Consistency über alle Screens ✅
- [x] Phase 1 Merchant Features ✅
- [x] Phase 2 Cashu Extensions ✅

### Kurzfristig:

- [ ] PWA Support einbauen
- [ ] Bestellungen Detailansicht
- [ ] Einstellungen Screen vervollständigen
- [ ] NFC Payment (Numo)

### Mittel:

- [ ] WebSocket für Real-time Updates
- [ ] Nostr NIP-60/61 Integration
- [ ] LNbits Integration
- [ ] i18n (Englisch)

---

## 🧪 Getestet

- ✅ Lightning Invoice Erstellung (LND)
- ✅ Cashu Mint-Quote
- ✅ Cashu Token Verification (NUT-07)
- ✅ Multi-Mint Support
- ✅ Products CRUD
- ✅ Cart + Checkout
- ✅ UI Build (213KB JS, 27KB CSS)

---

## 📂 Projekt Pfade

| Komponente     | Pfad                                              |
| -------------- | ------------------------------------------------- |
| Backend        | `~/zapout-mvp/backend/`                           |
| Frontend       | `~/zapout-mvp/frontend/`                          |
| Docs           | `~/zapout-mvp/docs/`                              |
| Workspace Docs | `~/.openclaw/workspace/projects/zapout-mvp/docs/` |

---

_Zuletzt aktualisiert: 18.03.2026 - Lightning Payments fully working (real LND invoices)_
