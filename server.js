require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { makeProviders, extractAgents } = require('./lib/providers');
const {
  AppError,
  validateMessage,
  validateLanguage,
  validateLabel,
  validateEnumNumber,
  validateDistance,
  ALLOWED_MODE_FACTORS,
  ALLOWED_FOOD_FACTORS
} = require('./lib/validate');
const {
  CHAT_SYSTEM_PROMPT,
  translatePreamble,
  CONTROL_SYSTEM_PROMPT,
  SUSTAIN_SYSTEM_PROMPT
} = require('./lib/prompts');

const app = express();

// ---------- security middleware ----------
// CSP is left off by default because this static demo pulls Google Fonts;
// lock this down to your real font/CDN origins before production use.
app.use(helmet({ contentSecurityPolicy: false }));
app.disable('x-powered-by');

// The API and the frontend are served from the same origin, so no
// cross-origin access is needed by default. Set ALLOWED_ORIGIN in .env
// only if you split the frontend onto a different host.
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || false }));

app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Every request that reaches a paid AI provider is rate-limited per IP —
// caps abuse and caps your API bill.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please wait a moment and try again.' }
});
app.use('/api/', aiLimiter);

// ---------- config ----------

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const COHERE_MODEL = process.env.COHERE_MODEL || 'command-r-plus-08-2024';
const PORT = process.env.PORT || 3000;

const { groqChat, cohereChat } = makeProviders({
  groqApiKey: process.env.GROQ_API_KEY || '',
  cohereApiKey: process.env.COHERE_API_KEY || '',
  groqModel: GROQ_MODEL,
  cohereModel: COHERE_MODEL
});

// ---------- routes ----------

app.get('/api/health', (req, res) => {
  res.json({
    groq: Boolean(process.env.GROQ_API_KEY),
    cohere: Boolean(process.env.COHERE_API_KEY)
  });
});

app.post('/api/chat', async (req, res, next) => {
  try {
    const message = validateMessage(req.body.message);
    const raw = await groqChat([
      { role: 'system', content: CHAT_SYSTEM_PROMPT },
      { role: 'user', content: message }
    ]);
    res.json(extractAgents(raw));
  } catch (e) {
    next(e);
  }
});

app.post('/api/translate', async (req, res, next) => {
  try {
    const message = validateMessage(req.body.message);
    const target = validateLanguage(req.body.target);
    const reply = await cohereChat(message, translatePreamble(target));
    res.json({ reply });
  } catch (e) {
    next(e);
  }
});

app.post('/api/control', async (req, res, next) => {
  try {
    const message = validateMessage(req.body.message);
    const reply = await groqChat([
      { role: 'system', content: CONTROL_SYSTEM_PROMPT },
      { role: 'user', content: message }
    ], 0.5);
    res.json({ reply });
  } catch (e) {
    next(e);
  }
});

app.post('/api/sustain', async (req, res, next) => {
  try {
    const modeFactor = validateEnumNumber(req.body.modeFactor, ALLOWED_MODE_FACTORS, 'modeFactor');
    const foodFactor = validateEnumNumber(req.body.foodFactor, ALLOWED_FOOD_FACTORS, 'foodFactor');
    const distanceKm = validateDistance(req.body.distanceKm);
    const modeLabel = validateLabel(req.body.modeLabel, 'Selected mode');
    const foodLabel = validateLabel(req.body.foodLabel, 'Selected meal');

    const totalCO2 = Number((modeFactor * distanceKm + foodFactor).toFixed(2));
    const user = `Travel: ${modeLabel}, ${distanceKm} km. Food: ${foodLabel}. Total footprint: ${totalCO2} kg CO2e.`;
    const note = await groqChat([
      { role: 'system', content: SUSTAIN_SYSTEM_PROMPT },
      { role: 'user', content: user }
    ], 0.7);
    res.json({ totalCO2, note });
  } catch (e) {
    next(e);
  }
});

// 404 for unknown API routes
app.use('/api/', (req, res) => res.status(404).json({ error: 'Not found' }));

// Centralized error handler — never leaks stack traces or upstream bodies
app.use((err, req, res, next) => {
  const status = err instanceof AppError ? err.status : (err.status || 500);
  if (status >= 500) console.error('Unhandled error:', err);
  res.status(status).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`ORION server running at http://localhost:${PORT}`);
  console.log(`Groq key loaded:   ${Boolean(process.env.GROQ_API_KEY)}`);
  console.log(`Cohere key loaded: ${Boolean(process.env.COHERE_API_KEY)}`);
});
