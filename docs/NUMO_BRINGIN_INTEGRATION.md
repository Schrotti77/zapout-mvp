# Numo vs. ZapOut - Analyse & Strategie

> **Version:** 2.0 | **Datum:** 19.03.2026
> **Status:** RESEARCH

---

## 1. Numo Feature-Analyse

### 1.1 Kern-Features von Numo (cashubtc/Numo)

| Feature                  | Beschreibung                                         | Status           |
| ------------------------ | ---------------------------------------------------- | ---------------- |
| **Tap-2-Pay (NDEF/HCE)** | NFC Host Card Emulation für Cashu                    | ✅ Implementiert |
| **Lightning BOLT11**     | QR Code + NFC Invoice                                | ✅ Implementiert |
| **Swap to Lightning**    | Akzeptiert Tokens von ANY Mint, swapped zu Lightning | ✅ Implementiert |
| **Merchant Catalogs**    | Vordefinierte Produkte/Kategorien                    | ✅ Implementiert |
| **Baskets**              | Warenkörbe, persistent                               | ✅ Implementiert |
| **Payment History**      | Vollständige Historie                                | ✅ Implementiert |
| **Auto-Withdraw**        | Automatische Auszahlung bei Threshold                | ✅ Implementiert |
| **Webhook Support**      | payment.received Events                              | ✅ Implementiert |
| **Nostr Integration**    | Payment über Nostr                                   | ✅ Implementiert |
| **Multi-Mint Support**   | Mehrere Cashu Mints                                  | ✅ Implementiert |
| **VAT/MwSt Support**     | Steuerberechnung                                     | ✅ Implementiert |

### 1.2 Numo Webhook Payload

Numo sendet detaillierte Webhooks bei `payment.received`:

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
    lightningQuoteId?: string;
    lightningMintUrl?: string;
  };
  checkout?: {
    items: NumoCheckoutLineItem[];
    totalSatoshis: number;
    hasVat: boolean;
    vatBreakdown: Record<string, number>;
  };
  transaction?: NumoTransactionMetadata;
  terminal: {
    platform: 'android';
    appPackage: string;
    appVersionName: string;
  };
}
```

### 1.3 NDEF Tap-2-Pay Protokoll

Numo implementiert ein vollständiges NFC/HCE Protokoll:

```
PoS (Numo)                     Payer (Wallet)
    │                               │
    │  SELECT AID: D2760000850101   │
    │◀─────────────────────────────│
    │  90 00 (OK)                   │
    │                               │
    │  SELECT NDEF File E104        │
    │◀─────────────────────────────│
    │  90 00                        │
    │                               │
    │  READ NDEF (Payment Request)  │
    │─────────────────────────────▶│
    │  "creqA..." (Cashu Request)   │
    │                               │
    │  [Wallet verarbeitet Payment] │
    │                               │
    │  WRITE NDEF (Token/URL)       │
    │◀─────────────────────────────│
    │  "cashuB..." oder URL         │
    │                               │
    │  [PoS validiert & redeemt]    │
    │                               │
```

**Key Details:**

- AID: `D2 76 00 00 85 01 01` (NDEF Tag Application)
- Max NDEF Size: 28,671 bytes
- Timeout: 3000ms für partial messages

---

## 2. Vergleich: Numo vs. ZapOut

| Feature               | Numo              | ZapOut                      |
| --------------------- | ----------------- | --------------------------- |
| **Platform**          | Android Native    | Web (React)                 |
| **Lightning**         | BOLT11 + LND      | LND via SSH                 |
| **Cashu**             | Vollständig (CDK) | NUT-04/05/07                |
| **Tap-2-Pay**         | ✅ NFC HCE        | ❌ (Web Browser Limitation) |
| **Merchant Catalog**  | ✅                | ❌ (geplant)                |
| **Basket System**     | ✅                | ❌ (geplant)                |
| **VAT Support**       | ✅                | ❌ (geplant)                |
| **Auto-Withdraw**     | ✅                | ❌ (Bringin geplant)        |
| **Webhook Empfänger** | ✅                | ❌                          |
| **Nostr**             | ✅ Zaps           | ❌ (geplant)                |
| **Multi-Device**      | ❌                | ✅ (Backup Device)          |
| **Passkey Login**     | ❌                | ✅                          |
| **EUR Settlement**    | ❌                | ✅ (Bringin)                |
| **LND on Helmut**     | ❌                | ✅                          |
| **Hardware Wallet**   | ❌                | ✅ (geplant)                |

### 2.1 Stärken

**Numo:**

- Komplett mobile Lösung (NFC Tap)
- Reife Cashu Integration
- Swap-to-Lightning für ANY Mint
- VAT/Steuer-Support
- Webhook API für externe Integrationen

**ZapOut:**

- Browser-basiert (kein App-Download)
- Passkey Authentifizierung
- Helmut Integration (LND + Cashu Mint + LNbits)
- Bringin EUR Settlement
- Multi-Device Backup
- Hardware Wallet Support geplant

---

## 3. Strategische Optionen

### Option A: Numo als Integration (Empfohlen)

**Nutze Numo als Payment-Quelle, ZapOut als Management:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    ZAPOUT + NUMO INTEGRATION                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Customer          Numo (Android)        ZapOut (Web)          │
│      │                    │                    │                │
│      │  Tap/QR Pay        │                    │                │
│      │ ──────────────────▶│                    │                │
│      │                    │                    │                │
│      │                    │  Webhook            │                │
│      │                    │ ──────────────────▶│                │
│      │                    │                    │                │
│      │                    │                    │  Dashboard     │
│      │                    │                    │  EUR Settlement│
│      │                    │                    │  Reports       │
│      │                    │                    │                │
│      │                    │◀───────────────────│                │
│      │                    │  Config Updates     │                │
│      │                    │                    │                │
└─────────────────────────────────────────────────────────────────┘
```

