const crypto = require('crypto');
const { withTransaction } = require('../../db/transaction');
const ApiError = require('../../utils/api-error');
const { slugify } = require('../../utils/slug');
const { generateInviteToken, hashInviteToken } = require('../../utils/invite-token');
const env = require('../../config/env');
const { ROLES } = require('../../config/constants');
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

async function ensureUniqueSlug(name) {
  const baseSlug = slugify(name);
  const firstTry = baseSlug || `clinic-${Date.now()}`;

  const existing = await clinicsRepository.findClinicBySlug(firstTry);
  if (!existing) return firstTry;

  return `${firstTry}-${Date.now()}`;
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

  return withTransaction(async (client) => {
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
      owner: {
        id: owner.id,
        clinicId: owner.clinic_id,
        fullName: owner.full_name,
        email: owner.email,
        role: owner.role,
        status: owner.status,
        mustResetPassword: owner.must_reset_password,
        createdAt: owner.created_at,
      },
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        status: invite.invite_status,
        expiresAt: invite.expires_at,
        sentAt: invite.sent_at,
        rawTokenPreview: env.NODE_ENV === 'development' ? rawInviteToken : undefined,
      },
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