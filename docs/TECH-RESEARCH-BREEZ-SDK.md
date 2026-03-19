# Breez SDK Research - ZapOut

> Stand: 19.03.2026
> Recherchiert für: Passkey Login + Lightning Payments

---

## Wichtigste Erkenntnisse

### ⚠️ Alert: Altes SDK deprecated!

Das **breez-sdk-greenlight** ist **DEPRECATED**. Es gibt jetzt zwei Nachfolger:

- **Breez SDK - Spark** ← Für uns relevant!
- **Breez SDK - Liquid**

---

## Breez SDK - Spark

**Der Richtige für ZapOut!**

### Features

- Native Bitcoin Layer 2 Lightning
- Passkey Login für "seedless experience" ✅
- Spark Tokens (BTKN) - Bitcoin-native Token
- Multi-Device Support
- Real-time State Backup
- LNURL-Pay, Lightning Address, Bolt11
- Keys werden NUR vom User gehalten (non-custodial)
- **Kostenlos für Developer!**

### Passkey Login (Key Feature!)

```
Passkey Login Spec:
- Nutzt WebAuthn PRF Extension
- Wallet Keys werden DETERMINISTISCH aus Passkey abgeleitet
- Keys werden NIEMALS gespeichert - nur bei Login regeneriert
- Multi-Wallet Support via Nostr Relays
- Kein Seed Phrase nötig!
```

### Pricing

> **Entwickler: KOSTENLOS**
> End-User: Lightning-typische Gebühren (Routing Fees, keine Swap-Gebühren da native Lightning)

---

## Breez SDK - Liquid

### Features

- Liquid Network + Lightning
- USDT und Multi-Asset Support
- BOLT 12 & BIP 353
- Submarine Swaps für Lightning↔Liquid Konvertierung
- **Kostenlos für Developer!**

### End-User Fees (komplexer!)

**Sending Lightning (via Submarine Swap):**

```
Lockup Tx Fee: ~34 sats
Claim Tx Fee: ~19 sats
Swap Service: 0.1% des Betrags

Beispiel: 10.000 sats senden = ~63 sats Gebühren
```

**Receiving Lightning (via Reverse Submarine Swap):**

```
Lockup Tx Fee: ~27 sats
Claim Tx Fee: ~20 sats
Swap Service: 0.25% des Betrags

Beispiel: 10.000 sats empfangen = ~72 sats Gebühren
```

**Direct Liquid Transaction (wenn Magic Routing Hint):**

```
~26 sats (kein Swap nötig!)
```

---

## Vergleich: Spark vs Liquid

| Feature          | Spark ✅            | Liquid             |
| ---------------- | ------------------- | ------------------ |
| Native Lightning | ✅                  | ❌ (via Swap)      |
| Passkey Login    | ✅ "seedless"       | ❌ Nicht erwähnt   |
| USDT Support     | ❌                  | ✅                 |
| BTC Support      | ✅                  | ✅                 |
| Komplexität      | Niedrig             | Hoch (Swaps)       |
| End-User Fees    | Niedrig (native LN) | Mittel (0.1-0.25%) |
| für POS geeignet | ✅ **Perfekt**      | Über-engineered    |

---

## Empfehlung für ZapOut

### ✅ Breez SDK - Spark

**Warum:**

1. **Passkey Login eingebaut** - Perfect für Merchant Onboarding!
2. **Native Lightning** - Keine Swaps, niedrige Fees
3. **Einfach** - Kein Liquid Network Overhead
4. **Kostenlos** - Developer Fees = 0
5. **Multi-Device** - Backup-Phone Feature möglich

**Nachteile:**

- Kein USDT (für MVP nicht relevant)
- Kein LND auf Helmut ( aber earlier decision: erstmal Breez nutzen)

---

## Architektur mit Spark

