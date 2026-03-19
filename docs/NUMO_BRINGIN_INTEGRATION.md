# ZapOut - Numo & Bringin Integration

> **Version:** 1.0 | **Datum:** 19.03.2026
> **Status:** Konzept-Phase

---

## 1. Übersicht

ZapOut integriert zwei externe Systeme für ein vollständiges Bitcoin-POS-Erlebnis:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ZAPOUT ECOSYSTEM                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────┐                                                    │
│   │     Numo       │  ◀── Customer App (Android)                        │
│   │   (Android)    │      Bezahlt mit Bitcoin                           │
│   └────────┬────────┘                                                    │
│            │                                                             │
│            │ NFC / QR / Nostr                                           │
│            ▼                                                             │
│   ┌─────────────────────────────────────────────────────────────┐      │
│   │                      ZAPOUT (Merchant)                        │      │
│   │                                                              │      │
│   │   ┌─────────────┐         ┌─────────────┐                   │      │
│   │   │  Lightning  │         │    Cashu    │                   │      │
│   │   │  (LND)      │         │   (Mint)    │                   │      │
│   │   └─────────────┘         └─────────────┘                   │      │
│   │              │                   │                            │      │
│   │              └─────────┬─────────┘                            │      │
│   │                        │                                       │      │
│   │                        ▼                                       │      │
│   │              ┌─────────────────────┐                          │      │
│   │              │     Bringin         │                          │      │
│   │              │   (EUR Settlement)  │                          │      │
│   │              └──────────┬──────────┘                          │      │
│   └─────────────────────────┼────────────────────────────────────┘      │
│                             │                                           │
│                             ▼                                           │
│                      ┌──────────────┐                                  │
│                      │   Bank Konto │                                  │
│                      │   (EUR)       │                                  │
│                      └──────────────┘                                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Numo Integration

### 2.1 Was ist Numo?

**Numo** ist eine Bitcoin-Wallet App für Android mit Fokus auf:

- Lightning Payments
- Cashu Token Support
- NFC Tap-to-Pay
- Nostr Integration (NIP-57 Zaps)

**Numo Repo:** https://github.com/Schrotti77/Numo

### 2.2 Numo-ZapOut Verbindung

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        NUMO → ZAPOUT PAYMENT                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   Customer (Numo)              Merchant (ZapOut)                        │
│         │                              │                                │
│         │  1. Scan QR / NFC Tap        │                                │
│         │ ────────────────────────────▶│                                │
│         │                              │                                │
│         │  2. Invoice ausgestellt      │                                │
│         │ ◀────────────────────────────│                                │
│         │                              │                                │
│         │  3. Lightning Payment        │                                │
│         │ ────────────────────────────▶│                                │
│         │                              │                                │
│         │  4. Payment Preimage        │                                │
│         │ ◀────────────────────────────│                                │
│         │                              │                                │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Numo Features für ZapOut

| Numo Feature        | ZapOut Use Case                | Priority |
| ------------------- | ------------------------------ | -------- |
| NFC Tap             | Kunde tippt Phone auf Terminal | 🔴 HIGH  |
| QR Code             | Klassisch QR scannen           | ✅ DONE  |
| Nostr Zaps (NIP-57) | Receipts als Nostr Events      | 🟡 MED   |
| Cashu Receive       | Cashu Token annehmen           | 🟡 MED   |
| Cashu Send          | Token an Kunden senden         | 🟡 MED   |

### 2.4 NFC Tap-to-Pay Implementierung

```javascript
// ZapOut NFC Reader (Web)
class ZapOutNFC {
  constructor() {
    this.isSupported = 'NDEFReader' in window;
  }

  async startReading() {
    if (!this.isSupported) {
      console.log('WebNFC not supported, using QR fallback');
      return;
    }

    const reader = new NDEFReader();

    await reader.scan();

    reader.onreading = ({ message }) => {
      for (const record of message.records) {
        const payload = this.decodePayload(record);

        if (payload.type === 'bolt11') {
          this.processBolt11Payment(payload.data);
        } else if (payload.type === 'cashu') {
          this.processCashuToken(payload.data);
        } else if (payload.type === 'lnurl') {
          this.processLNURL(payload.data);
        }
      }
    };
  }

  decodePayload(record) {
    const decoder = new TextDecoder();
    const data = decoder.decode(record.data);
    return JSON.parse(data);
  }
}
```

### 2.5 Numo Deep Link Bridge

