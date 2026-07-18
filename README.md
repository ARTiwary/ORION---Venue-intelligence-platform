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
├── server.js           Express app: routing, security middleware, error handling
├── lib/
│   ├── providers.js     Groq/Cohere network calls, timeouts, no error leakage
│   ├── validate.js      input validation — the security boundary
│   └── prompts.js       system prompts, kept out of route handlers
├── test/                unit tests (node --test, no extra dependency)
├── package.json
├── .env.example         copy to .env and fill in your keys
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js           calls /api/* — never touches API keys directly
├── JUDGING_CRITERIA.md  how this build addresses each rubric item
└── README.md
```

## Setup

```bash
cd orion-prototype
npm install
cp .env.example .env
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

Open **http://localhost:3000**. The status strip under the title tells you
immediately whether both keys loaded — if it's red, check `.env` and restart.

For auto-restart on file changes during development:

```bash
npm run dev
```

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
