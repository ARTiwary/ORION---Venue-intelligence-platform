// Runs at BUILD time (on Vercel, or manually before deploying anywhere
// static). It reads API_BASE_URL from the environment and writes it into
// public/config.js, which the browser loads as a plain global — this is how
// a value from an environment variable reaches client-side JS on a static
// host, since static files can't read process.env at request time.
const fs = require('fs');
const path = require('path');

const apiBase = (process.env.API_BASE_URL || '').replace(/\/$/, '');
const out = `// Auto-generated at build time from API_BASE_URL. Do not edit by hand.\nwindow.API_BASE = ${JSON.stringify(apiBase)};\n`;

fs.writeFileSync(path.join(__dirname, '..', 'public', 'config.js'), out);
console.log('Generated public/config.js — API_BASE =', apiBase || '(empty: same-origin mode)');
