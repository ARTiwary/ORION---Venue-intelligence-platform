// Default: empty means "same origin as the page" — correct when the
// frontend and backend are served by the same process (e.g. `npm start`
// locally, or a single-service Render deploy).
// On Vercel, scripts/generate-config.js overwrites this file at build time
// using the API_BASE_URL environment variable you set in Vercel's dashboard.
window.API_BASE = "";
