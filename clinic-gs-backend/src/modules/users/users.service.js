const { withTransaction } = require('../../db/transaction');
const ApiError = require('../../utils/api-error');
const { ROLES } = require('../../config/constants');
const usersRepository = require('./users.repository');

function mapUser(row) {
  if (!row) return null;

  return {
    id: row.id,
    clinicId: row.clinic_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    status: row.status,
    mustResetPassword: row.must_reset_password,
    lastLoginAt: row.last_login_at,
    deactivatedAt: row.deactivated_at,
    removedAt: row.removed_at,
    removedByUserId: row.removed_by_user_id,
    removalReason: row.removal_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function canAccessUser(currentUser, targetUser) {
  if (currentUser.role === ROLES.SUPER_ADMIN) return true;
  return Number(currentUser.clinicId) === Number(targetUser.clinic_id);
}

async function listUsers(filters, currentUser) {
  const finalFilters = { ...filters };

  if (currentUser.role !== ROLES.SUPER_ADMIN) {
    finalFilters.clinicId = currentUser.clinicId;
  }

  const rows = await usersRepository.listUsers(finalFilters);
  return rows.map(mapUser);
}

async function getUserById(userId, currentUser) {
  const row = await usersRepository.findUserById(userId);

  if (!row) {
    throw new ApiError(404, 'User not found.', { code: 'USER_NOT_FOUND' });
  }

  if (!canAccessUser(currentUser, row)) {
    throw new ApiError(403, 'Forbidden.', { code: 'FORBIDDEN' });
  }

  return mapUser(row);
}

async function updateUserStatus(userId, input, currentUser) {
  const existing = await usersRepository.findUserById(userId);

  if (!existing) {
    throw new ApiError(404, 'User not found.', { code: 'USER_NOT_FOUND' });
  }

  if (existing.role === ROLES.SUPER_ADMIN) {
    throw new ApiError(403, 'Super admin user status cannot be changed here.', {
      code: 'FORBIDDEN',
    });
  }

  if (currentUser.role === ROLES.OWNER) {
    if (Number(currentUser.clinicId) !== Number(existing.clinic_id)) {
      throw new ApiError(403, 'Forbidden.', { code: 'FORBIDDEN' });
    }

    if (existing.role !== ROLES.RECEPTIONIST) {
      throw new ApiError(403, 'Owner can only activate or deactivate receptionists.', {
        code: 'FORBIDDEN',
      });
    }
  } else if (currentUser.role !== ROLES.SUPER_ADMIN) {
    throw new ApiError(403, 'Forbidden.', { code: 'FORBIDDEN' });
  }

  return withTransaction(async (client) => {
    let unassignedLeadCount = 0;

    if (input.status === 'inactive' && existing.role === ROLES.RECEPTIONIST) {
      unassignedLeadCount = await usersRepository.unassignActiveLeadsFromUser(
        existing.id,
        existing.clinic_id,
        client
      );
    }

    const updated = await usersRepository.updateUserStatus(
      userId,
      {
        status: input.status,
        reason: input.reason || null,
      },
      client
    );

    return {
      user: mapUser(updated),
      unassignedLeadCount,
    };
  });
}

module.exports = {
  listUsers,
  getUserById,
  updateUserStatus,
};