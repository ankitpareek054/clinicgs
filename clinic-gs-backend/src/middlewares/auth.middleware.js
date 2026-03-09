const env = require('../config/env');
const ApiError = require('../utils/api-error');
const { verifyAuthToken } = require('../utils/jwt');
const authRepository = require('../modules/auth/auth.repository');

async function authMiddleware(req, res, next) {
  try {
    const cookieToken = req.cookies?.[env.COOKIE_NAME];
    const authHeader = req.headers.authorization;

    let token = cookieToken || null;

    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }

    if (!token) {
      return next(new ApiError(401, 'Unauthorized.', { code: 'UNAUTHORIZED' }));
    }

    const decoded = verifyAuthToken(token);

    const user = await authRepository.findUserSessionById(decoded.userId);

    if (!user) {
      return next(new ApiError(401, 'Unauthorized.', { code: 'UNAUTHORIZED' }));
    }

    if (user.status !== 'active') {
      return next(new ApiError(401, 'Account is not active.', { code: 'ACCOUNT_NOT_ACTIVE' }));
    }

    req.user = {
      id: user.id,
      clinicId: user.clinic_id,
      fullName: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      mustResetPassword: user.must_reset_password,
      lastLoginAt: user.last_login_at,
    };

    return next();
  } catch (error) {
    return next(new ApiError(401, 'Unauthorized.', { code: 'UNAUTHORIZED' }));
  }
}

module.exports = authMiddleware;