```
┌─────────────────────────────────────────────────────────────┐
│                        MERCHANT                              │
│  ┌─────────────┐                                             │
│  │ Passkey     │──────► WebAuthn PRF ────► Wallet Keys       │
│  │ (Biometric) │         (kein Seed)         (regeneriert)   │
│  └─────────────┘                                             │
│         │                                                     │
│         ▼                                                     │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Breez SDK - Spark                           ││
│  │  • Lightning Payments (Bolt11)                          ││
│  │  • Multi-Device Sync                                     ││
│  │  • Real-time Backup                                     ││
│  │  • LNURL-Pay / Lightning Address                        ││
│  └─────────────────────────────────────────────────────────┘│
│         │                                                     │
│         ▼                                                     │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Greenlight (Blockstream)                   ││
│  │  • Nodes-on-Demand                                       ││
│  │  • Built-in LSP                                          ││
│  │  • User Keys only (non-custodial)                        ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Passkey Login - Technische Details

### Wie es funktioniert:

1. **Registration:**

   ```
   User erstellt Passkey (Fingerprint/Face/PIN)
   ↓
   WebAuthn PRF Extension generiert 32-byte Seed
   ↓
   Seed wird als Wallet Master Key verwendet
   ↓
   Keys werden NIEMALS gespeichert
   ```

2. **Login:**

   ```
   User authentifiziert sich mit Passkey
   ↓
   PRF derive_prf_seed(salt) → 32-byte Seed
   ↓
   Wallet Keys werden regeneriert
   ↓
   Zugriff auf Wallet
   ```

3. **Multi-Wallet via Nostr:**
   ```
   Labels werden auf Nostr Relay gespeichert
   SDK nutzt NIP-65 für Relay Discovery
   Breez API Key für authentifizierten Relay-Zugang
   ```

### Platform Configuration nötig:

Für Cross-Device Passkey Sharing:

| Platform | Config File                               | Kontakt             |
| -------- | ----------------------------------------- | ------------------- |
| Web      | `/.well-known/webauthn`                   | Breez kontaktieren  |
| Android  | `/.well-known/assetlinks.json`            | SHA256 Fingerprint  |
| iOS      | `/.well-known/apple-app-site-association` | Team ID + Bundle ID |

---

## Kostenübersicht

### Für ZapOut (als Developer):

| Posten            | Kosten                        |
| ----------------- | ----------------------------- |
| Breez SDK Nutzung | **KOSTENLOS**                 |
| API Key           | **KOSTENLOS** (für Developer) |
| Support           | Telegram / Email (kostenlos)  |

### Für Merchant (End-User):

| Posten              | Spark        | Liquid            |
| ------------------- | ------------ | ----------------- |
| Lightning Senden    | Routing Fees | 0.1% + ~53 sats   |
| Lightning Empfangen | Routing Fees | 0.25% + ~47 sats  |
| On-Chain Tx         | Routing Fees | 0.1% + Mining Fee |

**Hinweis:** Spark nutzt natives Lightning → typische LN Routing Fees (oft < 1 sat)

---

## Nächste Schritte für Implementation

1. **API Key beantragen**

   - Email: contact@breez.technology
   - Website: breez.technology/sdk

2. **Passkey Konfiguration**

   - Platform-Configs einrichten (Web/Android/iOS)
   - Nostr Relay Config vorbereiten

3. **Spark SDK integrieren**

   - React Native Bindings verfügbar
   - Passkey Provider implementieren

4. **UI/UX Design**
   - Passkey Registration Flow
   - Multi-Device Backup Flow

---

## Quellen

- Breez SDK Spark: https://sdk-doc-spark.breez.technology/
- Breez SDK Liquid: https://sdk-doc-liquid.breez.technology/
- Passkey Spec: https://github.com/breez/passkey-login/blob/main/spec.md
- Greenlight (deprecated): https://github.com/breez/breez-sdk-greenlight

---

## Offene Fragen

- [ ] API Key von Breez anfordern
- [ ] Kosten für End-User bei Spark final klären (Doku unklar)
- [ ] Spark SDK React Native Bindings testen
- [ ] Nostr Relay für Multi-Wallet testen
