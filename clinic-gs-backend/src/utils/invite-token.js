const crypto = require('crypto');

function generateInviteToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashInviteToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

module.exports = {
  generateInviteToken,
  hashInviteToken,
};