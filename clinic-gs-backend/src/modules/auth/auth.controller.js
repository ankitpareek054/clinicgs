const { sendSuccess } = require('../../utils/api-response');
const authService = require('./auth.service');
const { getAuthCookieOptions, getClearCookieOptions } = require('../../config/cookie');
const env = require('../../config/env');

async function login(req, res) {
  const result = await authService.login(req.body);

  res.cookie(env.COOKIE_NAME, result.token, getAuthCookieOptions());

  return sendSuccess(res, {
    message: 'Login successful.',
    data: result.user,
  });
}

async function logout(req, res) {
  res.clearCookie(env.COOKIE_NAME, getClearCookieOptions());

  return sendSuccess(res, {
    message: 'Logout successful.',
    data: null,
  });
}

async function me(req, res) {
  const user = await authService.getMe(req.user.id);

  return sendSuccess(res, {
    message: 'Current user fetched successfully.',
    data: user,
  });
}

async function getInviteByToken(req, res) {
  const invite = await authService.getInviteByToken(req.params.token);

  return sendSuccess(res, {
    message: 'Invite is valid.',
    data: invite,
  });
}

async function acceptInvite(req, res) {
  const result = await authService.acceptInvite(req.body);

  res.cookie(env.COOKIE_NAME, result.token, getAuthCookieOptions());

  return sendSuccess(res, {
    message: 'Invite accepted successfully.',
    data: result.user,
  });
}

async function requestPasswordReset(req, res) {
  await authService.requestPasswordReset(req.body);

  return sendSuccess(res, {
    message: 'If the email exists in our system, a password reset link has been sent.',
    data: { success: true },
  });
}

async function resetPassword(req, res) {
  await authService.resetPassword(req.body);

  return sendSuccess(res, {
    message: 'Password reset successful.',
    data: { success: true },
  });
}

module.exports = {
  login,
  logout,
  me,
  getInviteByToken,
  acceptInvite,
  requestPasswordReset,
  resetPassword,
};