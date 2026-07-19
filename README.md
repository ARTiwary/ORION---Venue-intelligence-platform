# ORION — GenAI stadium orchestrator (FIFA World Cup 2026)

A working prototype: a real Node/Express backend holding your Groq and Cohere
API keys server-side in `.env`, and a frontend that talks only to that server
— your keys are never exposed to the browser.

## What's real here

- **ORION Core** (`/api/chat`) — routes any fan/volunteer/steward question through
  Groq (`llama-3.3-70b-versatile` by default) and reports which of the six agents
  it considers relevant.
- **Cassiopeia** (`/api/translate`) — live multilingual, culturally-aware answers
  via Cohere Chat (`command-r-plus` by default).
- **Rigel + Atlas control room co-pilot** (`/api/control`) — Groq-generated
  "what-if" crowd/transport risk simulation.
- **Lyra** (`/api/sustain`) — deterministic carbon-footprint math done server-side,
  wrapped in a short Groq-generated personal note.

## Project structure

```
orion-prototype/
├── server.js            thin entrypoint: reads .env, calls createApp(), starts listening
├── lib/
│   ├── app.js            createApp() factory — all routes & middleware, fully testable
│   ├── providers.js      Groq/Cohere network calls, timeouts, no error leakage
│   ├── validate.js       input validation — the security boundary
│   └── prompts.js        system prompts, kept out of route handlers
├── scripts/
│   └── generate-config.js   build step: writes public/config.js from API_BASE_URL
├── test/                 28 tests (node --test, no extra dependency)
│   ├── app.test.js         integration tests against the real Express app
│   ├── providers.test.js   model-output parsing
│   └── validate.test.js    validation boundary
├── package.json
├── eslint.config.js      lint rules (npm run lint)
├── tsconfig.json         JSDoc-based type checking, no build step (npm run typecheck)
├── LICENSE
├── vercel.json           tells Vercel to run the build step and serve public/
├── .env                  fill in your keys
├── public/
│   ├── index.html
│   ├── style.css
│   ├── config.js         default (same-origin); overwritten at build time on Vercel
│   └── app.js            calls /api/* — never touches API keys directly
├── JUDGING_CRITERIA.md   how this build addresses each rubric item
└── README.md
```

## Setup

```bash
cd orion-prototype
npm install
cp .env
```

Edit `.env`:

```
GROQ_API_KEY=gsk_your_real_key
COHERE_API_KEY=your_real_key
```

Run it:

```bash
npm start
```

Run the test suite:

```bash
npm test
```

Run lint + typecheck + tests together:

```bash
npm run verify
```

Open **http://localhost:3000**. The status strip under the title tells you
immediately whether both keys loaded — if it's red, check `.env` and restart.

For auto-restart on file changes during development:

```bash
npm run dev
```

## Deploying frontend and backend separately (e.g. Vercel + Render)

If you deploy the backend on Render and the frontend on Vercel as two
separate services, the frontend needs to know the backend's URL. That value
is passed as an **environment variable**, not hardcoded in a file:

1. In your **Vercel** project → Settings → Environment Variables, add:
   ```
   API_BASE_URL=https://your-backend.onrender.com
   ```
   (no trailing slash)
2. Vercel runs `npm run build` on every deploy, which runs
   `scripts/generate-config.js` — that script reads `API_BASE_URL` and writes
   it into `public/config.js`, which the browser loads before `app.js`.
3. In your **Render** service → Environment, add the matching CORS allowlist
   entry so the backend accepts requests from your Vercel domain:
   ```
   ALLOWED_ORIGIN=https://your-frontend.vercel.app
   ```

If you're running everything from one server (`npm start`, or a single
Render service serving both), you don't need `API_BASE_URL` at all — leave
it unset and the frontend calls the API on the same origin automatically.

## Why keys are server-side, not in the browser

Anything shipped to the browser — including text typed into an `<input>` — is
visible to anyone who opens dev tools. Groq and Cohere keys in a client-side
`fetch()` call are effectively public. This version fixes that: the browser
only ever calls your own `/api/*` routes, and only `server.js` — which runs on
your machine, never shipped to the client — holds the real keys.

## Extending it

- Swap models via `GROQ_MODEL` / `COHERE_MODEL` in `.env` — no code changes needed.
- Add the remaining agents (Polaris, Vega) as their own `/api/*` routes following
  the same pattern as `/api/control`.
- Add a `Dockerfile` or deploy to Render/Railway/Fly.io for a public demo URL —
  just make sure `.env` values are set as platform environment variables, not
  committed to the repo.
