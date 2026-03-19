# ZapOut MVP - Status

**Version:** 0.2.0
**Datum:** 19.03.2026
**Status:** MVP Phase 2 - Passkey + Watch-Only Wallet

---

## Implementierte Features

### ✅ Authentication & Key Management

| Feature                | Status | Details                             |
| ---------------------- | ------ | ----------------------------------- |
| Email/Password Auth    | ✅     | `/auth/register`, `/auth/login`     |
| Passkey Registration   | ✅     | WebAuthn mit Challenge              |
| Passkey Login          | ✅     | Credential-based authentication     |
| **PRF Key Derivation** | ✅     | WebAuthn PRF Extension → BIP32 Seed |
| Watch-Only Wallet      | ✅     | LND via SSH, nur Public Keys        |
| Email Fallback         | ✅     | Für Testing ohne Passkey            |

### ✅ Lightning & Payments

| Feature              | Status | Details                     |
| -------------------- | ------ | --------------------------- |
| LND Integration      | ✅     | Helmut via SSH tunnel       |
| Real BOLT11 Invoices | ✅     | `/merchant/payment-request` |
| WebSocket Updates    | ✅     | NUT-17 Echtzeit-Status      |
| Quick Amounts        | ✅     | 5, 10, 20, 50, 100, 200€    |

### ✅ Cashu

| Feature            | Status | Details                       |
| ------------------ | ------ | ----------------------------- |
| Balance Check      | ✅     | `/cashu/balance`              |
| Mint Quote         | ✅     | `/cashu/mint-quote`           |
| Token Verify       | ✅     | `/cashu/verify`               |
| Multi-Mint Support | ✅     | testnut, 8333.space, cashu.me |
| Token Receive      | ✅     | `/cashu/receive`              |

### ✅ Core Features

| Feature             | Status | Details                 |
| ------------------- | ------ | ----------------------- |
| Product Management  | ✅     | CRUD operations         |
| Cart                | ✅     | Add/remove/update items |
| Checkout            | ✅     | Lightning oder Cashu    |
| Live BTC Conversion | ✅     | CoinGecko API           |
| i18n                | ✅     | Deutsch + Englisch      |
| Dark Theme          | ✅     | Bitcoin-Orange Akzent   |
| PWA                 | ✅     | Installierbar           |

---

## Projekt-Phasen Status

```
Phase 1: Foundation        ████████████ 100% ✅
Phase 2: Key Management    ████████████ 100% ✅
Phase 3: Watch-Only Wallet███████████░░░░  80% ⏳
Phase 4: Multi-Device      ░░░░░░░░░░░░░░░  0% ⏸️
Phase 5: Backup/Recovery   ░░░░░░░░░░░░░░░  0% ⏸️
Phase 6: Employee Roles     ░░░░░░░░░░░░░░░  0% ⏸️
Phase 7: POS Optimierung    ░░░░░░░░░░░░░░░  0% ⏸️
```

---

## Implementierte Steps

| Step       | Beschreibung                | Status        |
| ---------- | --------------------------- | ------------- |
| **Step 0** | Project Setup               | ✅ 12.03.2026 |
| **Step 1** | Basic Auth (Email/Password) | ✅ 12.03.2026 |
| **Step 2** | Passkey Registration        | ✅ 19.03.2026 |
| **Step 3** | LND Integration             | ✅ 19.03.2026 |
| **Step 4** | PRF Key Derivation          | ✅ 19.03.2026 |

---

## Nächste Schritte

### Sofort (Step 5-7)

| Priority | Task                 | Description                 |
| -------- | -------------------- | --------------------------- |
| 🔴 HIGH  | Multi-Device Support | Backup-Device Setup, Sync   |
| 🔴 HIGH  | Backup Flow UI       | Paper Backup, Cloud Backup  |
| 🟡 MED   | Recovery Flow        | Neues Gerät, Key Recovery   |
| 🟡 MED   | Employee Roles       | Staff Permissions, PIN-Code |

### Geplant (Phase 7+)

| Task                 | Description                         |
| -------------------- | ----------------------------------- |
| POS-Kassenoberfläche | Produkt-Buttons statt Quick-Amounts |
| Produkt-Kategorien   | Kategorien-Filter                   |
| Bon-Funktion         | Payment Receipt anzeigen            |
| Trinkgeld            | +10%, +15%, +20% nach Zahlung       |
| NFC Tap-to-Add       | NFC-Tag = Produkt hinzufügen        |
| Split Payment        | Lightning + Cashu kombiniert        |

---

## Technische Details

### LND Connection

```
Host: helmut-tail (SSH alias)
Endpoint: lightning_lnd_1 container
Port: 10009 (RPC), 9735 (Lightning)
Node: SynapseLN
Pubkey: 03534ada4a452825de8133701b1a8ca1dfd916336045e6a6f562fdb734ec0bc9f3
```

### API Endpoints

**Auth:**

```
POST /auth/register        - Email/Password registration
POST /auth/login           - Email/Password login
POST /auth/passkey/register - Passkey registration
POST /auth/passkey/login   - Passkey login
GET  /auth/passkey/challenge/register - Get registration challenge
GET  /auth/passkey/challenge/authenticate - Get login challenge
POST /auth/passkey/prf/register - Register with PRF
POST /auth/passkey/prf/login - Login with PRF
GET  /auth/passkey/wallet - Get LND wallet info
```

**Payments:**

```
POST /merchant/payment-request - Create LND invoice
GET  /merchant/payment/{hash}  - Check payment status
```

**Cashu:**

```
GET  /cashu/mints           - List configured mints
GET  /cashu/balance          - Check balance
POST /cashu/mint-quote       - Request mint quote
POST /cashu/verify          - Verify token
GET  /cashu/mint-urls       - Get mint URLs
```

---

## Test-Login

| Type           | Email             | Password |
| -------------- | ----------------- | -------- |
| Email/Password | test2@cafe.de     | test123  |
| Passkey        | (Browser Passkey) | -        |

---

## Changelog

### v0.2.0 (19.03.2026)

- ✅ Passkey Registration implementiert
- ✅ Passkey Login mit Email-Fallback
- ✅ PRF Key Derivation (WebAuthn Extension)
- ✅ Watch-Only LND Wallet via SSH
- ✅ Real BOLT11 Invoices

### v0.1.0 (12.03.2026)

- ✅ Basic Auth (Email/Password)
- ✅ Lightning Payments (Mock)
- ✅ Cashu Integration
- ✅ Product Management
- ✅ Cart & Checkout
- ✅ i18n (DE/EN)
- ✅ PWA Support

---

## Bekannte Issues

| Issue                                   | Severity | Status                     |
| --------------------------------------- | -------- | -------------------------- |
| QR Code Pairing (Phone-as-Security-Key) | Low      | Workaround: Email-Fallback |
| PRF nur auf unterstützenden Browsern    | Low      | Fallback zu Email-Auth     |

---

_Letztes Update: 2026-03-19_
