const ApiError = require('../../utils/api-error');
const { ROLES } = require('../../config/constants');
const clinicSettingsRepository = require('./clinic-settings.repository');

function mapSettings(row) {
  if (!row) return null;

  return {
    id: row.id,
    clinicId: row.clinic_id,
    defaultAppointmentDurationMins: row.default_appointment_duration_mins,
    reminder24hEnabled: row.reminder_24h_enabled,
    reminder2hEnabled: row.reminder_2h_enabled,
    autoFollowupAfterNoShow: row.auto_followup_after_no_show,
    noShowFollowupDelayHours: row.no_show_followup_delay_hours,
    publicFormAutoFollowupEnabled: row.public_form_auto_followup_enabled,
    publicFormFollowupDelayHours: row.public_form_followup_delay_hours,
    recallIntervalDays: row.recall_interval_days,
    reviewRequestEnabled: row.review_request_enabled,
    reviewRequestDelayHours: row.review_request_delay_hours,
    googleReviewLink: row.google_review_link,
    messageTone: row.message_tone,
    receptionistCanArchiveLeads: row.receptionist_can_archive_leads,
    businessHoursJson: row.business_hours_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertClinicAccess(clinicId, currentUser) {
  if (
    currentUser.role !== ROLES.SUPER_ADMIN &&
    Number(currentUser.clinicId) !== Number(clinicId)
  ) {
    throw new ApiError(403, 'Forbidden clinic access.', { code: 'FORBIDDEN' });
  }
}

function assertCanEdit(currentUser) {
  if (![ROLES.SUPER_ADMIN, ROLES.OWNER].includes(currentUser.role)) {
    throw new ApiError(403, 'Only owner or super admin can edit clinic settings.', {
      code: 'FORBIDDEN',
    });
  }
}

async function getByClinicId(clinicId, currentUser) {
  assertClinicAccess(clinicId, currentUser);

  const row = await clinicSettingsRepository.findByClinicId(clinicId);

  if (!row) {
    throw new ApiError(404, 'Clinic settings not found.', {
      code: 'CLINIC_SETTINGS_NOT_FOUND',
    });
  }

  return mapSettings(row);
}

async function updateByClinicId(clinicId, updates, currentUser) {
  assertClinicAccess(clinicId, currentUser);
  assertCanEdit(currentUser);

  const existing = await clinicSettingsRepository.findByClinicId(clinicId);

  if (!existing) {
    throw new ApiError(404, 'Clinic settings not found.', {
      code: 'CLINIC_SETTINGS_NOT_FOUND',
    });
  }

  const updated = await clinicSettingsRepository.updateByClinicId(clinicId, updates);

  return mapSettings(updated);
}

module.exports = {
  getByClinicId,
  updateByClinicId,
};