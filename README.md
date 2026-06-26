# KeyNest

![Vue 3](https://img.shields.io/badge/Vue.js-3.4-4FC08D?style=flat-square&logo=vue.js&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare%20Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Tan35/KeyNest)

A self-hosted tool for validating LLM API keys in bulk and keeping track of them over time. Paste a list of keys, pick a provider, hit start, and get back a categorized report — valid, invalid, rate-limited, low balance, zero balance, duplicates — with real-time progress. Keys worth keeping can be dropped into a local vault where you can tag them, re-test them on demand, and see their balance history.

Forked from [ssfun/llm-api-key-checker](https://github.com/ssfun/llm-api-key-checker); thanks to the original author for the foundation this project was built on.

## Screenshots

![Main view](https://pub-47dec4f0f09a445f88ea7082e81a2960.r2.dev/Github/1-1.png)
![Key Manage](https://pub-47dec4f0f09a445f88ea7082e81a2960.r2.dev/Github/2-1.png)
![Key Detail](https://pub-47dec4f0f09a445f88ea7082e81a2960.r2.dev/Github/3-1.png)

## What it does

- **Bulk checking up to 50,000 keys per run**, streamed over a single WebSocket so results appear as they come in
- **Persistent key vault** — any key can be saved locally (IndexedDB) with an alias, tags, and per-key balance snapshots over time
- **24 providers out of the box**, including OpenAI, Anthropic, Google Gemini, DeepSeek, Moonshot, Groq, xAI, Qwen, Zhipu, SiliconFlow, OpenRouter, NewAPI, Perplexity, Nvidia, GitHub Models, and more
- **Balance queries** for providers that expose them: DeepSeek, Moonshot, SiliconFlow, OpenRouter, NewAPI
- **Regional egress** — route outbound requests through one of nine geographic regions via Cloudflare Durable Objects, useful when a provider gates access by country
- **Task control** — pause, resume, or stop a run at any time; the connection reconnects automatically if it drops mid-batch
- **Trilingual UI** (English / 繁體 / 简体) with light and dark themes

## How it's built

A single Cloudflare Worker serves the Vue 3 frontend as static assets *and* hosts the checking backend — there is no separate server process to run.

```
Browser (Vue 3 + Pinia + IndexedDB)
  │
  ├── HTTP POST /models   fetch available models for a key
  └── WS      /check      stream key-check results
       │
       ▼
Cloudflare Worker (src/index.js)
  ├── TaskManager          worker-pool, up to 20 concurrent in-flight checks
  ├── Provider strategies  openai · openai_responses · anthropic · gemini · tavily
  └── RegionalFetcher (DO) optional outbound proxy tied to a region
```

### Frontend

Five Pinia stores split the state cleanly: `config` (current provider, region, input), `checker` (WebSocket lifecycle and batch scheduling), `results` (categorized result buckets), `keyManager` (the persistent vault), and `ui` (modals, toasts, theme).

A few details worth calling out:

- Result lists use `vue-virtual-scroller` so tens of thousands of rows scroll smoothly
- Incoming results are buffered through a 100 ms window before being flushed to the store, which keeps the DOM quiet during heavy runs
- Large `.txt` imports are parsed in 10,000-line chunks via `setTimeout(0)` so the UI never freezes
- The vault lives entirely in IndexedDB (`idb` wrapper). Nothing syncs to any server unless you explicitly export

### Backend

One WebSocket connection is reused across many batches of 500 keys. The client ships a `start` command with a batch, the server streams back individual `result` messages plus a final `batch_done`, and the client then ships the next batch on the same socket. This avoids the per-batch connection overhead that a naive design would incur.

Per-provider checking strategies live in `src/checkers.js`. Adding a new provider usually means registering a strategy, touching `model_fetchers.js`, and adding an entry to `config/providers.json`.

Safety-critical bits:

- **SSRF protection** rejects private, loopback, link-local, and CGNAT addresses before any outbound request is made
- **User-Agent and Accept-Language rotation** on every outbound call (can be disabled via env vars)
- **In-memory rate limiting**: 10 WebSocket connections/minute and 30 `/models` calls/minute per IP
- **CORS whitelist** driven by `ALLOWED_ORIGINS`, with wildcard subdomain support

## Getting started

Requirements: Node 18+, a Cloudflare account, and `wrangler` (installed via `npm`).

```bash
git clone https://github.com/Tan35/api-check.git
cd api-check
npm install
```

Edit `wrangler.toml` and set `ALLOWED_ORIGINS` to the domain you'll serve from:

```toml
[vars]
ALLOWED_ORIGINS = "[\"https://your-domain.com\"]"
ENABLE_UA_RANDOMIZATION = "true"
ENABLE_ACCEPT_LANGUAGE_RANDOMIZATION = "true"
```

Run locally:

```bash
npm run dev           # Vite dev server, frontend only
npm run dev:wrangler  # Wrangler dev, backend + built assets
npm run dev:full      # build frontend, then run Wrangler
```

Deploy to Cloudflare:

```bash
npm run deploy
```

## Using it

The app has two tabs: **Checker** and **Key**.

**Checker** is for one-off batch validation. Paste keys (comma, semicolon, or newline separated), or drop a `.txt` file. Pick a provider, tweak the model or base URL if needed, and start. Results land in six tabs — Valid, Low balance, Zero balance, Rate limited, Invalid, Duplicate — and can be copied or exported per category.

**Key** is the persistent vault. Keys added here survive page reloads and can be:

- searched by token, alias, provider, or tag
- filtered by provider and status, sorted by any column
- tested individually without running a whole batch
- exported to JSON together with balance history and re-imported on another device

When a Checker run touches a key that's already in the vault, its status and balance are updated automatically, and a balance snapshot is appended to the history.

## Configuration

**`config/providers.json`** — the provider catalog. Each entry specifies:

| Field                          | Purpose                                                      |
| ------------------------------ | ------------------------------------------------------------ |
| `apiStyle`                     | Which request strategy to use (`openai`, `anthropic`, `gemini`, `openai_responses`, `tavily`) |
| `defaultBase` / `defaultModel` | Defaults shown in the UI                                     |
| `hasBalance`                   | Whether balance lookup is supported                          |
| `balanceEndpoint`              | Custom endpoint for balance queries, when applicable         |

**`config/regions.json`** — the region catalog for Durable Object egress.

**`wrangler.toml`** — Worker-level config:

| Variable                               | Default  | Purpose                                           |
| -------------------------------------- | -------- | ------------------------------------------------- |
| `ALLOWED_ORIGINS`                      | —        | JSON array of allowed CORS origins (wildcards OK) |
| `ENABLE_UA_RANDOMIZATION`              | `"true"` | Rotate User-Agent per outbound request            |
| `ENABLE_ACCEPT_LANGUAGE_RANDOMIZATION` | `"true"` | Rotate Accept-Language per outbound request       |

## Project layout

```
├── src/                      Cloudflare Worker
│   ├── index.js              routing + static asset fallback
│   ├── checkers.js           per-provider validation strategies
│   ├── model_fetchers.js     model-list fetchers
│   ├── websocket_handler.js  TaskManager, Durable Object, worker pool
│   └── utils/                cors · fetcher · rateLimit · security · url · userAgent
├── frontend/
│   └── src/
│       ├── App.vue
│       ├── stores/           5 Pinia stores
│       ├── components/       modals, key cards, selectors, panels
│       ├── db/keyStore.js    IndexedDB wrapper (idb)
│       ├── utils/keyParser.js
│       └── i18n.js           three-language dictionary
├── config/
│   ├── providers.json        24 providers
│   └── regions.json          9 regions
├── types/                    ambient .d.ts declarations
└── wrangler.toml
```

## A note on keys and safety

This tool is designed for validating keys you own. Keys never touch persistent storage on the server side — the Worker proxies requests to the upstream provider and nothing else. The local vault is confined to IndexedDB on the device where it was created.

If you deploy this publicly, keep `ALLOWED_ORIGINS` tight and consider placing Cloudflare Access in front of the Worker. The built-in rate limiter is best-effort (per isolate, not global) and is not a substitute for proper access control.

## Contributing

Pull requests welcome. Two small conventions:

- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `refactor:` …)
- Keep the existing JSDoc comment style when touching `.js` files — it's what drives the hover tooltips in editors

Adding a new provider is usually a three-file change:

1. Pick an `apiStyle` in `src/checkers.js` (or add a new one if the provider is exotic)
2. Add a model-list fetcher in `src/model_fetchers.js` if the provider has a non-standard `/models` endpoint
3. Register it in `config/providers.json`

## License

MIT. See [LICENSE](LICENSE) for the full text.
