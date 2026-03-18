# Numo Compatibility Plan für ZapOut

> Generiert: 2026-03-13
> Basis: Numo Android App (cashubtc/Numo) + Opus Think

---

## Architektur Übersicht

```
┌─────────────────┐         ┌─────────────────┐
│   ZapOut        │◄───────►│      Numo       │
│   (Web/PWA)     │  API    │   (Android)     │
├─────────────────┤         ├─────────────────┤
│ WebNFC API      │         │ NFC/HCE         │
│ BOLT11          │         │ BOLT11          │
│ Nostr NIP-57    │         │ Cashu           │
│ Cashu (JS)      │         │ Nostr           │
└────────┬────────┘         └────────┬────────┘
         │                          │
         └──────────┬───────────────┘
                    │
         ┌──────────▼──────────┐
         │  Shared Protocol   │
         │      Layer (API)   │
         └────────────────────┘
```

---

## 1. NFC/HCE Kompatibilität

### Das Problem

- **WebNFC API** (`navigator.nfc`) = Chrome Android nur, NDEF read/write
- **Keine HCE Emulation** vom Browser möglich
- **Numo** = Full NFC/HCE auf Android

### Lösung: Hybrid Approach

```javascript
// ZapOut NFC Reader (Web)
class ZapOutNFC {
  async readNunoTap() {
    if ('NDEFReader' in window) {
      const reader = new NDEFReader();
      await reader.scan();
      reader.onreading = ({ message }) => {
        for (const record of message.records) {
          const payload = new TextDecoder().decode(record.data);
          // Numo schreibt Cashu token oder LNURL zu NDEF
          if (payload.startsWith('cashuA')) {
            this.redeemCashu(payload);
          } else if (payload.startsWith('lnurl')) {
            this.payLNURL(payload);
          } else if (payload.startsWith('lnbc')) {
            this.payBolt11(payload);
          }
        }
      };
    } else {
      // Fallback: QR code scan
      this.fallbackToQR();
    }
  }
}
```

### Numo → ZapOut NDEF Payload Standard

```json
{
  "type": "application/cashu+zapout",
  "payload": {
    "type": "cashu" | "bolt11" | "lnurl",
    "data": "<token_or_invoice>",
    "amount_sats": 100,
    "mint": "https://mint.example.com"
  }
}
```

### Deep Link Bridge (iOS Fallback)

```javascript
const NUMO_BRIDGE = {
  // ZapOut öffnet Numo via deep link
  requestPayment(amountSats) {
    const invoice = await this.createBolt11(amountSats);
    window.location.href = `numo://pay?bolt11=${invoice}`;
  },
  // Mit callback URL
  requestWithCallback(amountSats) {
    const callbackUrl = encodeURIComponent(`${ZAPOUT_URL}/callback`);
    window.location.href = `numo://pay?amount=${amountSats}&callback=${callbackUrl}`;
  }
};
```

---

## 2. BOLT11 Lightning Integration

### Shared Invoice Flow

```
ZapOut (Merchant)              Numo (Customer)
      │                              │
      ├──── Create BOLT11 ─────────►│
      │    (via QR/NFC/Nostr)        │
      │                              │
      ├──── Pay Invoice ────────────►│
      │    (Lightning Network)       │
      │                              │
      └──── Confirm (preimage) ─────►│
```

```javascript
// ZapOut invoice generation
import { requestInvoice } from '@zapout/lightning';

async function createInvoice(amountSats, memo) {
  const invoice = await requestInvoice({
    amount: amountSats,
    memo: `ZapOut: ${memo}`,
    expiry: 600,
    webhook: `${API_BASE}/api/v1/payments/confirm`,
  });

  return {
    bolt11: invoice.payment_request,
    payment_hash: invoice.payment_hash,
    nfc_payload: JSON.stringify({
      type: 'bolt11',
      data: invoice.payment_request,
      amount_sats: amountSats,
    }),
  };
}
```

---

## 3. Nostr Payment (NIP-57 Zaps)

```javascript
import { SimplePool } from 'nostr-tools';

class ZapOutNostr {
  constructor(relays) {
    this.pool = new SimplePool();
    this.relays = relays || ['wss://relay.damus.io', 'wss://relay.primal.net', 'wss://nos.lol'];
  }

