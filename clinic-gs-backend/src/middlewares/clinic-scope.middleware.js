const ApiError = require('../utils/api-error');
const { ROLES } = require('../config/constants');

function requireClinicAccess(paramKey = 'clinicId') {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Unauthorized.', { code: 'UNAUTHORIZED' }));
    }

    if (req.user.role === ROLES.SUPER_ADMIN) {
      return next();
    }

    const rawClinicId =
      req.params?.[paramKey] ??
      req.body?.[paramKey] ??
      req.query?.[paramKey];

    const clinicId = Number(rawClinicId);

    if (!clinicId) {
      return next(
        new ApiError(400, `Clinic id is required in ${paramKey}.`, {
          code: 'CLINIC_ID_REQUIRED',
        })
      );
    }

    if (Number(req.user.clinicId) !== clinicId) {
      return next(new ApiError(403, 'Forbidden clinic access.', { code: 'FORBIDDEN' }));
    }

    return next();
  };
}

function attachClinicScope(req, res, next) {
  if (!req.user) {
    return next(new ApiError(401, 'Unauthorized.', { code: 'UNAUTHORIZED' }));
  }

  if (req.user.role === ROLES.SUPER_ADMIN) {
    req.clinicScopeId = req.query.clinicId ? Number(req.query.clinicId) : null;
    return next();
  }

  req.clinicScopeId = Number(req.user.clinicId);
  return next();
}

module.exports = {
  requireClinicAccess,
  attachClinicScope,
};