**Vorteile:**

- Numo kümmert sich um NFC/Tap
- ZapOut kümmert sich um Business-Logic
- Beide Systeme nutzen dieselbe Helmut-Infrastruktur
- Faster Time-to-Market

**Nachteile:**

- Kunde muss Numo installieren (oder kompatible Wallet)
- Doppelte Infrastruktur

### Option B: ZapOut als Alternative (Eigenständig)

**ZapOut entwickelt sich als Web-basierte Alternative:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    ZAPOUT ALTERNATIVE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Customer                                                     │
│   ┌─────────────────┐                                          │
│   │ Beliebige       │  ◀── Kein App-Download nötig!           │
│   │ Lightning/Cashu │                                          │
│   │ Wallet          │                                          │
│   └────────┬────────┘                                          │
│            │                                                    │
│            │ QR / WebNFC (später)                              │
│            ▼                                                    │
│   ┌─────────────────────────────────────────┐                   │
│   │        ZapOut Web POS                   │                   │
│   │                                          │                   │
│   │  • Browser-basiert (kein Install)       │                   │
│   │  • Passkey Auth                         │                   │
│   │  • Lightning + Cashu                    │                   │
│   │  • Helmut Integration                   │                   │
│   │  • Bringin EUR Settlement              │                   │
│   │  • Multi-Device Backup                  │                   │
│   │                                          │                   │
│   └─────────────────────────────────────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Vorteile:**

- Keine App-Installation für Kunden
- Volle Kontrolle über Features
- Helmut als Backend

**Nachteile:**

- WebNFC nur auf Android Chrome
- Mehr Entwicklungsaufwand

### Option C: Hybrid (Beides)

**Numo für NFC, ZapOut für Web/Merchant-Management:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    HYBRID APPROACH                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Helmut                                                          │
│   ┌─────────────────────────────────────────┐                   │
│   │  • LND (SynapseLN)                      │                   │
│   │  • Cashu Mint (LNbits)                   │                   │
│   │  • LNbits                               │                   │
│   └────────────────┬────────────────────────┘                   │
│                    │                                              │
│         ┌─────────┴─────────┐                                   │
│         ▼                   ▼                                    │
│   ┌─────────────┐     ┌─────────────┐                           │
│   │    Numo     │     │   ZapOut    │                           │
│   │  (Android)  │     │   (Web)     │                           │
│   │             │     │             │                           │
│   │ NFC Tap-Pay │     │ Dashboard   │                           │
│   │             │     │ Reports     │                           │
│   │ Cashu only  │     │ EUR Settle  │                           │
│   └─────────────┘     └─────────────┘                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Empfehlung

### Kurzfristig: **Option C (Hybrid)**

1. **Numo als NFC/Tap-Lösung** - Bereits fertig!
2. **ZapOut als Management-Dashboard** - Bringin, Reports, Helmut-Stats
3. **Webhook-Endpoint in ZapOut** - Empfängt Numo Payments

### ZapOut Webhook-Endpoint (Backend):

```python
@app.post("/webhooks/numo")
async def receive_numo_webhook(payload: NumoPaymentReceivedWebhookV2):
    """
    Empfängt Numo payment.received Webhooks
    """
    if payload.event != "payment.received":
        return {"status": "ignored"}

    payment = payload.payment

    # Payment in DB speichern
    await save_payment(
        payment_id=payment.paymentId,
        amount_sats=payment.amountSats,
        payment_type=payment.paymentType,
        mint_url=payment.mintUrl,
        tip_sats=payment.tipAmountSats,
        lightning_invoice=payment.lightningInvoice,
        timestamp=datetime.fromtimestamp(payload.timestampMs / 1000)
    )

    # Checkout-Details speichern falls vorhanden
    if payload.checkout:
        await save_checkout(payload.checkout)

    # Settlement anstoßen (optional)
    if bringin_enabled:
        await settlement_service.initiate_settlement(payment.amountSats)

    return {"status": "received"}
```

### UI-Dashboard Erweiterungen:

| Screen            | Funktion                        |
| ----------------- | ------------------------------- |
| **Numo Devices**  | Verbundene Numo-Geräte anzeigen |
| **Numo Payments** | Payments von Numo Webhooks      |
| **Combined View** | Alle Payments (Numo + ZapOut)   |
| **Settlement**    | Bringin EUR Auszahlung          |

---

## 5. Nächste Schritte

### Phase 1: Numo Webhook Integration (1-2 Tage)

- [ ] `/webhooks/numo` Endpoint in ZapOut
- [ ] Numo Webhook URL konfigurieren (Pointing to ZapOut)
- [ ] Dashboard: Numo Payments Tab

### Phase 2: Combined Dashboard (2-3 Tage)

- [ ] Unified Payment List (Numo + ZapOut)
- [ ] Combined Revenue Stats
- [ ] Settlement Status (Bringin)

### Phase 3: Numo als Payment Source (Optional)

- [ ] ZapOut generiert Payment Requests
- [ ] Numo empfängt als Händler
- [ ] Webhook zurück an ZapOut

---

## 6. Fazit

**Numo ist ein ausgereiftes, komplettes Merchant POS** mit:

- NDEF Tap-2-Pay
- Swap-to-Lightning für ANY Mint
- Webhook API
- VAT Support

**ZapOut ist komplementär:**

- Web-basiertes Dashboard
- Passkey Auth
- Helmut Integration
- Bringin EUR Settlement
- Multi-Device Backup

**Empfehlung:** Nutze **beide** - Numo für Kundenzahlungen (NFC), ZapOut für Management und Settlement.

---

_Letztes Update: 2026-03-19_
