// All outbound AI provider calls live here, isolated from route handlers.
// Upstream error bodies are logged server-side but never forwarded verbatim
// to the client — provider error text can include request echoes we don't
// want reflected back out.

const { AppError } = require('./validate');

const PROVIDER_TIMEOUT_MS = 15000;

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function extractAgents(raw) {
  const match = raw.match(/\[\[AGENTS:\s*([a-z,]*)\]\]/i);
  const agents = match ? match[1].split(',').map(s => s.trim()).filter(Boolean) : [];
  const reply = raw.replace(/\[\[AGENTS:[^\]]*\]\]/i, '').trim();
  return { reply, agents };
}

function makeProviders({ groqApiKey, cohereApiKey, groqModel, cohereModel }) {
  async function groqChat(messages, temperature = 0.6) {
    if (!groqApiKey) throw new AppError('AI provider is not configured on the server', 503);
    let res;
    try {
      res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + groqApiKey
        },
        body: JSON.stringify({ model: groqModel, messages, temperature })
      });
    } catch (e) {
      console.error('[groq] network error:', e.message);
      throw new AppError('AI provider request failed', 502);
    }
    if (!res.ok) {
      console.error('[groq] upstream error', res.status, await res.text());
      throw new AppError('AI provider request failed', 502);
    }
    const data = await res.json();
    return data.choices[0].message.content;
  }

  async function cohereChat(message, preamble, temperature = 0.5) {
    if (!cohereApiKey) throw new AppError('AI provider is not configured on the server', 503);
    let res;
    try {
      res = await fetchWithTimeout('https://api.cohere.com/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + cohereApiKey
        },
        body: JSON.stringify({ model: cohereModel, message, preamble, temperature })
      });
    } catch (e) {
      console.error('[cohere] network error:', e.message);
      throw new AppError('AI provider request failed', 502);
    }
    if (!res.ok) {
      console.error('[cohere] upstream error', res.status, await res.text());
      throw new AppError('AI provider request failed', 502);
    }
    const data = await res.json();
    return data.text;
  }

  return { groqChat, cohereChat };
}

module.exports = { makeProviders, extractAgents };
