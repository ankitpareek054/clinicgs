const ApiError = require('../utils/api-error');

function notFoundMiddleware(req, res, next) {
  next(
    new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`, {
      code: 'ROUTE_NOT_FOUND',
    })
  );
}

module.exports = notFoundMiddleware;