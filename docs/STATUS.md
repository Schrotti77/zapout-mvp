# ZapOut - Status

> **Letzte Aktualisierung:** 19.03.2026

---

## Projekt-Übersicht

**ZapOut** ist ein Bitcoin Point-of-Sale (POS) System mit:

- Passkey-basierter Authentifizierung
- LND Lightning Integration
- Cashu Multi-Mint Support
- Numo NFC Bridge
- Bringin EUR Settlement

---

## Phasen-Status

```
Phase 1: Foundation           ████████████ 100% ✅
Phase 2: Key Management       ████████████ 100% ✅
Phase 3: Watch-Only Wallet    █████████░░░░  80% ⏳
Phase 3.5: Cashu Management  ░░░░░░░░░░░░░░   0% 🔴 NEW
Phase 4: Multi-Device         ░░░░░░░░░░░░░░   0% ⏸️
Phase 5: Backup/Recovery     ░░░░░░░░░░░░░░   0% ⏸️
Phase 6: Employee Roles      ░░░░░░░░░░░░░░   0% ⏸️
Phase 7: POS Optimization    ░░░░░░░░░░░░░░   0% ⏸️
Phase 8: External Integrations░░░░░░░░░░░░░   0% 🟡
```

---

## Implementierte Features

### ✅ Abgeschlossen

| Feature                         | Datum      | Commit           |
| ------------------------------- | ---------- | ---------------- |
| Project Setup                   | 12.03.2026 | -                |
| Basic Auth (Email/Password)     | 12.03.2026 | -                |
| Passkey Registration            | 19.03.2026 | 570a42d          |
| LND Integration                 | 19.03.2026 | d923809          |
| PRF Key Derivation              | 19.03.2026 | 9f32813          |
| Documentation Restructure       | 19.03.2026 | 0e4ded0          |
| Numo + Bringin Integration Docs | 19.03.2026 | 1fe11f7, 6ec2afe |
| Numo Feature Adoption Plan      | 19.03.2026 | 3dfe511          |

### 🔴 Sofort zu implementieren

| Feature                      | Quelle | Aufwand |
| ---------------------------- | ------ | ------- |
| Tips (+10%, +15%, +20%)      | Numo   | 1 Tag   |
| Mint Management              | Numo   | 1 Tag   |
| Swap to Lightning (ANY Mint) | Numo   | 2 Tage  |
| Numo Webhook Receiver        | Numo   | 1 Tag   |

### 🟡 Geplant

| Feature                   | Quelle | Aufwand |
| ------------------------- | ------ | ------- |
| Auto-Withdrawal (Bringin) | Numo   | 2 Tage  |
| Product Catalogs          | Numo   | 3 Tage  |
| Basket System             | Numo   | 2 Tage  |
| Webhook Outbound          | Numo   | 1 Tag   |
| VAT/MwSt Support          | Numo   | 3 Tage  |

### ⏸️ Zurückgestellt

| Feature         | Grund                     |
| --------------- | ------------------------- |
| Multi-Device    | Passkey erst finalisieren |
| Hardware Wallet | Watch-Only reicht für MVP |
| Nostr Receipts  | NIP-57 später             |

---

## Tech Stack

| Layer       | Technology                     | Status |
| ----------- | ------------------------------ | ------ |
| Frontend    | React + Vite + Tailwind CSS v4 | ✅     |
| Backend     | FastAPI (Python)               | ✅     |
| Database    | SQLite                         | ✅     |
| Lightning   | LND on Helmut                  | ✅     |
| Cashu       | NUT-04/05/07                   | ✅     |
| Auth        | WebAuthn Passkey + JWT         | ✅     |
| Swap Engine | cashu-ts                       | ❌     |
| Bringin     | API                            | ❌     |

---

## Helmut Integration

```
Host: helmut-tail (100.74.149.69)
LND Container: lightning_lnd_1
LND Version: 0.20.0-beta
Node Alias: SynapseLN
Pubkey: 03534ada4a452825de8133701b1a8ca1dfd916336045e6a6f562fdb734ec0bc9f3
Channels: 3 aktiv
```

---

## Dokumentation

| Doc                           | Version | Status                   |
| ----------------------------- | ------- | ------------------------ |
| PROJECT-PLAN.md               | 5.0     | ✅ Komplett überarbeitet |
| ARCHITECTURE.md               | 2.0     | ✅ Cashu/Numo erweitert  |
| MERCHANT-ONBOARDING-DESIGN.md | -       | ✅                       |
| NUMO_FEATURE_ADOPTION.md      | 1.0     | ✅ Neu erstellt          |
| NUMO_BRINGIN_INTEGRATION.md   | 2.0     | ✅ Erweitert             |

---

## Nächste Schritte

1. **Tips implementieren** - Quick Win (1 Tag)
2. **Mint Management UI** - Settings erweitern
3. **Swap Engine** - cashu-ts Integration
4. **Numo Webhook Endpoint** - `/webhooks/numo`

---

_Letzte Änderung: 2026-03-19 12:22_
