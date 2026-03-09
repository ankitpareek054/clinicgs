const ApiError = require('../utils/api-error');

function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Unauthorized.', { code: 'UNAUTHORIZED' }));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ApiError(403, 'Forbidden.', { code: 'FORBIDDEN' }));
    }

    return next();
  };
}

module.exports = requireRole;