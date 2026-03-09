const env = require('./env');

function getAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    maxAge: env.COOKIE_MAX_AGE_MS,
    path: '/',
  };
}

function getClearCookieOptions() {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    expires: new Date(0),
    path: '/',
  };
}

module.exports = {
  getAuthCookieOptions,
  getClearCookieOptions,
};