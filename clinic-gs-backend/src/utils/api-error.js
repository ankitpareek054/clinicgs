class ApiError extends Error {
  constructor(statusCode, message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode || 500;
    this.code = options.code || 'API_ERROR';
    this.details = options.details || null;
  }
}

module.exports = ApiError;