# ZapOut MVP Status

**Version:** 0.1.0
**Datum:** 12.03.2026

## Aktueller Stand

### Features ✅
- User Registration/Login
- Lightning Payment Request (Breez API)
- Cashu Screen (Mock)
- Dashboard mit Historie

### Offen
- Echte Cashu Integration
- Helmut Deployment
- EUR Auszahlung

## Quick Start

```bash
# Backend
cd ~/zapout-mvp/backend && python3 -m uvicorn main:app --host 0.0.0.0 --port 8000

# Frontend
cd ~/zapout-mvp/frontend && npm run dev
```

## Test-Login
- Email: test2@cafe.de
- Passwort: test123

## Letzte Änderungen
- 12.03.2026: Cashu Screen hinzugefügt
- 12.03.2026: Frontend komplett überarbeitet
- 12.03.2026: LNbits auf Helmut mit LND verbunden
