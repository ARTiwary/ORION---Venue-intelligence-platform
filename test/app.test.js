const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { createApp } = require('../lib/app');

function startServer(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function stopServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

function baseUrl(server) {
  return `http://127.0.0.1:${server.address().port}`;
}

// Swap global.fetch for the duration of a test so provider calls hit a
// canned response instead of the real network. Only intercepts requests to
// the provider hosts — the test's own fetch() calls to the local test
// server pass through untouched, since Node has a single global fetch used
// by both this test file and the app under test.
function mockFetch(responder) {
  const original = global.fetch;
  global.fetch = async (url, options) => {
    const urlStr = String(url);
    if (urlStr.includes('api.groq.com') || urlStr.includes('api.cohere.com')) {
      return responder(urlStr, options);
    }
    return original(url, options);
  };
  return () => { global.fetch = original; };
}

function groqResponse(content) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}

test('GET /api/health reports key presence as booleans, never the values', async () => {
  const app = createApp({ groqApiKey: 'fake-key', cohereApiKey: '' });
  const server = await startServer(app);
  try {
    const res = await fetch(baseUrl(server) + '/api/health');
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.deepEqual(data, { groq: true, cohere: false });
    assert.equal(JSON.stringify(data).includes('fake-key'), false);
  } finally {
    await stopServer(server);
  }
});

test('POST /api/chat rejects an empty message with 400 and does not call the provider', async () => {
  let called = false;
  const restore = mockFetch(async () => { called = true; return groqResponse('should not happen'); });
  const app = createApp({ groqApiKey: 'fake', cohereApiKey: 'fake' });
  const server = await startServer(app);
  try {
    const res = await fetch(baseUrl(server) + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '' })
    });
    assert.equal(res.status, 400);
    assert.equal(called, false, 'validation should short-circuit before any network call');
  } finally {
    restore();
    await stopServer(server);
  }
});

test('POST /api/chat parses the reply and agent tag out of a successful model response', async () => {
  const restore = mockFetch(async () => groqResponse('Head to Gate 5, five minutes away.\n[[AGENTS: polaris]]'));
  const app = createApp({ groqApiKey: 'fake', cohereApiKey: 'fake' });
  const server = await startServer(app);
  try {
    const res = await fetch(baseUrl(server) + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Where is gate 5?' })
    });
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.reply, 'Head to Gate 5, five minutes away.');
    assert.deepEqual(data.agents, ['polaris']);
  } finally {
    restore();
    await stopServer(server);
  }
});

test('POST /api/chat returns 503, not a crash, when no provider key is configured', async () => {
  const app = createApp({ groqApiKey: '', cohereApiKey: '' });
  const server = await startServer(app);
  try {
    const res = await fetch(baseUrl(server) + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hello' })
    });
    const data = await res.json();
    assert.equal(res.status, 503);
    assert.ok(data.error);
  } finally {
    await stopServer(server);
  }
});

test('POST /api/sustain computes the footprint deterministically and includes a generated note', async () => {
  const restore = mockFetch(async () => groqResponse('Nice and light journey — keep it up!'));
  const app = createApp({ groqApiKey: 'fake', cohereApiKey: 'fake' });
  const server = await startServer(app);
  try {
    const res = await fetch(baseUrl(server) + '/api/sustain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modeFactor: 0.041, foodFactor: 0.08, distanceKm: 10, modeLabel: 'Metro', foodLabel: 'Mixed' })
    });
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.totalCO2, 0.49); // 0.041 * 10 + 0.08, rounded to 2dp
    assert.equal(typeof data.note, 'string');
    assert.ok(data.note.length > 0);
  } finally {
    restore();
    await stopServer(server);
  }
});

test('POST /api/sustain rejects a modeFactor outside the whitelist', async () => {
  const app = createApp({ groqApiKey: 'fake', cohereApiKey: 'fake' });
  const server = await startServer(app);
  try {
    const res = await fetch(baseUrl(server) + '/api/sustain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modeFactor: 999, foodFactor: 0.08, distanceKm: 10 })
    });
    assert.equal(res.status, 400);
  } finally {
    await stopServer(server);
  }
});

test('unknown /api/ routes return a clean 404, not a stack trace', async () => {
  const app = createApp({ groqApiKey: 'fake', cohereApiKey: 'fake' });
  const server = await startServer(app);
  try {
    const res = await fetch(baseUrl(server) + '/api/does-not-exist');
    const data = await res.json();
    assert.equal(res.status, 404);
    assert.ok(data.error);
  } finally {
    await stopServer(server);
  }
});

test('rate limiter returns 429 once the configured max is exceeded', async () => {
  const app = createApp({
    groqApiKey: 'fake',
    cohereApiKey: 'fake',
    rateLimitOptions: { windowMs: 60000, max: 2 }
  });
  const server = await startServer(app);
  try {
    const hit = () => fetch(baseUrl(server) + '/api/health');
    const [first, second, third] = [await hit(), await hit(), await hit()];
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(third.status, 429);
  } finally {
    await stopServer(server);
  }
});

test('responses carry hardening headers and no X-Powered-By', async () => {
  const app = createApp({ groqApiKey: 'fake', cohereApiKey: 'fake' });
  const server = await startServer(app);
  try {
    const res = await fetch(baseUrl(server) + '/api/health');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-powered-by'), null);
  } finally {
    await stopServer(server);
  }
});

test('a cross-origin request is rejected when no origin is allowlisted', async () => {
  const app = createApp({ groqApiKey: 'fake', cohereApiKey: 'fake', allowedOrigins: [] });
  const server = await startServer(app);
  try {
    const res = await fetch(baseUrl(server) + '/api/health', {
      headers: { Origin: 'https://evil.example.com' }
    });
    // cors() with origin:false omits the ACAO header entirely — the browser
    // (not this test) is what actually blocks the response, but we can at
    // least confirm the header is absent.
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  } finally {
    await stopServer(server);
  }
});
