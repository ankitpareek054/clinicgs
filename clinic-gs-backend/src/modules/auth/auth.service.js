const { withTransaction } = require('../../db/transaction');
const ApiError = require('../../utils/api-error');
const { signAuthToken } = require('../../utils/jwt');
const { generateInviteToken, hashInviteToken } = require('../../utils/invite-token');
const { assertPasswordStrength } = require('../../utils/password');
const authRepository = require('./auth.repository');
const { sendPasswordResetEmail } = require('../../services/providers/email.provider');
const { AUTH_MESSAGES, USER_STATUSES, INVITE_STATUSES } = require('../../config/constants');

function buildAuthPayload(user) {
  return {
    userId: user.id,
    role: user.role,
    clinicId: user.clinic_id,
  };
}

function buildSafeUser(user) {
  return {
    id: user.id,
    clinicId: user.clinic_id,
    clinicName: user.clinic_name || '',
    fullName: user.full_name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    mustResetPassword: user.must_reset_password,
    lastLoginAt: user.last_login_at,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

function getPasswordResetExpiryHours() {
  const parsed = Number(process.env.PASSWORD_RESET_TOKEN_EXPIRES_HOURS || 2);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2;
}

async function login(input) {
  const user = await authRepository.verifyUserCredentials(input.email, input.password);

  if (!user) {
    throw new ApiError(401, AUTH_MESSAGES.INVALID_CREDENTIALS, {
      code: 'INVALID_CREDENTIALS',
    });
  }

  if (user.status === USER_STATUSES.PENDING_INVITE) {
    throw new ApiError(403, AUTH_MESSAGES.ACCOUNT_PENDING_INVITE, {
      code: 'PENDING_INVITE',
    });
  }

  if (user.status !== USER_STATUSES.ACTIVE) {
    throw new ApiError(403, AUTH_MESSAGES.ACCOUNT_INACTIVE, {
      code: 'ACCOUNT_INACTIVE',
    });
  }

  await authRepository.touchLastLogin(user.id);
  const refreshedUser = await authRepository.findUserSessionById(user.id);
  const token = signAuthToken(buildAuthPayload(refreshedUser));

  return {
    token,
    user: buildSafeUser(refreshedUser),
  };
}

async function getMe(userId) {
  const user = await authRepository.findUserSessionById(userId);

  if (!user) {
    throw new ApiError(404, 'User not found.', {
      code: 'USER_NOT_FOUND',
    });
  }

  return buildSafeUser(user);
}

async function getInviteByToken(rawToken) {
  const invite = await authRepository.findInviteByTokenHash(hashInviteToken(rawToken));

  if (!invite) {
    throw new ApiError(404, AUTH_MESSAGES.INVALID_OR_EXPIRED_INVITE, {
      code: 'INVITE_NOT_FOUND',
    });
  }

  if (invite.invite_status !== INVITE_STATUSES.PENDING) {
    throw new ApiError(400, 'Invite is no longer pending.', {
      code: 'INVITE_NOT_PENDING',
    });
  }

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    throw new ApiError(400, AUTH_MESSAGES.INVALID_OR_EXPIRED_INVITE, {
      code: 'INVITE_EXPIRED',
    });
  }

  return {
    id: invite.id,
    clinicId: invite.clinic_id,
    userId: invite.user_id,
    email: invite.email,
    role: invite.role,
    clinicName: invite.clinic_name,
    clinicSlug: invite.clinic_slug,
    fullName: invite.full_name,
    expiresAt: invite.expires_at,
    inviteStatus: invite.invite_status,
  };
}

async function acceptInvite(input) {
  assertPasswordStrength(input.password);

  return withTransaction(async (client) => {
    const invite = await authRepository.findInviteByTokenHash(
      hashInviteToken(input.token),
      client
    );

    if (!invite) {
      throw new ApiError(404, AUTH_MESSAGES.INVALID_OR_EXPIRED_INVITE, {
        code: 'INVITE_NOT_FOUND',
      });
    }

    if (invite.invite_status !== INVITE_STATUSES.PENDING) {
      throw new ApiError(400, 'Invite is no longer pending.', {
        code: 'INVITE_NOT_PENDING',
      });
    }

    if (new Date(invite.expires_at).getTime() < Date.now()) {
      throw new ApiError(400, AUTH_MESSAGES.INVALID_OR_EXPIRED_INVITE, {
        code: 'INVITE_EXPIRED',
      });
    }

    const user = await authRepository.activateInvitedUser(
      invite.user_id,
      input.password,
      client
    );

    await authRepository.markInviteAccepted(invite.id, client);
    await authRepository.touchLastLogin(user.id, client);

    const finalUser = await authRepository.findUserSessionById(user.id, client);
    const token = signAuthToken(buildAuthPayload(finalUser));

    return {
      token,
      user: buildSafeUser(finalUser),
    };
  });
}

async function requestPasswordReset(input) {
  const email = String(input.email || '').trim().toLowerCase();

  if (!email) {
    throw new ApiError(400, 'Email is required.', {
      code: 'EMAIL_REQUIRED',
    });
  }

  const user = await authRepository.findUserByEmail(email);

  // Prevent account enumeration.
  if (!user) {
    return { success: true };
  }

  // Pending invites should use invite acceptance, not forgot password.
  if (user.status === USER_STATUSES.PENDING_INVITE) {
    return { success: true };
  }

  // Inactive users should not receive reset links.
  if (user.status !== USER_STATUSES.ACTIVE) {
    return { success: true };
  }

  const rawResetToken = generateInviteToken();
  const tokenHash = hashInviteToken(rawResetToken);
  const expiresAt = new Date(
    Date.now() + getPasswordResetExpiryHours() * 60 * 60 * 1000
  );

  await withTransaction(async (client) => {
    await authRepository.revokeActivePasswordResetTokensForUser(user.id, client);

    await authRepository.createPasswordResetToken(
      {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
      client
    );
  });

  await sendPasswordResetEmail({
    to: user.email,
    fullName: user.full_name,
    resetToken: rawResetToken,
  });

  return { success: true };
}

async function resetPassword(input) {
  assertPasswordStrength(input.password);

  return withTransaction(async (client) => {
    const resetRecord = await authRepository.findPasswordResetTokenByHash(
      hashInviteToken(input.token),
      client
    );

    if (!resetRecord) {
      throw new ApiError(400, 'Invalid or expired password reset token.', {
        code: 'PASSWORD_RESET_INVALID',
      });
    }

    if (resetRecord.reset_status !== 'pending') {
      throw new ApiError(400, 'Password reset token is no longer valid.', {
        code: 'PASSWORD_RESET_NOT_PENDING',
      });
    }

    if (new Date(resetRecord.expires_at).getTime() < Date.now()) {
      await authRepository.markPasswordResetTokenExpired(resetRecord.id, client);

      throw new ApiError(400, 'Invalid or expired password reset token.', {
        code: 'PASSWORD_RESET_EXPIRED',
      });
    }

    if (resetRecord.user_status !== USER_STATUSES.ACTIVE) {
      throw new ApiError(400, 'Password reset is not allowed for this account.', {
        code: 'PASSWORD_RESET_ACCOUNT_INVALID',
      });
    }

    await authRepository.updateUserPassword(
      resetRecord.user_id,
      input.password,
      client
    );

    await authRepository.markPasswordResetTokenUsed(resetRecord.id, client);
    await authRepository.revokeOtherActivePasswordResetTokensForUser(
      resetRecord.user_id,
      resetRecord.id,
      client
    );

    return { success: true };
  });
}

module.exports = {
  login,
  getMe,
  getInviteByToken,
  acceptInvite,
  requestPasswordReset,
  resetPassword,
};