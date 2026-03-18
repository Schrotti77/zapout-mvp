# ZapOut - Bitcoin POS-System

> **Version:** 3.0 | **Datum:** 18.03.2026 | **Status:** MVP Complete, POS-Features Planned

---

## 🎯 Vision

**ZapOut** ist ein modernes **Bitcoin Point-of-Sale (POS) System** für:

- 🎪 Marktstände (Flohmärkte, Weihnachtsmärkte, Festivals)
- 🏪 Ladeninhaber mit Bitcoin-fokussiertem Geschäft
- ☕ Cafés und Restaurants
- 🚚 Foodtrucks und Imbissstände
- 📱 Jeder, der Bitcoin-Zahlungen physisch entgegennehmen möchte

**Kernprinzip:** Schnell, einfach, professionell - ohne technisches Wissen bedienbar.

---

## ✅ Funktionsumfang (MVP)

### Zahlungsabwicklung

| Feature             | Status | Beschreibung                    |
| ------------------- | ------ | ------------------------------- |
| Lightning Payment   | ✅     | QR-Code mit echten LND-Invoices |
| Cashu Token         | ✅     | NUT-07 Token-Einlösung          |
| Live BTC-Umrechnung | ✅     | CoinGecko API                   |
| Multi-Mint Support  | ✅     | testnut, 8333.space, cashu.me   |
| WebSocket Updates   | ✅     | NUT-17 Echtzeit-Status          |

### Kassenfunktionen

| Feature            | Status | Beschreibung                   |
| ------------------ | ------ | ------------------------------ |
| Quick Amounts      | ✅     | 5, 10, 20, 50, 100, 200€       |
| Warenkorb          | ✅     | Produkte hinzufügen, summieren |
| Checkout           | ✅     | QR-Code anzeigen, bezahlen     |
| Produkt-Verwaltung | ✅     | CRUD für Produkte              |

### Technisch

| Feature           | Status | Beschreibung          |
| ----------------- | ------ | --------------------- |
| PWA Support       | ✅     | Installierbar als App |
| i18n              | ✅     | Deutsch + Englisch    |
| Dark Theme        | ✅     | Bitcoin-Orange Akzent |
| Responsive        | ✅     | Mobile-first Design   |
| Real LND Invoices | ✅     | Helmut Server via SSH |

---

## 📱 Screens (Aktuell)

### 1. Dashboard (Zahlung)

- Quick Amounts als große Buttons
- Custom-Betrag Eingabe
- Warenkorb-Ansicht
- Lightning QR-Code Anzeige

### 2. Cashu

- Balance Anzeige
- Token generieren (Lightning → Cashu)
- Token einlösen (Cashu → Lightning)

### 3. Swap

- Lightning ↔ Cashu Tausch

### 4. Händler (Merchant)

- Quick Payment
- Produkt-Verwaltung
- Bestellungen-Übersicht

### 5. Produkte

- Produktliste mit Preisen
- CRUD für Produkte

### 6. Einstellungen

- Konto-Info
- Lightning Node Status
- Cashu Wallet Status
- Sprache wechseln

---

## 🔄 Screens (POS-Optimiert) - GEPLANT

### Neue Kassenoberfläche

```
┌─────────────────────────────────────────┐
│           ZAPOUT KASSE                  │
├─────────────────────────────────────────┤
│  Warenkorb                    3 Artikel │
│  ────────────────────────────────      │
│  Kaffee Latte         3,50€      × 2    │
│  Croissant            2,50€      × 1    │
│  Mineralwasser        2,00€      × 1    │
│                                         │
│  Zwischensumme:            11,50€      │
│  BTC:                     ₿0.00012     │
├─────────────────────────────────────────┤
│  [⚡ Lightning]  [💰 Cashu]  [↕ Split]  │
├─────────────────────────────────────────┤
│  [🔙]                              [🧹] │
└─────────────────────────────────────────┘
```

### Produkt-Kategorien (NEU)

```
┌─────────────────────────────────────────┐
│  ☕ Getränke  🍞 Backwaren  🍽️ Essen   │
├─────────────────────────────────────────┤
│  [Latte      3,50€] [Espresso  2,00€]  │
│  [Cappuccino 3,80€] [Kaffee    2,20€]  │
│  [Wasser     2,00€] [Saft       2,50€] │
│  [Cola       2,50€]                   │
└─────────────────────────────────────────┘
```

### Zahlungs-Bestätigung (NEU)

```
┌─────────────────────────────────────────┐
│                                         │
│            ✓ BEZAHLT!                   │
│                                         │
│       Lightning Payment Received         │
│                                         │
│    Betrag: 11,50€ / ₿0.00012           │
│    Zeit:   18.03.2026 14:32            │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │         💜 Trinkgeld?            │   │
│  │                                 │   │
│  │  [+10% 1,15€] [+15% 1,73€]    │   │
│  │         [+20% 2,30€]            │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [Neue Zahlung]    [Bon drucken]        │
└─────────────────────────────────────────┘
```

---

## 📋 Feature-Prioritäten

### Phase 1: POS-Grundlagen (Kritisch)

| Feature                  | Beschreibung                        | Aufwand |
| ------------------------ | ----------------------------------- | ------- |
| **POS-Kassenoberfläche** | Produkt-Buttons statt Quick-Amounts | Mittel  |
| **Produkt-Kategorien**   | Kategorien für schnellen Zugriff    | Niedrig |
| **Bon-Funktion**         | Zahlungsnachweis anzeigen           | Niedrig |
| **Trinkgeld**            | +10%, +15%, +20% nach Zahlung       | Niedrig |

### Phase 2: POS-Fortschritt

