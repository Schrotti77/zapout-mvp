# ZapOut MVP

> Lightning + Cashu Bitcoin Payment App

## Features

- ⚡ **Lightning Payments** via LND (SynapseLN)
- 🪙 **Cashu NUT-04/05/07** Token Support
- 💳 **Merchant Dashboard** for payment requests
- 📦 **Product Management** with cart
- 🔐 **User Auth** with JWT tokens

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** FastAPI (Python)
- **Database:** SQLite
- **Lightning:** LND via SSH to Helmut
- **Cashu:** NUT-04/05/07 compatible

## Quick Start

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

## Project Status

See [docs/PROJECT-PLAN-V2.md](docs/PROJECT-PLAN-V2.md) for detailed roadmap.

## License

MIT
