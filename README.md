# ZapOut MVP

> Lightning + Cashu Bitcoin Payment App für Händler

## Features

- ⚡ **Lightning Payments** via LND on Helmut (SSH tunnel)
- 🪙 **Cashu NUT-04/05/07** Token Support
- 🔐 **Passkey Auth** mit PRF Key Derivation
- 👛 **Watch-Only Wallets** via LND
- 💳 **Merchant Dashboard** für Payment Requests
- 📦 **Product Management** mit Warenkorb
- 🌐 **PWA** - Installierbar als App
- 🌍 **i18n** - Deutsch + Englisch

## Tech Stack

| Layer     | Technology                     |
| --------- | ------------------------------ |
| Frontend  | React + Vite + Tailwind CSS v4 |
| Backend   | FastAPI (Python)               |
| Database  | SQLite                         |
| Lightning | LND on Helmut via SSH tunnel   |
| Cashu     | NUT-04/05/07 compatible        |
| Auth      | WebAuthn Passkey + JWT         |

## Quick Start

```bash
# Backend
cd ~/zapout-mvp/backend
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000

# Frontend
cd ~/zapout-mvp/frontend
npm run dev
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        MERCHANT                              │
│  ┌─────────────┐     ┌──────────────────────────────────┐ │
│  │ Passkey     │────▶│ WebAuthn PRF Extension           │ │
│  │ (Biometric) │     │ Seed = derive_prf(challenge)     │ │
│  └─────────────┘     └──────────────────────────────────┘ │
│                              │                               │
│                              ▼                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   ZapOut Backend                       │  │
│  │  • Passkey Registration / Login                       │  │
│  │  • JWT Token Auth                                     │  │
│  │  • PRF Salt Storage                                   │  │
│  │  • Watch-Only Wallet via LND                          │  │
│  │  • Cashu Integration                                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                              │                               │
│                              ▼ SSH Tunnel                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    HELMUT (Umbrel)                     │  │
│  │  • LND Node (SynapseLN)                              │  │
│  │  • LNbits                                            │  │
│  │  • Cashu Mint                                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Project Status

Siehe [STATUS.md](STATUS.md) für aktuellen Stand.

## Documentation

| Document                                                   | Description                   |
| ---------------------------------------------------------- | ----------------------------- |
| [STATUS.md](STATUS.md)                                     | Current implementation status |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)               | Technical architecture        |
| [docs/MERCHANT-ONBOARDING.md](docs/MERCHANT-ONBOARDING.md) | Merchant onboarding flow      |
| [docs/PROJECT-PLAN.md](docs/PROJECT-PLAN.md)               | Roadmap and feature planning  |
| [docs/UI-UX-DESIGN.md](docs/UI-UX-DESIGN.md)               | Design system and UI specs    |
| [docs/GIT-WORKFLOW.md](docs/GIT-WORKFLOW.md)               | Development workflow          |
| [docs/NUMO_COMPATIBILITY.md](docs/NUMO_COMPATIBILITY.md)   | Numo app integration plan     |

## License

MIT

---

_Letztes Update: 2026-03-19_