```javascript
// Für iOS / Nicht-NFC Geräte
const NumoBridge = {
  // ZapOut öffnet Numo via Deep Link
  async requestPayment(amountSats, callbackUrl) {
    const invoice = await zapout.createInvoice(amountSats);

    // Numo App öffnen mit Invoice
    const url = `numo://pay?bolt11=${encodeURIComponent(invoice.bolt11)}`;

    // Optional: Callback für automatische Bestätigung
    if (callbackUrl) {
      const callback = encodeURIComponent(`${ZAPOUT_URL}/callback?hash=${invoice.payment_hash}`);
      window.location.href = `${url}&callback=${callback}`;
    } else {
      window.location.href = url;
    }
  },

  // QR Code Fallback
  showQRCode(invoice) {
    // Bereits implementiert in ZapOut
  },
};
```

### 2.6 Numo API Integration (Backend)

```python
# ZapOut Backend: Numo Compatibility Layer
@app.get("/compatibility/numo/invoice")
async def get_numo_compatible_invoice(
    amount_sats: int,
    memo: str = "ZapOut Payment"
):
    """
    Generate invoice compatible with Numo's expected format
    """
    # Create standard LND invoice
    invoice = await lnd_client.add_invoice(
        value=amount_sats,
        memo=f"ZapOut: {memo}",
        expiry=600
    )

    return {
        "type": "bolt11",
        "data": invoice.payment_request,
        "amount_sats": amount_sats,
        "payment_hash": invoice.r_hash.hex(),
        "expires_at": datetime.now() + timedelta(minutes=10),
        # Numo-compatible format
        "nfc_payload": {
            "type": "bolt11",
            "data": invoice.payment_request,
            "amount_sats": amount_sats
        }
    }
```

---

## 3. Bringin Integration

### 3.1 Was ist Bringin?

**Bringin** ist ein Service für:

- EUR Wallet für Bitcoin-Händler
- Automatische Auszahlung auf Bankkonto
- On-Ramp (EUR → BTC)
- Keine eigenen Channels nötig

### 3.2 Bringin-ZapOut Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     BRINGIN EUR SETTLEMENT FLOW                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   Customer              ZapOut                 Bringin                  │
│      │                    │                      │                      │
│      │  Lightning Pay     │                      │                      │
│      │ ─────────────────▶│                      │                      │
│      │                    │                      │                      │
│      │                    │  Settlement Request   │                      │
│      │                    │ ─────────────────────▶                      │
│      │                    │                      │                      │
│      │                    │  1. Convert sats → EUR                    │
│      │                    │                      │                      │
│      │                    │  2. Credit EUR Wallet │                      │
│      │                    │ ◀────────────────────│                      │
│      │                    │                      │                      │
│      │                    │  Auto-Payout Request  │                      │
│      │                    │ ─────────────────────▶                      │
│      │                    │                      │                      │
│      │                    │                      │  Bank Transfer        │
│      │                    │                      │ ────────────────────▶│
│      │                    │                      │                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Bringin API Funktionen

| Funktion              | Beschreibung         | Status           |
| --------------------- | -------------------- | ---------------- |
| `create_wallet`       | EUR Wallet erstellen | ✅ Implementiert |
| `add_bank_account`    | IBAN hinterlegen     | ✅ Implementiert |
| `create_payout`       | EUR Auszahlung       | ✅ Implementiert |
| `get_payout_status`   | Auszahlungs-Status   | ✅ Implementiert |
| `get_wallet_balance`  | Wallet Balance       | ✅ Implementiert |
| `create_onramp_quote` | EUR → BTC Quote      | ✅ Implementiert |

### 3.4 Bringin Backend Integration

```python
# backend/bringin.py - bereits implementiert!
from bringin import get_bringin_client

class SettlementService:
    def __init__(self):
        self.bringin = get_bringin_client()

    async def settle_to_eur(self, user_id: int, sats_amount: int, rate_btc_eur: float):
        """
        Konvertiert Lightning-Sats zu EUR und initiate Auszahlung
        """
        # EUR Betrag berechnen
        amount_eur = int((sats_amount / 100_000_000) * rate_btc_eur * 100)  # in cents

        # User's Bringin Wallet ID aus DB holen
        wallet_id = await self.get_user_wallet_id(user_id)

        if not wallet_id:
            # Erst Wallet erstellen
            user = await self.get_user(user_id)
            result = await self.bringin.create_wallet(
                email=user.email,
                phone=user.phone
            )
            wallet_id = result['wallet_id']
            await self.save_wallet_id(user_id, wallet_id)

        # Payout erstellen
        payout = await self.bringin.create_payout(
            wallet_id=wallet_id,
            amount_eur=amount_eur,
            reference=f"ZapOut Settlement {datetime.now().isoformat()}"
        )

        return payout
