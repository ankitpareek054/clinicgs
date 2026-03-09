const { ZodError } = require('zod');
const ApiError = require('../utils/api-error');

function validate(schemas = {}) {
  return (req, res, next) => {
    try {
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }

      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }

      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return next(
          new ApiError(400, 'Validation failed.', {
            code: 'VALIDATION_ERROR',
            details: error.flatten(),
          })
        );
      }

      return next(error);
    }
  };
}

module.exports = validate;