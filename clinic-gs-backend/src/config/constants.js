const ROLES = {
  SUPER_ADMIN: 'super_admin',
  OWNER: 'owner',
  RECEPTIONIST: 'receptionist',
};

const USER_STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PENDING_INVITE: 'pending_invite',
};

const CLINIC_STATUSES = {
  ONBOARDING: 'onboarding',
  TRIAL: 'trial',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
};

const INVITE_STATUSES = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
};

const DEFAULT_PAGINATION = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
};

const AUTH_MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid email or password.',
  ACCOUNT_INACTIVE: 'Your account is inactive. Please contact support.',
  ACCOUNT_PENDING_INVITE: 'Your invite has not been accepted yet.',
  UNAUTHORIZED: 'Unauthorized.',
  FORBIDDEN: 'Forbidden.',
  INVALID_OR_EXPIRED_INVITE: 'Invalid or expired invite token.',
};

module.exports = {
  ROLES,
  USER_STATUSES,
  CLINIC_STATUSES,
  INVITE_STATUSES,
  DEFAULT_PAGINATION,
  AUTH_MESSAGES,
};