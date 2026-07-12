# KeyNest

![Vue 3](https://img.shields.io/badge/Vue.js-3.4-4FC08D?style=flat-square&logo=vue.js&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare%20Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Tan35/KeyNest)

A self-hosted tool for validating LLM API keys in bulk and keeping a per-user key vault. Paste a list of keys, pick a provider, hit start, and get back a categorized report — valid, invalid, rate-limited, low balance, zero balance, duplicates — with real-time progress.

Forked from [ssfun/llm-api-key-checker](https://github.com/ssfun/llm-api-key-checker); thanks to the original author for the foundation this project was built on.

## Screenshots

![Main view](https://pub-47dec4f0f09a445f88ea7082e81a2960.r2.dev/Github/1-1.png)
![Key Manage](https://pub-47dec4f0f09a445f88ea7082e81a2960.r2.dev/Github/2-1.png)
![Key Detail](https://pub-47dec4f0f09a445f88ea7082e81a2960.r2.dev/Github/3-1.png)

## What it does

- **Email/password auth** with invite-code registration; the app is gated until you sign in
- **Per-user key vault on Cloudflare D1** (not browser IndexedDB)
- **Bulk checking up to 50,000 keys per run**, streamed over a single WebSocket
- **24 providers out of the box**, including OpenAI, Anthropic, Google Gemini, DeepSeek, Moonshot, Groq, xAI, Qwen, Zhipu, SiliconFlow, OpenRouter, NewAPI, Perplexity, Nvidia, GitHub Models, and more
- **Balance queries** for providers that expose them
- **Regional egress** via Cloudflare Durable Objects
- **Task control** — pause, resume, or stop; reconnects if the socket drops mid-batch
- **Trilingual UI** (English / 繁體 / 简体) with light and dark themes

## How it's built

```
Browser (Vue 3 + Pinia)
  │  JWT in localStorage → Authorization: Bearer
  │
  ├── POST /api/auth/register|login|me
  ├── /api/keys…           user vault (D1)
  ├── HTTP POST /models
  └── WS      /check?token=JWT
       │
       ▼
Cloudflare Worker
  ├── D1 (users + vault_keys + balance_snapshots)
  ├── checkers / model_fetchers
  └── RegionalFetcher (DO)
```

## Auth (v2.2)

- Register requires **invite code** (default in `wrangler.toml`: `KeyNest2026`)
- Password: min 8 chars, PBKDF2-SHA-256 (100k iterations)
- Session: HS256 JWT (7 days), stored in the browser
- All checker/vault APIs require a valid JWT
- Log out clears the local JWT

Change secrets in `wrangler.toml` `[vars]` (or better: `wrangler secret put JWT_SECRET`):

| Variable | Purpose |
|----------|---------|
| `INVITE_CODE` | Registration invite code |
| `JWT_SECRET` | Signs session tokens — **change in production** |
| `ALLOWED_ORIGINS` | CORS allow list |

Apply the D1 schema once (already run on the project D1 if you used the same account):

```bash
npm run db:migrate
# or: wrangler d1 execute keynest --remote --file=./migrations/0001_init.sql
```

## Getting started

Requirements: Node 18+, a Cloudflare account, and `wrangler`.

```bash
git clone https://github.com/Tan35/KeyNest.git
cd KeyNest
npm install
npm run db:migrate
npm run deploy
```

## Using it

1. Open the site → **Register** with email, password, and invite code (or **Sign in**)
2. **Checker**: paste keys, pick provider, start
3. **Key**: vault is stored under your account on D1; import/export still works and writes to your user data

## Project layout

```
├── src/                      Cloudflare Worker
│   ├── index.js              routing + auth gates
│   ├── auth.js               register / login / me
│   ├── vault.js              /api/keys CRUD
│   ├── checkers.js
│   ├── model_fetchers.js
│   ├── websocket_handler.js
│   └── utils/
├── migrations/               D1 SQL
├── frontend/
│   └── src/
│       ├── components/AuthPage.vue
│       ├── stores/auth.js · authToken.js · keyManager.js
│       └── db/keyStore.js    API client (not IndexedDB)
├── config/
└── wrangler.toml
```

## Safety notes

- Vault data (including API keys) is stored **in your D1 database** under each user — protect `JWT_SECRET`, invite codes, and Cloudflare account access.
- The built-in rate limiter is best-effort per isolate.
- Keep `ALLOWED_ORIGINS` tight if you expose the Worker cross-origin.

## License

MIT.
