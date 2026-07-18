const test = require('node:test');
const assert = require('node:assert/strict');

const { extractAgents } = require('../lib/providers');

test('extractAgents pulls the tag out and strips it from the reply', () => {
  const raw = 'Head to Gate 14, it is a five minute walk.\n[[AGENTS: polaris,vega]]';
  const { reply, agents } = extractAgents(raw);
  assert.equal(reply, 'Head to Gate 14, it is a five minute walk.');
  assert.deepEqual(agents, ['polaris', 'vega']);
});

test('extractAgents handles a single agent', () => {
  const { agents } = extractAgents('Some answer.\n[[AGENTS: lyra]]');
  assert.deepEqual(agents, ['lyra']);
});

test('extractAgents returns an empty list when the tag is missing', () => {
  const { reply, agents } = extractAgents('Just a plain answer with no tag.');
  assert.equal(reply, 'Just a plain answer with no tag.');
  assert.deepEqual(agents, []);
});

test('extractAgents returns an empty list when the tag is present but empty', () => {
  const { agents } = extractAgents('Answer.\n[[AGENTS: ]]');
  assert.deepEqual(agents, []);
});

test('extractAgents is case-insensitive on the tag keyword', () => {
  const { agents } = extractAgents('Answer.\n[[agents: atlas]]');
  assert.deepEqual(agents, ['atlas']);
});
