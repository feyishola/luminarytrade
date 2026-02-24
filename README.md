# LuminaryTrade

> A TypeScript monorepo that connects blockchain integrations (Stellar + Soroban) with AI services for trading, credit scoring, fraud detection, and risk automation.

LuminaryTrade provides composable, production-minded building blocks — SDKs, backend services, frontend apps, smart contracts, examples, and DevOps scripts — so teams can iterate quickly and ship AI-enabled blockchain features.

---

## Key features

- 🔗 Blockchain connectors — Stellar Horizon client and Soroban contract helpers  
- 🧠 AI integrations — credit scoring, fraud detection, and risk signals with pluggable providers  
- ⚙️ TypeScript-first — strongly-typed SDKs that run in Node and the browser  
- 🛠 Example apps and CLI utilities to accelerate development  
- 📦 Monorepo layout — backend, frontend, contracts, docs, and shared libs in one place

---

## Project structure

A concise tree of the repo so contributors and maintainers can find what they need.

```text
luminarytrade/
├── backend/                  # Backend services and APIs
│   ├── src/                  # API source code (controllers, services, models)
│   ├── tests/                # Unit & integration tests
│   └── README.md
├── frontend/                 # Frontend applications and UI components
│   ├── apps/                 # Multiple apps (dashboard, wallet, etc.)
│   ├── components/           # Shared React components
│   └── README.md
├── contracts/                # Soroban smart contracts and build artifacts
│   ├── credit-score/         # Credit scoring contract(s)
│   ├── fraud-detect/         # Fraud detection contract(s)
│   └── common-utils/         # Shared contract utilities & tests
├── examples/                 # Example integrations & reference apps
│   ├── credit-scoring-app/
│   ├── wallet-chatbot/
│   └── fraud-detection-service/
├── packages/                 # Shared TypeScript packages / SDKs
│   ├── core/                 # Core SDK (connectors, types, utilities)
│   └── cli/                  # CLI tools and scripts
├── docs/                     # Documentation (guides, API reference)
├── scripts/                  # Build, deploy, and automation scripts
├── tests/                    # End-to-end and system tests
├── .github/                  # CI workflows, issue templates, PR templates
└── README.md                 # This file
```

---

## Quick start

Prerequisites
- Node 18+ (LTS recommended)
- pnpm (recommended) or npm/yarn
- Docker (recommended for local DB and contract testnet)
- AI provider API key (when using hosted AI features)

1. Clone the repository

```bash
git clone https://github.com/StellAIverse/luminarytrade.git
cd luminarytrade
```

2. Install top-level dependencies

```bash
pnpm install
```

3. Backend — development

```bash
cd backend
pnpm install
cp .env.example .env          # set DATABASE_URL, REDIS_URL, AI_API_KEY, etc.
pnpm dev                      # starts dev server (hot reload)
```

Default API:
- Health: GET /api/health
- Example: GET /api/accounts/:id/credit-score

4. Frontend — development

```bash
cd frontend
pnpm install
pnpm start
```

Open the frontend app at the configured port (commonly http://localhost:3000 or 3001).

5. Tests

- Backend tests

```bash
cd backend
pnpm test
```

- Frontend tests

```bash
cd frontend
pnpm test
```

6. Smart contracts

Contracts are under `contracts/`. Use the included build and deploy scripts or the Soroban toolchain to compile and deploy to testnet or a local VM. Example:

```bash
cd contracts/credit-score
pnpm install
pnpm build
# deploy using scripts or soroban CLI
```

---

## Configuration & environment variables

Common env variables (example):

```env
# backend
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@localhost:5432/luminary
REDIS_URL=redis://localhost:6379
AI_API_KEY=your_ai_api_key

# frontend
REACT_APP_API_URL=http://localhost:3000/api
REACT_APP_STELLAR_NETWORK=testnet
```

Each package/app has its own README with any additional required variables.

---

## Example: using the core SDK

A minimal usage example showing how to connect to Stellar and request a credit score:

```ts
import { StellarConnector, AIService } from '@luminarytrade/core';

const stellar = new StellarConnector({ network: 'testnet' });

const ai = new AIService({ apiKey: process.env.AI_API_KEY });

async function main() {
  const account = await stellar.getAccount('G...'); // public key
  const score = await ai.calculateCreditScore(account);
  console.log('Credit score:', score);
}

main().catch(console.error);
```

---

## Architecture notes

- Backend: REST API + background workers; stores account history and risk signals; exposes endpoints to request scoring and fraud checks.
- Frontend: React + TypeScript apps that consume backend APIs and show analytics/dashboards.
- Contracts: Soroban contracts implement on-chain scoring primitives and verifiable artifacts.
- Packages: Shared types and utilities live under `packages/` to keep DTOs and clients consistent across apps.

---

## Documentation

- `docs/authentication.md` - JWT auth flow, refresh rotation, CSRF, and frontend integration details.

---

## Contributing

We welcome contributions — bug reports, features, documentation improvements, examples, and tests.

1. Fork the repo and create a feature branch.
2. Open an issue describing your change or pick a task from Issues.
3. Add tests and documentation for new behavior.
4. Submit a pull request with a clear description and checklist.

See `CONTRIBUTING.md` in the repo for coding standards, branch strategy, and review guidance.

---

## Maintainers & community

- Maintained by the StellAIverse team. For urgent issues/coordination, open an issue or tag maintainers in PRs.

---

## License

This project is licensed under the MIT License. See the LICENSE file for details.

---