| Feature             | Beschreibung                            | Aufwand |
| ------------------- | --------------------------------------- | ------- |
| **NFC Tap-to-Add**  | NFC-Tag antippen = Produkt in Warenkorb | Hoch    |
| **Barcode-Scanner** | Barcode scannen = Produkt hinzufügen    | Mittel  |
| **Split Payment**   | Lightning + Cashu kombiniert            | Hoch    |
| **Tagesbericht**    | Umsatz-Statistiken pro Tag              | Mittel  |

### Phase 3: Offline & Multi-User

| Feature               | Beschreibung                | Aufwand |
| --------------------- | --------------------------- | ------- |
| **Offline-Modus**     | Funktioniert ohne Internet  | Hoch    |
| **Multi-Cashier**     | Mehrere Mitarbeiter-Konten  | Mittel  |
| **Mehrere Standorte** | Mehrere Kassen, ein Backend | Hoch    |

### Phase 4: Erweiterungen

| Feature                | Beschreibung                  | Aufwand |
| ---------------------- | ----------------------------- | ------- |
| **Nostr NIP-57 Zaps**  | Receipt via Nostr DM          | Mittel  |
| **LNbits Integration** | Alternative Lightning-Wallets | Hoch    |
| **Numo NFC Bridge**    | Hardware-Wallet Integration   | Hoch    |

---

## 🛠️ Technische Architektur

### Frontend (React + Vite)

```
frontend/src/
├── components/
│   ├── ui/           # Button, Card, Input, etc.
│   ├── CartDrawer.jsx # Warenkorb
│   ├── PaymentModal.jsx # Lightning QR
│   └── ProductGrid.jsx  # NEU: Produkt-Buttons
├── screens/
│   ├── DashboardScreen.jsx
│   ├── CashuScreen.jsx
│   ├── SwapScreen.jsx
│   ├── MerchantScreen.jsx
│   ├── ProductsScreen.jsx
│   ├── SettingsScreen.jsx
│   └── POSScreen.jsx     # NEU: Kassen-Oberfläche
├── hooks/
│   └── useWebSocket.js
├── services/
│   ├── api.js
│   └── cashu.js
└── i18n/
    ├── locales/de.json
    └── locales/en.json
```

### Backend (FastAPI + SQLite)

```
backend/
├── main.py           # Haupt-API
├── cashu.py          # Cashu Integration
├── breeze.py         # Breez SDK
├── bringin.py        # EUR Payouts
└── zapout.db         # SQLite Datenbank
```

### Datenbank-Schema

**users**

- id, email, password_hash, created_at

**products**

- id, name, price_cents, description, image_url, category, active

**cart_items**

- id, user_id, product_id, quantity, added_at

**orders**

- id, user_id, total_cents, status, lightning_invoice, payment_hash, tip_cents, created_at

**order_items** (NEU)

- id, order_id, product_id, product_name, price_cents, quantity

**payments**

- id, order_id, method (lightning/cashu/split), amount_cents, status, created_at

---

## 🎨 Design-System

### Farben

- **Background:** #0a0a0a (Dunkel)
- **Cards:** #141414 mit #222222 Border
- **Primary:** #f7931a (Bitcoin Orange)
- **Success:** #22c55e
- **Error:** #ef4444
- **Text:** #ffffff (Primary), #666666 (Secondary)

### POS-Buttons (Touch-Friendly)

- **Größe:** Minimum 60×60px
- **Border Radius:** 16px
- **Spacing:** 12px Grid
- **Feedback:** Scale 0.95 on click

---

## 🔌 API-Endpunkte

### Auth

```
POST /auth/register
POST /auth/login
GET  /auth/me
```

### Produkte

```
GET    /products
POST   /products
PUT    /products/{id}
DELETE /products/{id}
```

### Warenkorb

```
GET    /cart
POST   /cart/items
DELETE /cart/items/{id}
DELETE /cart
```

### Checkout

```
POST /cart/checkout
POST /payments
GET  /payments/{id}
```

### Lightning

```
GET  /lightning/status
POST /lightning/invoice
```

### Cashu

```
GET  /cashu/info
GET  /cashu/balance
POST /cashu/mint-quote
POST /cashu/melt
POST /cashu/verify
POST /cashu/receive
GET  /cashu/mints
```

### Berichte (NEU)

```
GET /reports/today      # Tagesbericht
GET /reports/week       # Wochenbericht
GET /reports/export      # CSV Export
```

---

## 📦 Deployment

### Helmut (Umbrel Server)

- LND Node (Lightning)
- Backend API
- Datenbank

### Frontend

- Vercel / Netlify (empfohlen)
- Oder: Static Build auf Helmut

### PWA

- Service Worker für Offline
- Manifest für App-Installation

---

## 🚀 Nächste Schritte (Sofort)

1. [ ] **POSScreen.jsx** erstellen - Kassenoberfläche mit Produkt-Buttons
2. [ ] **Produkt-Kategorien** - Kategorien-Filter in POSScreen
3. [ ] **Bon-Ansicht** - "Bezahlt ✓" Bestätigung mit Details
4. [ ] **Trinkgeld-Funktion** - Nach Zahlung anbieten

---

## 📝 Changelog

### v3.0 (18.03.2026)

- Konzept überarbeitet: Von E-Commerce zu Bitcoin POS-System
- POS-Screens definiert
- Feature-Prioritäten neu geordnet
- Trinkgeld, Bon, Kategorien als neue Features

### v2.0 (17.03.2026)

- Lightning Payments (echte LND Invoices)
- Cashu Integration (NUT-04/05/07)
- UI/UX komplett neu
- PWA Support
- i18n

---

_Zuletzt aktualisiert: 18.03.2026 - Konzept fokussiert auf Bitcoin POS_
