# ZapOut - Feature Adoption von Numo

> **Version:** 1.0 | **Datum:** 19.03.2026
> **Status:** PLANNING

---

## 1. Quick Wins (≤ 1 Tag)

### 1.1 Tips

Numo bietet: `+10%`, `+15%`, `+20%`, Custom

**ZapOut UI:**

```
┌─────────────────────────────────────────┐
|  💀 0.01 €                              │
├─────────────────────────────────────────┤
|  [+10%]  [+15%]  [+20%]  [Custom]       │
|                                         │
|  Basis:      1.00 €                     │
|  +20% Tips:  0.20 €                     │
|  ─────────────────                       │
|  Gesamt:     1.20 € / 2,783 sats       │
├─────────────────────────────────────────┤
|           [ ⚡ Payment Request ]          │
└─────────────────────────────────────────┘
```

**Backend:**

```python
TIP_PRESETS = [0.10, 0.15, 0.20]  # Percentages

@app.post("/merchant/payment-request")
async def create_payment_request(
    amount_cents: int,
    tip_percentage: Optional[float] = None,  # e.g., 0.20 for 20%
    tip_custom_sats: Optional[int] = None,
    method: str = "lightning"
):
    tip_amount = 0
    if tip_percentage:
        tip_amount = int(amount_cents * tip_percentage)
    elif tip_custom_sats:
        tip_amount = tip_custom_sats

    total_cents = amount_cents + tip_amount
    # ... create invoice with total
```

### 1.2 Mint Management (Settings)

Numo erlaubt: Mehrere Mints, Preferred Mint, "Accept unknown mints" Toggle

**ZapOut Settings UI:**

```
┌─────────────────────────────────────────┐
|  🏦 Cashu Mint Einstellungen             │
├─────────────────────────────────────────┤
|                                         │
|  Verbundene Mints:                      │
|  ┌─────────────────────────────────┐    │
|  | ✅ Cashu.HOST (Preferred)       |    │
|  |    Balance: 12,345 sats        |    │
|  ├─────────────────────────────────┤    │
|  | ☐ NUTstash                     |    │
|  |    Balance: 0 sats             |    │
|  └─────────────────────────────────┘    │
|                                         │
|  [+ Mint hinzufügen]                    │
|                                         │
|  ─────────────────────────────────────  │
|                                         │
|  ◉ Accept payments from any mint        │
|    (Auto-Swap zu Lightning)             │
|                                         │
|  ◉ Nur akzeptierte Mints               │
|    (Strenge Prüfung)                    │
|                                         │
└─────────────────────────────────────────┘
```

**Database Schema:**

```sql
ALTER TABLE users ADD COLUMN preferred_mint_url TEXT;
ALTER TABLE users ADD COLUMN accept_unknown_mints INTEGER DEFAULT 1;

CREATE TABLE user_mints (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    mint_url TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 1.3 Swap to Lightning Mint

Numo's Killer-Feature: Akzeptiert Token von ANY Mint, swapped automatisch zu Lightning.

**Flow:**

```
Customer Token (Mint X) → ZapOut → Swap zu Lightning Mint → LND Wallet
```

**Backend (Swap Logic):**

```python
from cashu.core.melt import MeltQuote
from cashu.core.mint import MintQuote

async def swap_unknown_mint_token(
    token: str,
    amount_sats: int,
    target_mint_url: str
) -> dict:
    """
    Swap ecash from unknown mint to Lightning
    """
    # 1. Decode token to get mint URL
    decoded = decode_token(token)
    source_mint_url = decoded["mint"]

    # 2. Get Lightning invoice from target mint
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

    # 4. Execute melt (pays the invoice)
    melt_result = await melt_token(
        mint_url=source_mint_url,
        quote_id=melt_quote.id,
        token=token
    )

    # 5. Verify payment
    if melt_result.paid:
        return {
            "success": True,
            "payment_hash": lnd_invoice.payment_hash,
            "source_mint": source_mint_url,
            "target_mint": target_mint_url
        }
    else:
        return {"success": False, "error": "Melt failed"}
