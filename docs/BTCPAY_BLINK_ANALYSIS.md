# BTCPay Server & Blink Analyse

> Analyse vom 19.03.2026

---

## BTCPay Server - Was es kann

BTCPay Server ist ein freies, open-source Payment Gateway für Bitcoin/Lightning.

### Features

| Feature                         | BTCPay       | ZapOut            |
| ------------------------------- | ------------ | ----------------- |
| **Lightning POS**               | ✅ Built-in  | ✅                |
| **NFC Tap-to-Pay (Bolt Cards)** | ✅           | ❌ (Numo hat das) |
| **EUR Settlement**              | ✅ Via Blink | ✅ Via Bringin    |
| **Receipt Printing**            | ✅           | ❌                |
| **Multi-Merchant**              | ✅           | ✅                |
| **Cashu Support**               | ❌           | ✅                |
| **Passkey Login**               | ❌           | ✅                |
| **Greenfield API**              | ✅           | ✅                |

### POS Features

- **Point of Sale App** - Built-in POS mit Keypad UI
- **Bolt Cards** - NFC Tap-to-Pay Karten (wie Numo's Tap-2-Pay)
- **Blink Integration** - External LN Service oder internal node
- **Multi-store Support** - Multiple merchants per instance
- **Receipt Printing** - POSPrinter integration
- **Automatic Payouts** - Automated Lightning payouts
- **Rate Limits** - Dynamic rate limiting plugin

### BTCPay Server auf Helmut?

```bash
# Prüfen ob BTCPay läuft
ssh helmut-tail "docker ps | grep -i btcpay"
```

**Wenn nicht installiert**: Zu komplex für MVP - Helmut Mint + LND reicht.

---

## Blink.sv - Technische Details

### Was Blink ist

- **Bitcoin & Lightning API Service** (El Salvador)
- GraphQL API (nicht REST!)
- Phone Number Registration
- Low-cost Lightning infrastructure

### API Grundlagen

```graphql
# Endpoint
POST https://api.blink.sv/graphql

# Auth
X-API-KEY: blink_your_api_key_here
```

### Features

| Feature            | Blink     | Bringin |
| ------------------ | --------- | ------- |
| Lightning Invoices | ✅        | ❌      |
| EUR Settlement     | ❌        | ✅      |
| USD (Stablesats)   | ✅        | ❌      |
| BTC Wallet         | ✅        | ❌      |
| Self-Host Option   | ✅        | ❌      |
| Fees               | ~0.02% LN | ?       |

### Preise

- **Blink-to-Blink**: 0% Fee
- **Outgoing Lightning**: ~0.02%
- **Onchain >1M sats**: 0%
- **Stablesats conversion**: 0.2% spread

### Lightning Invoice erstellen

```graphql
mutation LnInvoiceCreate($input: LnInvoiceCreateInput!) {
  lnInvoiceCreate(input: $input) {
    invoice {
      paymentRequest
      paymentHash
      paymentSecret
      satoshis
    }
    errors {
      message
    }
  }
}
```

---

## Vergleich: Setup Optionen

| Komponente             | Helmut + LND + Bringin | BTCPay + Blink  |
| ---------------------- | ---------------------- | --------------- |
| **Lightning Backend**  | Eigenes LND (Helmut)   | Managed Service |
| **EUR Settlement**     | ✅ Bringin             | ❌              |
| **Channel Management** | Manuell                | Automatisch     |
| **Kosten**             | Routing fees (~0.03%)  | ~0.02%          |
| **Cashu Support**      | ✅ (cdk-mintd)         | ❌              |
| **Self-Hosted**        | ✅ (Helmut)            | ✅              |
| **NFC Tap-to-Pay**     | ❌                     | ✅ (Bolt Cards) |
| **API Type**           | REST (lncli)           | GraphQL         |

---

## Fazit für ZapOut

### Nicht direkt relevant weil:

1. **EUR Settlement**: ZapOut braucht EUR → Bringin ist.required
2. **Cashu**: ZapOut's Differentiator ist Cashu → Helmut Mint nötig
3. **Helmut's LND funktioniert bereits** für Swap Engine

### Aber interessant für:

1. **BTCPay Server als Alternative zu Helmut LND**

   - Weniger Wartung (keine Channel Management)
   - LND via BTCPay Server Plugin
   - NFC Tap-to-Pay (Bolt Cards) als Extra

2. **Blink für spezielle Use Cases**
   - Batch Payments (z.B. Gehaltszahlungen)
   - Stablesats für USD Merchant (El Salvador)
   - Self-Host Option für Enterprise

### Empfehlung

**Für MVP**: Helmut Mint + LND + Bringin behalten wie geplant.

**Für Phase 8 (Integrations)**:

- BTCPay Server als optionale Alternative evaluieren
- Blink für Batch Payment Use Cases
- Bolt Cards für NFC Tap-to-Pay

---

## Weiterführende Links

- BTCPay Server Docs: https://docs.btcpayserver.org/
- BTCPay POS Guide: https://docs.btcpayserver.org/Conference-PoS-guide/
- Blink Dev Docs: https://dev.blink.sv/
- Blink API: https://dashboard.blink.sv
