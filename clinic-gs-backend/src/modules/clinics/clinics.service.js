const crypto = require('crypto');
const { withTransaction } = require('../../db/transaction');
const ApiError = require('../../utils/api-error');
const { slugify } = require('../../utils/slug');
const { generateInviteToken, hashInviteToken } = require('../../utils/invite-token');
const env = require('../../config/env');
const { ROLES } = require('../../config/constants');
const { sendInviteEmail } = require('../../services/providers/email.provider');
const clinicsRepository = require('./clinics.repository');

function buildClinicResponse(row) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    clinicType: row.clinic_type,
    phone: row.phone,
    email: row.email,
    addressLine1: row.address_line_1,
    addressLine2: row.address_line_2,
    city: row.city,
    state: row.state,
    country: row.country,
    timezone: row.timezone,
    status: row.status,
    deactivatedAt: row.deactivated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildOwnerResponse(row) {
  if (!row) return null;

  return {
    id: row.id,
    clinicId: row.clinic_id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    status: row.status,
    mustResetPassword: row.must_reset_password,
    createdAt: row.created_at,
  };
}

function buildInviteResponse(row, rawInviteToken = null) {
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

async function ensureUniqueSlug(name) {
  const baseSlug = slugify(name);
  const firstTry = baseSlug || `clinic-${Date.now()}`;

  const existing = await clinicsRepository.findClinicBySlug(firstTry);
  if (!existing) return firstTry;

  return `${firstTry}-${Date.now()}`;
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
      trackedInvite = await clinicsRepository.markUserInviteSent(inviteId);
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

async function listClinics(filters, currentUser) {
  if (currentUser.role === ROLES.SUPER_ADMIN) {
    const rows = await clinicsRepository.listClinics(filters);
    return rows.map(buildClinicResponse);
  }

  const clinic = await clinicsRepository.findClinicById(currentUser.clinicId);

  return clinic ? [buildClinicResponse(clinic)] : [];
}

async function getClinicById(clinicId, currentUser) {
  const clinic = await clinicsRepository.findClinicById(clinicId);

  if (!clinic) {
    throw new ApiError(404, 'Clinic not found.', { code: 'CLINIC_NOT_FOUND' });
  }

  if (currentUser.role !== ROLES.SUPER_ADMIN && Number(currentUser.clinicId) !== Number(clinicId)) {
    throw new ApiError(403, 'Forbidden clinic access.', { code: 'FORBIDDEN' });
  }

  return buildClinicResponse(clinic);
}

async function createClinic(input, currentUser) {
  if (currentUser.role !== ROLES.SUPER_ADMIN) {
    throw new ApiError(403, 'Only super admin can create clinics.', {
      code: 'FORBIDDEN',
    });
  }

  const clinicSlug = await ensureUniqueSlug(input.name);
  const formSlug = `${clinicSlug}-form`;
  const rawInviteToken = generateInviteToken();
  const hashedInviteToken = hashInviteToken(rawInviteToken);
  const temporaryPassword = crypto.randomBytes(12).toString('hex');
  const expiresAt = new Date(Date.now() + env.INVITE_TOKEN_EXPIRES_HOURS * 60 * 60 * 1000);

  const result = await withTransaction(async (client) => {
    const clinic = await clinicsRepository.createClinic(
      {
        name: input.name,
        slug: clinicSlug,
        clinicType: input.clinicType,
        phone: input.phone,
        clinicEmail: input.clinicEmail,
        city: input.city,
        state: input.state,
        timezone: input.timezone,
      },
      client
    );

    const owner = await clinicsRepository.createOwnerUser(
      {
        clinicId: clinic.id,
        ownerFullName: input.ownerFullName,
        ownerEmail: input.ownerEmail,
        temporaryPassword,
      },
      client
    );

    const invite = await clinicsRepository.createUserInvite(
      {
        clinicId: clinic.id,
        userId: owner.id,
        email: input.ownerEmail,
        role: 'owner',
        tokenHash: hashedInviteToken,
        expiresAt,
        createdByUserId: currentUser.id,
      },
      client
    );

    await clinicsRepository.createDefaultClinicSettings(clinic.id, client);
    await clinicsRepository.createDefaultClinicIntegration(clinic.id, input.ownerEmail, client);

    const publicForm = await clinicsRepository.createDefaultPublicForm(
      {
        clinicId: clinic.id,
        name: `${input.name} Enquiry Form`,
        slug: formSlug,
        successMessage: `Thank you for contacting ${input.name}. Our clinic will get back to you shortly.`,
      },
      client
    );

    await clinicsRepository.createDefaultMessageTemplates(clinic.id, input.name, client);

    return {
      clinic: buildClinicResponse(clinic),
      owner: buildOwnerResponse(owner),
      invite: buildInviteResponse(invite, rawInviteToken),
      rawInviteToken,
      publicForm: {
        id: publicForm.id,
        clinicId: publicForm.clinic_id,
        name: publicForm.name,
        slug: publicForm.slug,
        isDefault: publicForm.is_default,
        isActive: publicForm.is_active,
        successMessage: publicForm.success_message,
      },
    };
  });

  const delivery = await deliverInviteAndTrack({
    inviteId: result.invite.id,
    to: input.ownerEmail,
    clinicName: result.clinic.name,
    role: 'owner',
    rawInviteToken,
    invitedByName: currentUser.fullName || currentUser.email || 'ClinicGS',
  });

  return {
    clinic: result.clinic,
    owner: result.owner,
    invite: buildInviteResponse(delivery.trackedInvite || result.invite, rawInviteToken),
    publicForm: result.publicForm,
    inviteDelivery: delivery.inviteDelivery,
  };
}

async function updateClinicProfile(clinicId, updates, currentUser) {
  const existing = await clinicsRepository.findClinicById(clinicId);

  if (!existing) {
    throw new ApiError(404, 'Clinic not found.', { code: 'CLINIC_NOT_FOUND' });
  }

  if (currentUser.role !== ROLES.SUPER_ADMIN && Number(currentUser.clinicId) !== Number(clinicId)) {
    throw new ApiError(403, 'Forbidden clinic access.', { code: 'FORBIDDEN' });
  }

  const updated = await clinicsRepository.updateClinicProfile(clinicId, updates);

  return buildClinicResponse(updated);
}

async function updateClinicStatus(clinicId, status, currentUser) {
  if (currentUser.role !== ROLES.SUPER_ADMIN) {
    throw new ApiError(403, 'Only super admin can update clinic status.', {
      code: 'FORBIDDEN',
    });
  }

  const existing = await clinicsRepository.findClinicById(clinicId);

  if (!existing) {
    throw new ApiError(404, 'Clinic not found.', { code: 'CLINIC_NOT_FOUND' });
  }

  const updated = await clinicsRepository.updateClinicStatus(clinicId, status);

  return buildClinicResponse(updated);
}

module.exports = {
  listClinics,
  getClinicById,
  createClinic,
  updateClinicProfile,
  updateClinicStatus,
};