  // Create zap request (NIP-57)
  async createZapRequest(recipientPubkey, amountMsats, eventId = null) {
    return {
      kind: 9734,
      content: '',
      tags: [
        ['p', recipientPubkey],
        ['amount', amountMsats.toString()],
        ['relays', ...this.relays],
        ...(eventId ? [['e', eventId]] : []),
      ],
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  // Listen for zap receipts
  listenForZapReceipts(paymentHash, onConfirm) {
    this.pool.subscribeMany(
      this.relays,
      [
        {
          kinds: [9735],
          '#p': [this.merchantPubkey],
          since: Math.floor(Date.now() / 1000) - 10,
        },
      ],
      {
        onevent(event) {
          const bolt11Tag = event.tags.find(t => t[0] === 'bolt11');
          if (bolt11Tag && extractHash(bolt11Tag[1]) === paymentHash) {
            onConfirm(event);
          }
        },
      }
    );
  }
}
```

---

## 4. Cashu Token Exchange

```javascript
import { CashuMint, CashuWallet, getDecodedToken } from '@cashu/cashu-ts';

class ZapOutCashu {
  constructor(mintUrl) {
    this.mint = new CashuMint(mintUrl);
    this.wallet = new CashuWallet(this.mint);
  }

  // Token von Numo empfangen (via NFC oder paste)
  async receiveCashuToken(tokenString) {
    const decoded = getDecodedToken(tokenString);
    const totalAmount = decoded.token.flatMap(t => t.proofs).reduce((sum, p) => sum + p.amount, 0);

    // Redeem (swap zu frischen proofs)
    const { proofs } = await this.wallet.redeem(tokenString);

    return { success: true, amount_sats: totalAmount, proofs };
  }

  // Token für Numo erstellen (Refund)
  async sendCashuToken(amountSats) {
    const { send } = await this.wallet.send(amountSats, this.proofs);
    return getEncodedToken({
      token: [{ mint: this.mint.mintUrl, proofs: send }],
    });
  }
}
```

---

## 5. Shared API Endpoints

```yaml
base_url: /api/v1

endpoints:

  # Payment request creation
  POST /payment/request:
    body:
      amount_sats: integer
      memo: string
      accepted_methods: ["bolt11", "cashu", "nostr_zap"]
      callback_url: string (optional)
    response:
      request_id: string
      bolt11: string
      cashu_mint: string
      nfc_payload: string
      qr_data: string
      expires_at: timestamp

  # Payment confirmation
  POST /payment/confirm:
    body:
      request_id: string
      method: "bolt11" | "cashu" | "nostr_zap"
      proof: object
    response:
      confirmed: boolean
      settlement_amount_sats: integer

  # Payment status
  GET /payment/status/{request_id}:
    response:
      status: "pending" | "paid" | "expired"
      method_used: string
      amount_sats: integer
```

---

## 6. Implementation Roadmap

| Phase   | Feature                     | Aufwand  |
| ------- | --------------------------- | -------- |
| **MVP** | BOLT11 QR Payment           | ✅ Ready |
| **1**   | Cashu Token Receive (Paste) | 1 Woche  |
| **1**   | Cashu Token Send (Refund)   | 1 Woche  |
| **2**   | Nostr NIP-57 Zaps           | 2 Wochen |
| **2**   | WebNFC Reader (Android)     | 1 Woche  |
| **3**   | Numo Deep Link Bridge       | 1 Woche  |
| **3**   | Bringin EUR Settlement      | 2 Wochen |

---

## 7. Numo Code Referenzen

| Datei                             | Zweck                              |
| --------------------------------- | ---------------------------------- |
| `LightningMintHandler.kt`         | Lightning Invoice Flow             |
| `CashuWalletManager.kt`           | Cashu Token Management             |
| `CashuPaymentHelper.kt`           | Cashu Payment Validation           |
| `NfcPaymentProcessor.kt`          | NFC NDEF Processing                |
| `PaymentRoutingCore.kt`           | Payment Routing Logic              |
| `AutoWithdrawSettingsActivity.kt` | Auto-Withdraw zu Lightning Address |

---

## 8. Wissensquelle

- **Numo Repo:** https://github.com/Schrotti77/Numo
- **Cashu Specs:** NUT-00 bis NUT-18
- **NIP-57:** Nostr Zaps
- **WebNFC API:** https://developer.mozilla.org/en-US/docs/Web/API/NFC_API
