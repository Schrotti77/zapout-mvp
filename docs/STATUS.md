# ZapOut - Status

> **Letzte Aktualisierung:** 19.03.2026 (22:17)

---

## Projekt-Übersicht

**ZapOut** ist ein Bitcoin Point-of-Sale (POS) System mit:

- Passkey-basierter Authentifizierung (PRF Key Derivation)
- LND Lightning Integration (Helmut)
- Cashu Multi-Mint Support + Helmut Mint
- Numo NFC Bridge (Dokumentation)
- Bringin EUR Settlement (Dokumentation)

---

## Phasen-Status

```
Phase 1: Foundation           ████████████ 100% ✅
Phase 2: Key Management      ████████████ 100% ✅
Phase 3: Watch-Only Wallet   █████████░░░░  80% ⏳
Phase 3.5: Cashu Management █████░░░░░░░░░  50% ⏳ 🔼
Phase 4: Multi-Device        ░░░░░░░░░░░░░░   0% ⏸️
Phase 5: Backup/Recovery     ░░░░░░░░░░░░░░   0% ⏸️
Phase 6: Employee Roles     ░░░░░░░░░░░░░░   0% ⏸️
Phase 7: POS Optimization   ███░░░░░░░░░░░░  20% ⏳ 🔼
Phase 8: External Integrations░░░░░░░░░░░░░   10% 🟡 🔼
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
| SEC-001 Challenge Verification  | 19.03.2026 | 56b4ee9          |
| Documentation Restructure       | 19.03.2026 | 0e4ded0          |
| Numo + Bringin Integration Docs | 19.03.2026 | 1fe11f7, 6ec2afe |
| Numo Feature Adoption Plan      | 19.03.2026 | 3dfe511          |
| Tips Feature (POS)              | 19.03.2026 | e896446          |
| Mint Management UI              | 19.03.2026 | d6a1bbc          |
| Helmut Mint (cdk-mintd)         | 19.03.2026 | -                |
| NUT-05 Melt API Fix             | 19.03.2026 | 33ef3fa          |
| Helmut Mint Integration         | 19.03.2026 | 6951f4d          |

### ✅ Helmut Mint LÄUFT

| Property | Value                                                                |
| -------- | -------------------------------------------------------------------- |
| URL      | `http://100.74.149.69:3338`                                          |
| Software | cdk-mintd v0.15.0                                                    |
| Pubkey   | `03701fab79eb1c2b703fa8395c8e3c0e8304b99fe9e6f7f8bdcd5c985fb907a41c` |
| NUTs     | 04,05,07,08,09,10,11,12,14,15,17,19,20                               |
| Status   | Running on Helmut                                                    |

### 🔴 Sofort zu implementieren

| Feature                    | Quelle      | Aufwand |
| -------------------------- | ----------- | ------- |
| Swap to Lightning (Engine) | Helmut Mint | 2 Tage  |
| Helmut Mint Monitoring     | Helmut Mint | 1 Tag   |
| Helmut Mint Backup         | Helmut Mint | 1 Tag   |

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
| Lightning   | LND on Helmut (SynapseLN)      | ✅     |
| Cashu Mint  | cdk-mintd on Helmut            | ✅ NEW |
| Cashu       | NUT-04/05/07 (via cashu-ts)    | ✅     |
| Auth        | WebAuthn Passkey + JWT + PRF   | ✅     |
| Swap Engine | cashu-ts + cdk-cli             | ⚠️     |
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
Cashu Mint: http://100.74.149.69:3338 (cdk-mintd)
```

---

## Dokumentation

| Doc                           | Version | Status                   |
| ----------------------------- | ------- | ------------------------ |
| PROJECT-PLAN.md               | 5.1     | ✅ Helmut Mint erweitert |
| ARCHITECTURE.md               | 2.1     | ✅ Helmut Mint erweitert |
| HELMUT-MINT.md                | 1.0     | ✅ NEU - Service-Idee    |
| MERCHANT-ONBOARDING-DESIGN.md | -       | ✅                       |
| NUMO_FEATURE_ADOPTION.md      | 1.0     | ✅ Neu erstellt          |
| NUMO_BRINGIN_INTEGRATION.md   | 2.0     | ✅ Erweitert             |
| FEATURES.md                   | 1.0     | ✅ Neu erstellt          |

---

## 💡 Neue Idee: Managed Cashu Mint Service

**Hypothesis:** Viele wollen Cashu Mint, aber:

- Keine Zeit/Lust Server zu betreiben
- Wissen nicht wie man cdk-mintd konfiguriert
- Haben keinen Lightning Node

**Lösungen:**

1. **Full Managed Mint** - Mint Hosting auf Helmut (~50€ Setup + 10€/Monat)
2. **Mint + LND Bundle** - Helmut's LND mitnutzen (~100€ + 20€/Monat)
3. **White-Label POS** - Komplette ZapOut Installation (~200€ + 30€/Monat)

**→ Details:** `docs/HELMUT-MINT.md`

---

## Nächste Schritte

1. **Helmut Mint produktiv machen** - Monitoring + Backups
2. **Swap Engine finalisieren** - Cross-Mint Flow
3. **Pilotkunde finden** - für Mint Hosting Service

---

_Letzte Änderung: 2026-03-19 22:17_
