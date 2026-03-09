const ApiError = require('../../utils/api-error');
const { ROLES } = require('../../config/constants');
const clinicIntegrationsRepository = require('./clinic-integrations.repository');

function mapIntegration(row) {
  if (!row) return null;

  return {
    id: row.id,
    clinicId: row.clinic_id,
    googleCalendarId: row.google_calendar_id,
    calendarSyncEnabled: row.calendar_sync_enabled,
    makeWebhookUrl: row.make_webhook_url,
    integrationStatus: row.integration_status,
    ownerReportEmail: row.owner_report_email,
    dailyOwnerReportEnabled: row.daily_owner_report_enabled,
    lastSyncAt: row.last_sync_at,
    lastErrorMessage: row.last_error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertViewAccess(clinicId, currentUser) {
  const allowedRoles = [ROLES.SUPER_ADMIN, ROLES.OWNER];

  if (!allowedRoles.includes(currentUser.role)) {
    throw new ApiError(403, 'Receptionists cannot access clinic integrations.', {
      code: 'FORBIDDEN',
    });
  }

  if (
    currentUser.role !== ROLES.SUPER_ADMIN &&
    Number(currentUser.clinicId) !== Number(clinicId)
  ) {
    throw new ApiError(403, 'Forbidden clinic access.', { code: 'FORBIDDEN' });
  }
}

async function getByClinicId(clinicId, currentUser) {
  assertViewAccess(clinicId, currentUser);

  const row = await clinicIntegrationsRepository.findByClinicId(clinicId);

  if (!row) {
    throw new ApiError(404, 'Clinic integration settings not found.', {
      code: 'CLINIC_INTEGRATIONS_NOT_FOUND',
    });
  }

  return mapIntegration(row);
}

async function updateByClinicId(clinicId, updates, currentUser) {
  if (currentUser.role !== ROLES.SUPER_ADMIN) {
    throw new ApiError(403, 'Only super admin can edit clinic integrations.', {
      code: 'FORBIDDEN',
    });
  }

  const existing = await clinicIntegrationsRepository.findByClinicId(clinicId);

  if (!existing) {
    throw new ApiError(404, 'Clinic integration settings not found.', {
      code: 'CLINIC_INTEGRATIONS_NOT_FOUND',
    });
  }

  const updated = await clinicIntegrationsRepository.updateByClinicId(clinicId, updates);

  return mapIntegration(updated);
}

module.exports = {
  getByClinicId,
  updateByClinicId,
};