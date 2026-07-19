# Judging criteria — how ORION addresses each

## Code quality
- `server.js` is a thin entrypoint (env parsing + `app.listen`); all routing and middleware logic lives in `lib/app.js` as a `createApp(config)` factory — dependency-injectable, no hidden reliance on `process.env` inside the app logic itself.
- Repeated `try/catch/next` boilerplate across four routes was replaced with a single `asyncRoute()` wrapper.
- Provider calls (`lib/providers.js`), validation (`lib/validate.js`), and prompts (`lib/prompts.js`) are each isolated in their own module with a single responsibility.
- `PORT` is validated at startup and the process exits with a clear message on a bad value, instead of failing silently or crashing deep inside Express.
- **Static analysis, not just style opinions**: `npm run lint` (ESLint 9, flat config) and `npm run typecheck` (TypeScript in `checkJs` mode over the backend via JSDoc — no build step, no `.ts` files) both run clean with **zero errors**. `npm run verify` chains lint → typecheck → test in one command.
- `LICENSE` (MIT) and complete `package.json` metadata (`description`, `license`, `engines`) included.

## Security
- **Provider keys never leave the server.** They're read from `.env`, used only inside `lib/providers.js`, and are never sent to the browser or logged.
- **Input validation is a hard boundary, not a suggestion.** Every field is validated in `lib/validate.js` before it reaches a prompt or a calculation — free-text is length-capped, language and emission-factor fields are whitelisted against a closed set, not accepted as arbitrary numbers/strings. Verified by test: an out-of-whitelist `modeFactor` is rejected with 400, and an empty message never reaches the provider call at all.
- **CORS is closed by default** (`origin: false`) since the API and frontend share an origin — this also stops other websites from riding your server's API keys. Verified by test: no `Access-Control-Allow-Origin` header is returned for a disallowed origin.
- **Rate limiting** (20 requests/minute/IP on `/api/*`) caps abuse and caps your provider bill — verified by test that the configured max trips a 429.
- **`helmet`** sets standard hardening headers (`X-Frame-Options`, `X-Content-Type-Options`, etc.) and `X-Powered-By` is disabled — verified by test.
- **No error leakage.** Upstream provider error bodies and stack traces are logged server-side only; the client gets a generic, safe message.
- Request bodies are capped at 20kb and outbound provider calls have a 15s timeout, so a slow/hung fetch can't tie up the server.

## Efficiency
- **Compression**: `compression()` middleware gzips/brotlis every response — verified a `style.css` response drops from serving with `Content-Length: 7698` uncompressed to a gzip-encoded response on a real GET request.
- **Static asset caching**: `express.static` now sets `Cache-Control: public, max-age=3600` with ETags, so repeat visits skip re-downloading unchanged CSS/JS instead of hitting the server every time.
- Server-side deterministic math (carbon footprint) is computed once, cheaply, in plain JS — no AI call wasted on arithmetic; the AI is used only for the part that actually needs generation (the personal note). Verified in tests that the AI provider is not called until after validation passes.
- Rate limiting doubles as a cost control, capping unnecessary provider spend.
- Outbound provider calls have a 15s timeout so a slow/hung fetch can't tie up a request indefinitely.

## Testing
- **28 tests total**, `node --test`, zero extra test dependencies:
  - `test/validate.test.js` — unit tests on the validation boundary (empty/oversized/malformed/malicious input, whitelist enforcement).
  - `test/providers.test.js` — unit tests on model-output parsing.
  - `test/app.test.js` — **integration tests against the real Express app**: spins up `createApp()` on an ephemeral local port per test, mocks only the outbound provider HTTP calls (Groq/Cohere), and asserts on real HTTP responses — status codes, JSON bodies, headers, and behavior. Covers: health check, validation short-circuiting *before* any provider call is made, successful response parsing, missing-key 503, deterministic footprint math, whitelist rejection, 404 handling, rate-limit 429 at the configured threshold, security headers present, and CORS header absence for a disallowed origin.
- All 28 tests pass on a clean run; also manually verified with a real server boot (not mocked) that health, compression, and validation all work end-to-end.

## Accessibility
- Semantic landmarks (`<nav>`, `<main>`, `<footer>`), a visible skip-to-content link, and a logical heading order.
- The live-demo tabs follow the full ARIA tablist pattern: `role="tablist"/"tab"/"tabpanel"`, `aria-selected`, roving `tabindex`, and arrow-key/Home/End keyboard navigation — not just click-only.
- Every form control has a real associated `<label>` (or `aria-label` where a visible label isn't wanted); the chat log is an `aria-live` region so new replies are announced.
- Visible focus rings on every interactive element (`:focus-visible`), and `prefers-reduced-motion` disables animation for users who need it.
- Decorative elements (the constellation diagram) are `aria-hidden` so they don't clutter screen-reader output.

## Problem statement alignment
Every required theme from the brief maps directly onto a working piece of the platform, not just a slide:

| Brief requirement | Where it lives |
|---|---|
| Navigation | "Ask ORION" — wayfinding-flavored answers |
| Crowd management | Control room "what if" simulator |
| Accessibility | Accessibility-aware answers in "Ask ORION"; the platform's own UI is itself accessible (see above) |
| Transportation | Control room co-pilot (transit/egress framing) |
| Sustainability | Live carbon receipt tab, real math + generated note |
| Multilingual assistance | Dedicated multilingual assistant tab, live model calls in 10 languages |
| Operational intelligence / real-time decision support | Control room co-pilot's structured risk output (risk level / impact / recommendation) |

Nothing in the demo is scripted or hard-coded text — every tab makes a real, live call to a generative model and returns a fresh answer each time.
