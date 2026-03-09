const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
  path: path.resolve(process.cwd(), '.env'),
});

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const env = {
  PORT: parseNumber(process.env.PORT, 4000),
  NODE_ENV: process.env.NODE_ENV || 'development',

  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseNumber(process.env.DB_PORT, 5432),
  DB_NAME: process.env.DB_NAME || 'clinicgs',
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_SSL: parseBoolean(process.env.DB_SSL, false),

  JWT_SECRET: process.env.JWT_SECRET || 'change_this_secret',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  COOKIE_NAME: process.env.COOKIE_NAME || 'clinicgs_token',
  COOKIE_MAX_AGE_MS: parseNumber(process.env.COOKIE_MAX_AGE_MS, 7 * 24 * 60 * 60 * 1000),
  COOKIE_SECURE: parseBoolean(process.env.COOKIE_SECURE, false),

  CLIENT_ORIGIN: (process.env.CLIENT_ORIGIN || 'http://localhost:3000,http://localhost:5173')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),

  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:4000',

  BCRYPT_SALT_ROUNDS: parseNumber(process.env.BCRYPT_SALT_ROUNDS, 10),
  INVITE_TOKEN_EXPIRES_HOURS: parseNumber(process.env.INVITE_TOKEN_EXPIRES_HOURS, 168),

  MAIL_ENABLED: parseBoolean(process.env.MAIL_ENABLED, false),
  MAIL_FROM: process.env.MAIL_FROM || 'no-reply@clinicgs.local',

  MAKE_ENABLED: parseBoolean(process.env.MAKE_ENABLED, false),
  MAKE_TIMEOUT_MS: parseNumber(process.env.MAKE_TIMEOUT_MS, 10000),

  GOOGLE_CALENDAR_ENABLED: parseBoolean(process.env.GOOGLE_CALENDAR_ENABLED, false),
  GOOGLE_CALENDAR_TIMEOUT_MS: parseNumber(process.env.GOOGLE_CALENDAR_TIMEOUT_MS, 10000),
};

module.exports = env;