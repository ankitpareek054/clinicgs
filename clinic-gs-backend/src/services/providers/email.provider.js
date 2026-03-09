const env = require('../../config/env');

async function sendEmail({ to, subject, text, html }) {
  if (!env.MAIL_ENABLED) {
    return {
      provider: 'email',
      enabled: false,
      status: 'skipped',
      message: 'Email provider is disabled in environment.',
      payload: {
        to,
        subject,
        text,
        html,
      },
    };
  }

  return {
    provider: 'email',
    enabled: true,
    status: 'queued',
    message: 'Email provider is enabled. Replace this stub with real provider logic.',
    payload: {
      from: env.MAIL_FROM,
      to,
      subject,
      text,
      html,
    },
  };
}

module.exports = {
  sendEmail,
};