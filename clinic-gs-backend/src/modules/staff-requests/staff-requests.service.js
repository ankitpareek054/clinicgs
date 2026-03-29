
const crypto = require('crypto');



const { withTransaction } = require('../../db/transaction');

const ApiError = require('../../utils/api-error');

const env = require('../../config/env');

const { ROLES } = require('../../config/constants');

const { generateInviteToken, hashInviteToken } = require('../../utils/invite-token');

const { sendInviteEmail } = require('../../services/providers/email.provider');

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

    createdAt: row.created_at,

  };

}



function mapInvite(row, rawInviteToken = null) {

  if (!row) return null;



  return {

    id: row.id,

    email: row.email,

    role: row.role,

    status: row.invite_status,

    expiresAt: row.expires_at,

    sentAt: row.sent_at,

    rawTokenPreview: env.NODE_ENV === 'development' ? rawInviteToken : undefined,

  };

}



function assertInvitableRole(role) {

  if (role !== ROLES.OWNER && role !== ROLES.RECEPTIONIST) {

    throw new ApiError(400, 'Invite role must be owner or receptionist.', {

      code: 'INVALID_INVITE_ROLE',

    });

  }



  return role;

}



async function resolveClinicContext(input, currentUser) {

  if (currentUser.role === ROLES.RECEPTIONIST) {

    throw new ApiError(403, 'Receptionists cannot manage staff invites.', {

      code: 'FORBIDDEN',

    });

  }



  if (currentUser.role === ROLES.SUPER_ADMIN) {

    if (!input.clinicId) {

      throw new ApiError(400, 'clinicId is required for super admin invite actions.', {

        code: 'CLINIC_ID_REQUIRED',

      });

    }



    const clinic = await staffRequestsRepository.findClinicById(input.clinicId);



    if (!clinic) {

      throw new ApiError(404, 'Clinic not found.', {

        code: 'CLINIC_NOT_FOUND',

      });

    }



    return {

      clinicId: clinic.id,

      clinicName: clinic.name,

    };

  }



  return {

    clinicId: currentUser.clinicId,

    clinicName: currentUser.clinicName || 'ClinicGS',

  };

}



async function deliverInviteAndTrack({

  inviteId,

  to,

  clinicName,

  role,

  rawInviteToken,

  invitedByName,

}) {

  const inviteDelivery = await sendInviteEmail({

    to,

    clinicName,

    role,

    inviteToken: rawInviteToken,

    invitedByName,

  });



  let trackedInvite = null;



  if (inviteDelivery?.status === 'sent') {

    try {

      trackedInvite = await staffRequestsRepository.markInviteSent(inviteId);

    } catch (error) {

      inviteDelivery.trackingWarning = 'Email was sent, but sent_at could not be updated.';

      inviteDelivery.trackingError = error.message || 'INVITE_SENT_TRACKING_FAILED';

    }

  }



  return {

    inviteDelivery,

    trackedInvite,

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



  const result = await withTransaction(async (client) => {

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

          createdUser: mapUser(createdUser),

          invite: mapInvite(createdInvite, rawInviteToken),

          rawInviteToken,

          inviteTargetRole: targetRole,

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

          rawInviteToken: null,

          inviteTargetRole: null,

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

      rawInviteToken: null,

      inviteTargetRole: null,

    };

  });



  let inviteDelivery = null;

  let invite = result.invite;



  if (

    input.status === 'approved' &&

    result.invite &&

    result.rawInviteToken &&

    result.createdUser?.email

  ) {

    const delivery = await deliverInviteAndTrack({

      inviteId: result.invite.id,

      to: result.createdUser.email,

      clinicName: request.clinic_name || 'ClinicGS',

      role: result.inviteTargetRole || result.createdUser.role,

      rawInviteToken: result.rawInviteToken,

      invitedByName: currentUser.fullName || currentUser.email || 'ClinicGS',

    });



    inviteDelivery = delivery.inviteDelivery;



    if (delivery.trackedInvite) {

      invite = mapInvite(delivery.trackedInvite, result.rawInviteToken);

    }

  }



  return {

    request: result.request,

    createdUser: result.createdUser,

    invite,

    inviteDelivery,

  };

}



async function resendInvite(input, currentUser) {

  const { clinicId, clinicName } = await resolveClinicContext(input, currentUser);

  const role = assertInvitableRole(input.role);

  const email = String(input.email || '').trim().toLowerCase();



  if (!email) {

    throw new ApiError(400, 'Email is required.', {

      code: 'EMAIL_REQUIRED',

    });

  }



  const pendingUser = await staffRequestsRepository.findPendingInvitableUserByClinicEmailRole(

    clinicId,

    email,

    role

  );



  if (!pendingUser) {

    throw new ApiError(404, 'Pending invited user not found for this clinic and role.', {

      code: 'PENDING_INVITE_USER_NOT_FOUND',

    });

  }



  const rawInviteToken = generateInviteToken();

  const tokenHash = hashInviteToken(rawInviteToken);

  const expiresAt = new Date(

    Date.now() + env.INVITE_TOKEN_EXPIRES_HOURS * 60 * 60 * 1000

  );



  const inviteRow = await withTransaction(async (client) => {

    await staffRequestsRepository.revokePendingInvitesForUser(pendingUser.id, client);



    const invite = await staffRequestsRepository.createInvite(

      {

        clinicId,

        userId: pendingUser.id,

        email: pendingUser.email,

        role,

        tokenHash,

        expiresAt,

        createdByUserId: currentUser.id,

      },

      client

    );



    return invite;

  });



  const delivery = await deliverInviteAndTrack({

    inviteId: inviteRow.id,

    to: pendingUser.email,

    clinicName,

    role,

    rawInviteToken,

    invitedByName: currentUser.fullName || currentUser.email || 'ClinicGS',

  });



  return {

    user: mapUser(pendingUser),

    invite: mapInvite(delivery.trackedInvite || inviteRow, rawInviteToken),

    inviteDelivery: delivery.inviteDelivery,

  };

}



module.exports = {

  listRequests,

  createRequest,

  decideRequest,

  resendInvite,

};