const crypto = require('crypto');

const { withTransaction } = require('../../db/transaction');
const ApiError = require('../../utils/api-error');
const env = require('../../config/env');
const { ROLES } = require('../../config/constants');
const { generateInviteToken, hashInviteToken } = require('../../utils/invite-token');
const staffRequestsRepository = require('./staff-requests.repository');

function mapRequest(row) {
  if (!row) return null;

  return {
    id: row.id,
    clinicId: row.clinic_id,
    requestedByUserId: row.requested_by_user_id,
    requestType: row.request_type,
    targetUserId: row.target_user_id,
    targetName: row.target_name,
    targetEmail: row.target_email,
    targetPhone: row.target_phone,
    targetRole: row.target_role,
    requestNote: row.request_note,
    status: row.status,
    adminNote: row.admin_note,
    approvedByUserId: row.approved_by_user_id,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
  };
}

async function listRequests(filters, currentUser) {
  if (currentUser.role === ROLES.RECEPTIONIST) {
    throw new ApiError(403, 'Receptionists cannot view staff requests.', {
      code: 'FORBIDDEN',
    });
  }

  const finalFilters = { ...filters };

  if (currentUser.role !== ROLES.SUPER_ADMIN) {
    finalFilters.clinicId = currentUser.clinicId;
  }

  const rows = await staffRequestsRepository.listRequests(finalFilters);
  return rows.map(mapRequest);
}

async function validateRemovalTarget(input, currentUser, expectedRole) {
  const targetUser = await staffRequestsRepository.findUserById(input.targetUserId);

  if (!targetUser) {
    throw new ApiError(404, 'Target user not found.', { code: 'USER_NOT_FOUND' });
  }

  if (Number(targetUser.clinic_id) !== Number(currentUser.clinicId)) {
    throw new ApiError(403, 'Forbidden.', { code: 'FORBIDDEN' });
  }

  if (targetUser.role !== expectedRole) {
    throw new ApiError(400, `Target user must be a ${expectedRole}.`, {
      code: 'INVALID_TARGET_ROLE',
    });
  }

  if (targetUser.status !== 'active') {
    throw new ApiError(400, 'Only active users can be removed through this request flow.', {
      code: 'INVALID_TARGET_STATUS',
    });
  }

  if (expectedRole === ROLES.OWNER && Number(targetUser.id) === Number(currentUser.id)) {
    throw new ApiError(400, 'Owner cannot create a remove_owner request for themselves.', {
      code: 'SELF_REMOVAL_NOT_ALLOWED',
    });
  }

  return targetUser;
}

async function createRequest(input, currentUser) {
  if (currentUser.role !== ROLES.OWNER) {
    throw new ApiError(403, 'Only owners can create staff requests.', {
      code: 'FORBIDDEN',
    });
  }

  let targetUser = null;

  if (input.requestType === 'remove_owner') {
    targetUser = await validateRemovalTarget(input, currentUser, ROLES.OWNER);
  }

  if (input.requestType === 'remove_receptionist') {
    targetUser = await validateRemovalTarget(input, currentUser, ROLES.RECEPTIONIST);
  }

  const created = await staffRequestsRepository.createRequest({
    clinicId: currentUser.clinicId,
    requestedByUserId: currentUser.id,
    requestType: input.requestType,
    targetUserId: input.targetUserId || null,
    targetName: targetUser?.full_name || input.targetName,
    targetEmail: targetUser?.email || input.targetEmail || null,
    targetPhone: targetUser?.phone || input.targetPhone || null,
    targetRole:
      input.targetRole ||
      (
        input.requestType === 'add_receptionist' ||
        input.requestType === 'remove_receptionist'
          ? 'receptionist'
          : 'owner'
      ),
    requestNote: input.requestNote || null,
  });

  return mapRequest(created);
}

