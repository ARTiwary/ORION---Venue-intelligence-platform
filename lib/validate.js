// Centralized input validation. Every value that reaches an AI provider or a
// cost calculation is validated here first — nothing from req.body is trusted
// or forwarded raw.

class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const MAX_MESSAGE_LEN = 2000;

const ALLOWED_LANGUAGES = [
  'English', 'Portuguese', 'Spanish', 'Korean', 'Japanese',
  'Arabic', 'French', 'Hindi', 'Mandarin Chinese', 'German'
];

// Travel-mode and food emission factors are a closed set, not free numbers —
// this stops a client from sending an arbitrary/huge factor to skew output
// or from probing the endpoint with non-numeric junk.
const ALLOWED_MODE_FACTORS = [0, 0.041, 0.096, 0.105, 0.192];
const ALLOWED_FOOD_FACTORS = [0.03, 0.08, 0.2];
const MAX_DISTANCE_KM = 500;

function validateMessage(value, fieldName = 'message') {
  if (typeof value !== 'string') {
    throw new AppError(`${fieldName} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new AppError(`${fieldName} is required`);
  }
  if (trimmed.length > MAX_MESSAGE_LEN) {
    throw new AppError(`${fieldName} must be ${MAX_MESSAGE_LEN} characters or fewer`);
  }
  return trimmed;
}

function validateLanguage(value) {
  if (typeof value !== 'string' || !ALLOWED_LANGUAGES.includes(value)) {
    return 'English'; // safe default rather than rejecting the whole request
  }
  return value;
}

function validateLabel(value, fallback) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 80) {
    return fallback;
  }
  return value.trim();
}

function validateEnumNumber(value, allowed, fieldName) {
  const num = Number(value);
  if (!allowed.includes(num)) {
    throw new AppError(`${fieldName} is not a recognized option`);
  }
  return num;
}

function validateDistance(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num > MAX_DISTANCE_KM) {
    throw new AppError(`distanceKm must be a number between 0 and ${MAX_DISTANCE_KM}`);
  }
  return num;
}

module.exports = {
  AppError,
  ALLOWED_LANGUAGES,
  ALLOWED_MODE_FACTORS,
  ALLOWED_FOOD_FACTORS,
  MAX_DISTANCE_KM,
  validateMessage,
  validateLanguage,
  validateLabel,
  validateEnumNumber,
  validateDistance
};
