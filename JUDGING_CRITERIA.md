# Judging criteria — how ORION addresses each

## Code quality
- Clear separation of concerns: `server.js` only wires routes; provider calls live in `lib/providers.js`, input rules in `lib/validate.js`, prompts in `lib/prompts.js`.
- Centralized error handling (one Express error middleware) instead of duplicated try/catch boilerplate per route.
- Consistent naming, small single-purpose functions, no dead code or leftover hackathon branding in source.

## Security
- **Provider keys never leave the server.** They're read from `.env`, used only inside `lib/providers.js`, and are never sent to the browser or logged.
- **Input validation is a hard boundary, not a suggestion.** Every field is validated in `lib/validate.js` before it reaches a prompt or a calculation — free-text is length-capped, language and emission-factor fields are whitelisted against a closed set, not accepted as arbitrary numbers/strings.
- **CORS is closed by default** (`origin: false`) since the API and frontend share an origin — this also stops other websites from riding your server's API keys.
- **Rate limiting** (20 requests/minute/IP on `/api/*`) caps abuse and caps your provider bill.
- **`helmet`** sets standard hardening headers (`X-Frame-Options`, `X-Content-Type-Options`, etc.) and `X-Powered-By` is disabled.
- **No error leakage.** Upstream provider error bodies and stack traces are logged server-side only; the client gets a generic, safe message.
- Request bodies are capped at 20kb and outbound provider calls have a 15s timeout, so a slow/hung fetch can't tie up the server.

## Efficiency
- Server-side deterministic math (carbon footprint) is computed once, cheaply, in plain JS — no AI call wasted on arithmetic; the AI is used only for the part that actually needs generation (the personal note).
- Static assets served directly by Express; no build step or bundler needed for this scale.
- Rate limiting doubles as a cost control, capping unnecessary provider spend.

## Testing
- `npm test` runs 23 unit tests (Node's built-in test runner, no extra dependency) covering the validation layer (the security boundary) and the model-output parsing logic — boundary values, rejection paths, and malformed/malicious input are all exercised.
- Manually verified end-to-end: empty/oversized input, an out-of-whitelist factor, a missing-key 503, an unknown route 404, and the rate limiter tripping at request 21.

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
