const env = require('../../config/env');

async function invokeMakeWebhook({ url, payload }) {
  if (!env.MAKE_ENABLED) {
    return {
      provider: 'make',
      enabled: false,
      status: 'skipped',
      message: 'Make provider is disabled in environment.',
      payload,
    };
  }

  if (!url) {
    return {
      provider: 'make',
      enabled: true,
      status: 'failed',
      message: 'Missing Make webhook URL.',
      payload,
    };
  }

  if (typeof fetch !== 'function') {
    return {
      provider: 'make',
      enabled: true,
      status: 'failed',
      message: 'Global fetch is not available in this Node runtime.',
      payload,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.MAKE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload || {}),
      signal: controller.signal,
    });

    const text = await response.text();

    return {
      provider: 'make',
      enabled: true,
      status: response.ok ? 'sent' : 'failed',
      httpStatus: response.status,
      responseText: text,
    };
  } catch (error) {
    return {
      provider: 'make',
      enabled: true,
      status: 'failed',
      message: error.message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  invokeMakeWebhook,
};