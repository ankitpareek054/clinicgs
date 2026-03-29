const express = require('express');
const asyncHandler = require('../../utils/async-handler');
const validate = require('../../middlewares/validate.middleware');
const authMiddleware = require('../../middlewares/auth.middleware');
const authController = require('./auth.controller');
const {
  loginSchema,
  inviteTokenParamsSchema,
  acceptInviteSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
} = require('./auth.validators');

const router = express.Router();

router.post('/login', validate({ body: loginSchema }), asyncHandler(authController.login));
router.post('/logout', asyncHandler(authController.logout));
router.get('/me', authMiddleware, asyncHandler(authController.me));

router.get(
  '/invites/:token',
  validate({ params: inviteTokenParamsSchema }),
  asyncHandler(authController.getInviteByToken)
);

router.post(
  '/invites/accept',
  validate({ body: acceptInviteSchema }),
  asyncHandler(authController.acceptInvite)
);

router.post(
  '/password/forgot',
  validate({ body: requestPasswordResetSchema }),
  asyncHandler(authController.requestPasswordReset)
);

router.post(
  '/password/reset',
  validate({ body: resetPasswordSchema }),
  asyncHandler(authController.resetPassword)
);

module.exports = router;