```

### 3.5 Automatische vs. Manuelle Settlement

| Modus         | Beschreibung                                | Use Case                 |
| ------------- | ------------------------------------------- | ------------------------ |
| **Auto**      | Nach jeder Zahlung automatisch auszahlen    | Kleine Händler, Cashflow |
| **Batch**     | Täglich/Wöchentlich sammeln, dann auszahlen | Größere Händler          |
| **On-Demand** | Händler klickt "Auszahlen"                  | Flexible Händler         |

```python
# Settlement-Optionen in Settings
SETTLEMENT_MODES = {
    "auto": {
        "threshold_eur": 50,  # Mindestbetrag für Auto-Auszahlung
        "schedule": "daily"   # Oder "instant"
    },
    "batch": {
        "frequency": "weekly",  # oder "daily"
        "day": "monday"
    },
    "on_demand": {
        "min_amount_eur": 10
    }
}
```

---

## 4. Integriertes Zahlungs-Flow

### 4.1 Kompletter Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ZAPOUT PAYMENT FLOW (FULL)                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  CUSTOMER                                                                │
│  ┌──────────┐                                                            │
│  │  Numo   │ ◀─── oder andere Lightning Wallet                          │
│  │ (Android│                                                             │
│  └────┬─────┘                                                            │
│       │                                                                  │
│       │ 1. Wählt zu zahlenden Betrag                                     │
│       │ 2. Scannt QR / NFC Tap / Deep Link                              │
│       ▼                                                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ZAPOUT                                                                  │
│       │                                                                  │
│       │ 3. Invoice erstellen (LND)                                     │
│       ▼                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │                    PAYMENT MODES                             │        │
│  │                                                             │        │
│  │   ┌─────────────────┐  ┌─────────────────┐                │        │
│  │   │  LIGHTNING ⚡   │  │     CASHU 🪙    │                │        │
│  │   │                 │  │                 │                │        │
│  │   │ • BOLT11 Invoice│  │ • Token Receive│                │        │
│  │   │ • On-Chain als  │  │ • Token Send   │                │        │
│  │   │   Fallback      │  │                │                │        │
│  │   └─────────────────┘  └─────────────────┘                │        │
│  │                                                             │        │
│  └─────────────────────────────────────────────────────────────┘        │
│       │                                                                  │
│       │ 4. Payment erhalten                                            │
│       ▼                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │                    SETTLEMENT OPTIONS                        │        │
│  │                                                             │        │
│  │   ┌─────────────────┐  ┌─────────────────┐                │        │
│  │   │   BRINGIN 💶     │  │   KEEP IN BTC   │                │        │
│  │   │                 │  │                 │                │        │
│  │   │ • EUR Wallet     │  │ • Auf Helmut    │                │        │
│  │   │ • Bank-Auszahlung│  │ • Keep Sats     │                │        │
│  │   │ • On-Ramp       │  │                 │                │        │
│  │   └─────────────────┘  └─────────────────┘                │        │
│  │                                                             │        │
│  └─────────────────────────────────────────────────────────────┘        │
│       │                                                                  │
│       │ 5. Settlement                                                 │
│       ▼                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │                    RECEIPT                                  │        │
│  │                                                             │        │
│  │   • QR Code zum Scannen                                     │        │
│  │   • NFC für kompatible Wallets                              │        │
│  │   • Nostr Event (NIP-57 Zap Receipt)                       │        │
│  │                                                             │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Implementation Roadmap

| Phase | Feature                  | Dependencies    | Aufwand | Priority |
| ----- | ------------------------ | --------------- | ------- | -------- |
| **1** | Bringin EUR Wallet Setup | Bringin API Key | 1 Tag   | 🔴 HIGH  |
| **1** | Settlement Dashboard     | Bringin         | 2 Tage  | 🔴 HIGH  |
| **2** | Numo NFC Reader          | WebNFC API      | 1 Woche | 🟡 MED   |
| **2** | Numo Deep Link           | Numo App        | 2 Tage  | 🟡 MED   |
| **3** | Nostr Receipts (NIP-57)  | Nostr Relay     | 1 Woche | 🟢 LOW   |
| **3** | Auto-Settlement          | Cron Job        | 2 Tage  | 🟢 LOW   |

---

## 6. Numo vs. Bringin Rollen

| System      | Rolle           | Was es macht               |
| ----------- | --------------- | -------------------------- |
| **Numo**    | Customer-Facing | Kunde bezahlt mit Numo App |
| **Bringin** | Merchant-Facing | Händler bekommt EUR        |

### 6.1 Warum beide?

| Aspekt     | Nur Lightning   | Mit Numo + Bringin     |
| ---------- | --------------- | ---------------------- |
| Kunden     | Jede Wallet     | **Numo = beste UX**    |
| Annahme    | Lightning OK    | **+ Cashu Tokens**     |
| Auszahlung | Manuell         | **Auto auf Bankkonto** |
| On-Ramp    | Manuell         | **Direkt EUR → BTC**   |
| Nutzer     | Kunde + Händler | **+ Numo Nutzer**      |

---

## 7. Offene Fragen

| Frage                      | Status | Notiz                         |
| -------------------------- | ------ | ----------------------------- |
| Bringin API Key vorhanden? | ❓     | Muss getestet werden          |
| Numo Deep Link Schema      | ❓     | Muss mit Numo Repo abgleichen |
| WebNFC Browser Support     | ⚠️     | Nur Chrome Android            |
| Nostr Relay Auswahl        | 📋     | nostr-vault, primal, etc.     |

---

## 8. Nächste Schritte

1. **Bringin testen** - API Key beschaffen und testen
2. **Bringin UI** - Wallet-Verbindung in Settings
3. **Numo Deep Link** - Spec mit Numo Repo abstimmen
4. **WebNFC** - Proof of Concept für Android

---

_Letztes Update: 2026-03-19_