```

---

## 2. Medium Complexity (2-3 Tage)

### 2.1 Auto-Withdrawal (mit Bringin)

Numo: Threshold-basiert → automatisch auf Lightning Address auszahlen

**ZapOut mit Bringin:**

```
┌─────────────────────────────────────────┐
|  💰 Auto-Auszahlung                      │
├─────────────────────────────────────────┤
|                                         │
|  Status:        [EIN] [AUS]             │
|                                         │
|  Threshold:     50 €                    │
|                                         │
|  ┌─────────────────────────────────┐    │
|  | Current Balance: 87.45 €       |    │
|  | Pending: 12.30 €               |    │
|  | ─────────────────────────────  |    │
|  | Wallet: DE89 002...            |    │
|  └─────────────────────────────────┘    │
|                                         │
|  Letzte Auszahlung: 18.03.2026 (45 €)  │
|                                         │
└─────────────────────────────────────────┘
```

**Backend (Cron Job):**

```python
async def check_auto_withdrawal(user_id: int):
    user = await get_user(user_id)

    if not user.auto_withdrawal_enabled:
        return

    balance_eur = await bringin.get_wallet_balance(user.wallet_id)

    if balance_eur >= user.withdrawal_threshold_eur:
        payout = await bringin.create_payout(
            wallet_id=user.wallet_id,
            amount_eur=balance_eur,
            reference=f"ZapOut Auto-Settlement"
        )

        await notify_user(user_id, f"Auszahlung erfolgt: {balance_eur}€")
```

### 2.2 Payment History Erweitern

Numo's Payment History zeigt detaillierte Informationen.

**ZapOut Erweiterung:**

```sql
ALTER TABLE payments ADD COLUMN tip_amount_sats INTEGER DEFAULT 0;
ALTER TABLE payments ADD COLUMN tip_percentage REAL;
ALTER TABLE payments ADD COLUMN source_mint_url TEXT;
ALTER TABLE payments ADD COLUMN swap_to_lightning INTEGER DEFAULT 0;
ALTER TABLE payments ADD COLUMN checkout_data TEXT;  -- JSON for items
```

**Frontend:**

```
┌─────────────────────────────────────────┐
|  📜 Payment History                      │
├─────────────────────────────────────────┤
|                                         │
|  Heute                                    │
|  ├─ 14:32  ⚡ 2,783 sats  (+20% tip)    │
|  |         Cashu • NUTstash             │
|  |         Status: ✅ settled           │
|  ├─ 12:15  ⚡ 1,500 sats               │
|  |         Lightning • SynapseLN        │
|  |         Status: ✅ settled           │
|  |                                      │
|  Gestern                                  │
|  └─ ...                                  │
|                                         │
└─────────────────────────────────────────┘
```

---

## 3. Phase 7 Features (POS Optimization)

### 3.1 Product Catalogs

Numo hat vollständige Produktverwaltung mit Kategorien, SKUs, Variationen.

**Database Schema:**

```sql
CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    name TEXT NOT NULL,
    price_cents INTEGER NOT NULL,
    price_type TEXT DEFAULT 'fiat',  -- 'fiat' or 'sats'
    category_id INTEGER REFERENCES categories(id),
    sku TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    name TEXT NOT NULL,  -- e.g., "Size M", "Color Red"
    price_adjustment_cents INTEGER DEFAULT 0
);
```

### 3.2 Basket System

Warenkorb, der persistent ist und wiederholt werden kann.

```sql
CREATE TABLE baskets (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    name TEXT,  -- Optional: "Tisch 3", "Stammtisch"
    items TEXT NOT NULL,  -- JSON array of {product_id, quantity, variation}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. Nice-to-Have (Später)

### 4.1 VAT/MwSt Support

Numo berechnet MWSt und zeigt Breakdown.

### 4.2 Nostr Receipts (NIP-57)

Payment Receipt als Nostr Zap Event.

---

## 5. Implementation Priority

| Feature           | Komplexität | Nutzen  | Priorität |
| ----------------- | ----------- | ------- | --------- |
| Tips              | 1 Tag       | Hoch    | 🔴 NOW    |
| Mint Management   | 1 Tag       | Hoch    | 🔴 NOW    |
| Swap to Lightning | 2 Tage      | Hoch    | 🔴 NOW    |
| Auto-Withdrawal   | 2 Tage      | Mittel  | 🟡 Soon   |
| Payment History   | 1 Tag       | Mittel  | 🟡 Soon   |
| Product Catalogs  | 3 Tage      | Hoch    | 🟡 Soon   |
| Basket System     | 2 Tage      | Mittel  | 🟢 Later  |
| VAT Support       | 3 Tage      | Mittel  | 🟢 Later  |
| Nostr Receipts    | 2 Tage      | Niedrig | ⚪ Nice   |

---

## 6. Nächste Schritte

### Sofort (Tip + Mint Management + Swap)

1. Add tip_percentage to payment-request endpoint
2. Add user_mints table + Settings UI
3. Implement swap_unknown_mint_token()

---

_Letztes Update: 2026-03-19_