async function decideRequest(requestId, input, currentUser) {
  if (currentUser.role !== ROLES.SUPER_ADMIN) {
    throw new ApiError(403, 'Only super admin can decide staff requests.', {
      code: 'FORBIDDEN',
    });
  }

  const request = await staffRequestsRepository.findRequestById(requestId);

  if (!request) {
    throw new ApiError(404, 'Staff request not found.', {
      code: 'STAFF_REQUEST_NOT_FOUND',
    });
  }

  if (request.status !== 'pending') {
    throw new ApiError(400, 'Only pending requests can be decided.', {
      code: 'INVALID_REQUEST_STATUS',
    });
  }

  return withTransaction(async (client) => {
    let createdUser = null;
    let createdInvite = null;
    let rawInviteToken = null;

    if (input.status === 'approved') {
      if (request.request_type === 'add_receptionist' || request.request_type === 'add_owner') {
        const targetRole = request.request_type === 'add_receptionist' ? 'receptionist' : 'owner';
        let targetUserId = request.target_user_id || null;

        if (!targetUserId) {
          rawInviteToken = generateInviteToken();
          const tokenHash = hashInviteToken(rawInviteToken);
          const temporaryPassword = crypto.randomBytes(12).toString('hex');
          const expiresAt = new Date(
            Date.now() + env.INVITE_TOKEN_EXPIRES_HOURS * 60 * 60 * 1000
          );

          createdUser = await staffRequestsRepository.createPendingUser(
            {
              clinicId: request.clinic_id,
              fullName: request.target_name,
              email: request.target_email,
              phone: request.target_phone,
              role: targetRole,
              temporaryPassword,
            },
            client
          );

          targetUserId = createdUser.id;

          createdInvite = await staffRequestsRepository.createInvite(
            {
              clinicId: request.clinic_id,
              userId: createdUser.id,
              email: request.target_email,
              role: targetRole,
              tokenHash,
              expiresAt,
              createdByUserId: currentUser.id,
            },
            client
          );
        }

        const decided = await staffRequestsRepository.updateDecision(
          requestId,
          {
            status: 'approved',
            adminNote: input.adminNote || null,
            approvedByUserId: currentUser.id,
            targetUserId,
          },
          client
        );

        return {
          request: mapRequest(decided),
          createdUser: createdUser
            ? {
                id: createdUser.id,
                clinicId: createdUser.clinic_id,
                fullName: createdUser.full_name,
                email: createdUser.email,
                phone: createdUser.phone,
                role: createdUser.role,
                status: createdUser.status,
                mustResetPassword: createdUser.must_reset_password,
                createdAt: createdUser.created_at,
              }
            : null,
          invite: createdInvite
            ? {
                id: createdInvite.id,
                email: createdInvite.email,
                role: createdInvite.role,
                status: createdInvite.invite_status,
                expiresAt: createdInvite.expires_at,
                sentAt: createdInvite.sent_at,
                rawTokenPreview: env.NODE_ENV === 'development' ? rawInviteToken : undefined,
              }
            : null,
        };
      }

      if (
        request.request_type === 'remove_owner' ||
        request.request_type === 'remove_receptionist'
      ) {
        if (!request.target_user_id) {
          throw new ApiError(400, 'Target user is required for removal request.', {
            code: 'MISSING_TARGET_USER',
          });
        }

        const targetUser = await staffRequestsRepository.findUserById(
          request.target_user_id,
          client
        );

        if (!targetUser) {
          throw new ApiError(404, 'Target user not found.', {
            code: 'USER_NOT_FOUND',
          });
        }

        const expectedRole =
          request.request_type === 'remove_owner' ? ROLES.OWNER : ROLES.RECEPTIONIST;

        if (targetUser.role !== expectedRole) {
          throw new ApiError(400, 'Target user role does not match the request type.', {
            code: 'INVALID_TARGET_ROLE',
          });
        }

        await staffRequestsRepository.deactivateUserAsRemoved(
          {
            userId: targetUser.id,
            removedByUserId: currentUser.id,
            removalReason:
              input.adminNote ||
              (expectedRole === ROLES.OWNER
                ? 'Owner removal approved by super admin'
                : 'Receptionist removal approved by super admin'),
          },
          client
        );

        const decided = await staffRequestsRepository.updateDecision(
          requestId,
          {
            status: 'approved',
            adminNote: input.adminNote || null,
            approvedByUserId: currentUser.id,
            targetUserId: targetUser.id,
          },
          client
        );

        return {
          request: mapRequest(decided),
          createdUser: null,
          invite: null,
        };
      }
    }

    const decided = await staffRequestsRepository.updateDecision(
      requestId,
      {
        status: input.status,
        adminNote: input.adminNote || null,
        approvedByUserId: currentUser.id,
        targetUserId: null,
      },
      client
    );

    return {
      request: mapRequest(decided),
      createdUser: null,
      invite: null,
    };
  });
}

module.exports = {
  listRequests,
  createRequest,
  decideRequest,
};