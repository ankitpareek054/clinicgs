const { withTransaction } = require('../../db/transaction');
const ApiError = require('../../utils/api-error');
const { ROLES } = require('../../config/constants');
const { slugify } = require('../../utils/slug');
const publicFormsRepository = require('./public-forms.repository');

function mapForm(row) {
  if (!row) return null;

  return {
    id: row.id,
    clinicId: row.clinic_id,
    name: row.name,
    slug: row.slug,
    isDefault: row.is_default,
    isActive: row.is_active,
    successMessage: row.success_message,
    clinicName: row.clinic_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLead(row) {
  if (!row) return null;

  return {
    id: row.id,
    clinicId: row.clinic_id,
    publicFormId: row.public_form_id,
    patientName: row.patient_name,
    phone: row.phone,
    email: row.email,
    source: row.source,
    intakeChannel: row.intake_channel,
    serviceRequested: row.service_requested,
    notes: row.notes,
    preferredAppointmentAt: row.preferred_appointment_at,
    pipelineStatus: row.pipeline_status,
    visibilityStatus: row.visibility_status,
    assignedToUserId: row.assigned_to_user_id,
    createdByUserId: row.created_by_user_id,
    nextFollowupAt: row.next_followup_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function ensureClinicAccess(clinicId, currentUser) {
  if (
    currentUser.role !== ROLES.SUPER_ADMIN &&
    Number(currentUser.clinicId) !== Number(clinicId)
  ) {
    throw new ApiError(403, 'Forbidden.', { code: 'FORBIDDEN' });
  }
}

function ensureCanManage(currentUser) {
  if (![ROLES.SUPER_ADMIN, ROLES.OWNER].includes(currentUser.role)) {
    throw new ApiError(403, 'Only owner or super admin can manage public forms.', {
      code: 'FORBIDDEN',
    });
  }
}

async function listByClinicId(clinicId, currentUser) {
  ensureClinicAccess(clinicId, currentUser);

  const rows = await publicFormsRepository.listByClinicId(clinicId);
  return rows.map(mapForm);
}

async function createForm(clinicId, input, currentUser) {
  ensureClinicAccess(clinicId, currentUser);
  ensureCanManage(currentUser);

  const slug = input.slug ? slugify(input.slug) : `${slugify(input.name)}-${Date.now()}`;

  const created = await publicFormsRepository.createForm({
    clinicId,
    name: input.name,
    slug,
    isDefault: Boolean(input.isDefault),
    isActive: input.isActive ?? true,
    successMessage: input.successMessage || 'Thank you. Our clinic will contact you shortly.',
  });

  return mapForm(created);
}

async function updateForm(formId, updates, currentUser) {
  const existing = await publicFormsRepository.findById(formId);

  if (!existing) {
    throw new ApiError(404, 'Public form not found.', {
      code: 'PUBLIC_FORM_NOT_FOUND',
    });
  }

  ensureClinicAccess(existing.clinic_id, currentUser);
  ensureCanManage(currentUser);

  const updated = await publicFormsRepository.updateForm(formId, updates);
  return mapForm(updated);
}

async function getPublicFormBySlug(slug) {
  const form = await publicFormsRepository.findBySlug(slug);

  if (!form || !form.is_active) {
    throw new ApiError(404, 'Public form not found.', {
      code: 'PUBLIC_FORM_NOT_FOUND',
    });
  }

  return mapForm(form);
}

async function submitPublicForm(slug, input) {
  const form = await publicFormsRepository.findBySlug(slug);

  if (!form || !form.is_active) {
    throw new ApiError(404, 'Public form not found.', {
      code: 'PUBLIC_FORM_NOT_FOUND',
    });
  }

  const settings = await publicFormsRepository.findClinicSettings(form.clinic_id);
  const autoFollowupEnabled = Boolean(settings?.public_form_auto_followup_enabled);
  const followupDelayHours = Number(settings?.public_form_followup_delay_hours || 0);

  let nextFollowupAt = null;

  if (autoFollowupEnabled) {
    nextFollowupAt = new Date(Date.now() + followupDelayHours * 60 * 60 * 1000).toISOString();
  }

  return withTransaction(async (client) => {
    const lead = await publicFormsRepository.createLeadFromPublicForm(
      {
        clinicId: form.clinic_id,
        publicFormId: form.id,
        patientName: input.patientName,
        phone: input.phone,
        email: input.email,
        serviceRequested: input.serviceRequested || null,
        notes: input.notes || null,
        preferredAppointmentAt: input.preferredAppointmentAt || null,
        nextFollowupAt,
      },
      client
    );

    let followup = null;

    if (autoFollowupEnabled && nextFollowupAt) {
      followup = await publicFormsRepository.createFollowupForLead(
        {
          clinicId: form.clinic_id,
          leadId: lead.id,
          dueAt: nextFollowupAt,
          notes: 'Auto-created from public form submission',
        },
        client
      );
    }

    return {
      form: mapForm(form),
      lead: mapLead(lead),
      followup,
      successMessage: form.success_message,
    };
  });
}

module.exports = {
  listByClinicId,
  createForm,
  updateForm,
  getPublicFormBySlug,
  submitPublicForm,
};