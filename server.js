require('dotenv').config();
const { createApp } = require('./lib/app');

const PORT = Number(process.env.PORT) || 3000;
if (!Number.isInteger(PORT) || PORT <= 0) {
  console.error(`Invalid PORT value: "${process.env.PORT}" — must be a positive integer.`);
  process.exit(1);
}

const allowedOrigins = (process.env.ALLOWED_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const app = createApp({
  groqApiKey: process.env.GROQ_API_KEY || '',
  cohereApiKey: process.env.COHERE_API_KEY || '',
  groqModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  cohereModel: process.env.COHERE_MODEL || 'command-r-plus-08-2024',
  allowedOrigins
});

app.listen(PORT, () => {
  console.log(`ORION server running at http://localhost:${PORT}`);
  console.log(`Groq key loaded:   ${Boolean(process.env.GROQ_API_KEY)}`);
  console.log(`Cohere key loaded: ${Boolean(process.env.COHERE_API_KEY)}`);
  if (!process.env.GROQ_API_KEY || !process.env.COHERE_API_KEY) {
    console.warn('Warning: one or more AI provider keys are missing — related endpoints will return 503 until .env is configured.');
  }
});

module.exports = app;
