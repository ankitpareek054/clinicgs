const { sendError } = require('../utils/api-response');

function errorMiddleware(error, req, res, next) {
  const statusCode = error.statusCode || 500;
  const code = error.code || 'INTERNAL_SERVER_ERROR';

  if (statusCode >= 500) {
    console.error(error);
  }

  return sendError(res, {
    statusCode,
    message: error.message || 'Internal server error.',
    code,
    details: error.details || null,
  });
}

module.exports = errorMiddleware;