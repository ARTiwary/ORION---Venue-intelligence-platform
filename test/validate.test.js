const test = require('node:test');
const assert = require('node:assert/strict');

const {
  AppError,
  validateMessage,
  validateLanguage,
  validateLabel,
  validateEnumNumber,
  validateDistance,
  ALLOWED_MODE_FACTORS,
  ALLOWED_FOOD_FACTORS
} = require('../lib/validate');

test('validateMessage accepts a normal string and trims it', () => {
  assert.equal(validateMessage('  hello there  '), 'hello there');
});

test('validateMessage rejects empty strings', () => {
  assert.throws(() => validateMessage(''), AppError);
  assert.throws(() => validateMessage('   '), AppError);
});

test('validateMessage rejects non-strings', () => {
  assert.throws(() => validateMessage(42), AppError);
  assert.throws(() => validateMessage(null), AppError);
  assert.throws(() => validateMessage(undefined), AppError);
  assert.throws(() => validateMessage({ toString: () => 'x' }), AppError);
});

test('validateMessage rejects oversized input', () => {
  const tooLong = 'a'.repeat(2001);
  assert.throws(() => validateMessage(tooLong), AppError);
});

test('validateMessage allows the boundary length', () => {
  const exact = 'a'.repeat(2000);
  assert.equal(validateMessage(exact).length, 2000);
});

test('validateLanguage passes through an allowed language', () => {
  assert.equal(validateLanguage('Korean'), 'Korean');
});

test('validateLanguage falls back to English for anything not on the whitelist', () => {
  assert.equal(validateLanguage('Klingon'), 'English');
  assert.equal(validateLanguage('<script>alert(1)</script>'), 'English');
  assert.equal(validateLanguage(123), 'English');
  assert.equal(validateLanguage(undefined), 'English');
});

test('validateLabel accepts a short clean string', () => {
  assert.equal(validateLabel('Metro / rail', 'fallback'), 'Metro / rail');
});

test('validateLabel falls back on empty or oversized input', () => {
  assert.equal(validateLabel('', 'fallback'), 'fallback');
  assert.equal(validateLabel('   ', 'fallback'), 'fallback');
  assert.equal(validateLabel('a'.repeat(81), 'fallback'), 'fallback');
  assert.equal(validateLabel(99, 'fallback'), 'fallback');
});

test('validateEnumNumber accepts a whitelisted value', () => {
  assert.equal(validateEnumNumber(0.041, ALLOWED_MODE_FACTORS, 'modeFactor'), 0.041);
  assert.equal(validateEnumNumber('0.08', ALLOWED_FOOD_FACTORS, 'foodFactor'), 0.08);
});

test('validateEnumNumber rejects a value outside the whitelist', () => {
  assert.throws(() => validateEnumNumber(999, ALLOWED_MODE_FACTORS, 'modeFactor'), AppError);
  assert.throws(() => validateEnumNumber('not-a-number', ALLOWED_MODE_FACTORS, 'modeFactor'), AppError);
});

test('validateDistance accepts values within range', () => {
  assert.equal(validateDistance(0), 0);
  assert.equal(validateDistance('14.5'), 14.5);
  assert.equal(validateDistance(500), 500);
});

test('validateDistance rejects out-of-range or non-numeric values', () => {
  assert.throws(() => validateDistance(-1), AppError);
  assert.throws(() => validateDistance(501), AppError);
  assert.throws(() => validateDistance('abc'), AppError);
  assert.throws(() => validateDistance(Infinity), AppError);
});
