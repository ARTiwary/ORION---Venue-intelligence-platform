const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { makeProviders, extractAgents } = require('./providers');
const {
  AppError,
  validateMessage,
  validateLanguage,
  validateLabel,
  validateEnumNumber,
  validateDistance,
  ALLOWED_MODE_FACTORS,
  ALLOWED_FOOD_FACTORS
} = require('./validate');
const {
  CHAT_SYSTEM_PROMPT,
  translatePreamble,
  CONTROL_SYSTEM_PROMPT,
  SUSTAIN_SYSTEM_PROMPT
} = require('./prompts');

/**
 * Wrap an async Express handler so any thrown/rejected error is forwarded to
 * next() automatically. Removes repeated try { ... } catch (e) { next(e) }
 * boilerplate from every route below.
 * @param {(req: import('express').Request, res: import('express').Response) => Promise<void>} handler
 */
function asyncRoute(handler) {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}

/**
 * Build a fully configured Express app.
 *
 * Deliberately separated from server.js / process.env / app.listen() so
 * tests (and any future embedder) can construct an isolated app instance
 * with fake keys and a fast rate-limit window, with no real network
 * listener and no shared global state between test runs.
 *
 * @param {object} [config]
 * @param {string} [config.groqApiKey]
 * @param {string} [config.cohereApiKey]
 * @param {string} [config.groqModel]
 * @param {string} [config.cohereModel]
 * @param {string[]} [config.allowedOrigins] - CORS allowlist; empty = same-origin only
 * @param {{windowMs: number, max: number}} [config.rateLimitOptions]
 * @param {string} [config.staticDir]
 * @returns {import('express').Express}
 */
function createApp(config = {}) {
  const {
    groqApiKey = '',
    cohereApiKey = '',
    groqModel = 'llama-3.3-70b-versatile',
    cohereModel = 'command-r-plus-08-2024',
    allowedOrigins = [],
    rateLimitOptions = { windowMs: 60 * 1000, max: 20 },
    staticDir = path.join(__dirname, '..', 'public')
  } = config;

  const app = express();

  // ---------- security & performance middleware ----------
  // CSP is left off because this demo pulls Google Fonts from a CDN; lock
  // this down to your real font/asset origins before production use.
  // @ts-expect-error — helmet's published type defs don't model direct-call
  // usage under CommonJS require(); the runtime behavior is correct and
  // covered by the security-header assertions in test/app.test.js.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.disable('x-powered-by');
  app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : false }));
  app.use(compression()); // gzip/brotli responses — smaller payloads, faster loads
  app.use(express.json({ limit: '20kb' }));
  // 1-hour browser cache on static assets — repeat visits skip re-downloading
  // unchanged CSS/JS; ETag still lets the browser revalidate cheaply.
  app.use(express.static(staticDir, { maxAge: '1h', etag: true }));

  // Every request that can reach a paid AI provider is rate-limited per IP —
  // caps abuse and caps API spend. Configurable so tests can use a tiny
  // window instead of waiting on the real one.
  // @ts-expect-error — same CJS/require() type-def quirk as helmet above;
  // covered by the rate-limit 429 assertion in test/app.test.js.
  const aiLimiter = rateLimit({
    windowMs: rateLimitOptions.windowMs,
    max: rateLimitOptions.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests — please wait a moment and try again.' }
  });
  app.use('/api/', aiLimiter);

  const { groqChat, cohereChat } = makeProviders({ groqApiKey, cohereApiKey, groqModel, cohereModel });

  // ---------- routes ----------

  app.get('/api/health', (req, res) => {
    res.json({ groq: Boolean(groqApiKey), cohere: Boolean(cohereApiKey) });
  });

  app.post('/api/chat', asyncRoute(async (req, res) => {
    const message = validateMessage(req.body.message);
    const raw = await groqChat([
      { role: 'system', content: CHAT_SYSTEM_PROMPT },
      { role: 'user', content: message }
    ]);
    res.json(extractAgents(raw));
  }));

  app.post('/api/translate', asyncRoute(async (req, res) => {
    const message = validateMessage(req.body.message);
    const target = validateLanguage(req.body.target);
    const reply = await cohereChat(message, translatePreamble(target));
    res.json({ reply });
  }));

  app.post('/api/control', asyncRoute(async (req, res) => {
    const message = validateMessage(req.body.message);
    const reply = await groqChat([
      { role: 'system', content: CONTROL_SYSTEM_PROMPT },
      { role: 'user', content: message }
    ], 0.5);
    res.json({ reply });
  }));

  app.post('/api/sustain', asyncRoute(async (req, res) => {
    const modeFactor = validateEnumNumber(req.body.modeFactor, ALLOWED_MODE_FACTORS, 'modeFactor');
    const foodFactor = validateEnumNumber(req.body.foodFactor, ALLOWED_FOOD_FACTORS, 'foodFactor');
    const distanceKm = validateDistance(req.body.distanceKm);
    const modeLabel = validateLabel(req.body.modeLabel, 'Selected mode');
    const foodLabel = validateLabel(req.body.foodLabel, 'Selected meal');

    // Deterministic math done here in plain JS — no AI call spent on
    // arithmetic. The model is used only for the part that needs generation.
    const totalCO2 = Number((modeFactor * distanceKm + foodFactor).toFixed(2));
    const user = `Travel: ${modeLabel}, ${distanceKm} km. Food: ${foodLabel}. Total footprint: ${totalCO2} kg CO2e.`;
    const note = await groqChat([
      { role: 'system', content: SUSTAIN_SYSTEM_PROMPT },
      { role: 'user', content: user }
    ], 0.7);
    res.json({ totalCO2, note });
  }));

  // 404 for unknown API routes (falls through to static file 404 otherwise)
  app.use('/api/', (req, res) => res.status(404).json({ error: 'Not found' }));

  // Centralized error handler — never leaks stack traces or upstream
  // provider error bodies to the client.
  app.use((err, req, res, next) => {
    const status = err instanceof AppError ? err.status : (err.status || 500);
    if (status >= 500) console.error('Unhandled error:', err);
    res.status(status).json({ error: err.message || 'Internal server error' });
  });

  return app;
}

module.exports = { createApp, asyncRoute };
