# ZapOut Status

**Letztes Update:** 2026-03-19 23:53

---

## Projekt Status

| Phase     | Name                         | Status      |
| --------- | ---------------------------- | ----------- |
| Phase 1   | Auth (Email/Passwort)        | ✅ Komplett |
| Phase 2   | Passkey + PRF Key Derivation | ✅ Komplett |
| Phase 3   | Lightning + Cashu Basis      | ✅ Komplett |
| Phase 3.1 | Security (SEC-001)           | ✅ Komplett |
| Phase 3.5 | Cashu Management             | 🔄 80%      |
| Phase 4   | Merchant POS UI              | ✅ Komplett |
| Phase 5   | EUR Settlement (Bringin)     | 🔄 20%      |
| Phase 6   | Reports & Analytics          | 🔄 10%      |
| Phase 7   | POS Optimierung              | ✅ Komplett |
| Phase 8   | Externe Integrationen        | 🔄 30%      |

## Phase Details

### Phase 3.5 Cashu Management (🔄 80%)

- [x] Mint Management API + UI
- [x] Helmut Mint Setup (cdk-mintd v0.15.0 auf Port 3338)
- [x] Swap Engine (NUT-05 Melt API)
- [x] `/cashu/pay` Endpoint
- [ ] Swap to Lightning Test mit echter Mint

### Phase 3.1 Security (✅ Komplett)

- [x] SEC-001 Challenge Verification
- [x] SEC-001 Assertion Signature Verification
- [x] SEC-001 Counter Check (Replay Protection)

### Phase 7 POS Optimierung (✅ Komplett)

- [x] Tips (+10%, +15%, +20%)
- [x] Product Catalogs
- [x] Basket System (Save/Load)
- [x] VAT/MwSt Support (7%, 19%, 0%)

### Design System (🔄 In Arbeit)

- [x] UI-DESIGN-SYSTEM.md erstellt
- [x] Tailwind Config mit Surface Tokens
- [x] PaymentRequestScreen.jsx (Template)
- [ ] POSScreen Redesign (noch nicht vollständig)

---

## To-Do

### P0 - Must Have

- [ ] PaymentRequestScreen Design fix (Marian: "sieht nicht korrekt aus")
- [ ] Swap to Lightning Test

### P1 - Should Have

- [ ] WAL-001 Per-User Watch-Only Wallets
- [ ] REC-001 Seed Recovery System

### P2 - Nice to Have

- [ ] DEV-001 Multi-Device Support
- [ ] Numo NFC Tap-2-Pay Integration

---

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS v4
- **Backend:** FastAPI (Python) + SQLite
- **Lightning:** LND on Helmut via SSH
- **Cashu:** cdk-mintd on Helmut (Port 3338)
- **Auth:** Passkey (WebAuthn) + JWT
- **EUR Settlement:** Bringin API (integriert)

## Infrastructure

| Service      | URL                       | Status     |
| ------------ | ------------------------- | ---------- |
| Frontend Dev | http://localhost:3000     | ✅ Running |
| Backend API  | http://localhost:8000     | ✅ Running |
| Helmut Mint  | http://100.74.149.69:3338 | ✅ Running |
| Helmut LND   | Port 10009 (gRPC)         | ✅ Running |

---

## Wichtige Commands

```bash
# Frontend
cd ~/zapout-mvp/frontend && npm run dev

# Backend
cd ~/zapout-mvp/backend && python3 -m uvicorn main:app --host 0.0.0.0 --port 8000

# Helmut Mint (auf Helmut)
cd /home/umbrel && ./cdk-mintd

# SSH Tunnel für Mint (vom Laptop)
ssh -L 3338:localhost:3338 helmut-tail
```
