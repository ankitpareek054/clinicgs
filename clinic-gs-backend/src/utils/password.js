const bcrypt = require('bcryptjs');
const env = require('../config/env');
const ApiError = require('./api-error');

function validatePasswordStrength(password) {
  const errors = [];

  if (!password || typeof password !== 'string') {
    errors.push('Password is required.');
    return { valid: false, errors };
  }

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long.');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter.');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter.');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function assertPasswordStrength(password) {
  const result = validatePasswordStrength(password);

  if (!result.valid) {
    throw new ApiError(400, 'Password does not meet requirements.', {
      code: 'WEAK_PASSWORD',
      details: result.errors,
    });
  }
}

async function hashWithBcrypt(password) {
  return bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
}

async function compareWithBcrypt(password, hash) {
  return bcrypt.compare(password, hash);
}

module.exports = {
  validatePasswordStrength,
  assertPasswordStrength,
  hashWithBcrypt,
  compareWithBcrypt,
};