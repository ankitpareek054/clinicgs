const db = require('../../db');

async function findByClinicId(clinicId, client = null) {
  const query = `
    SELECT
      id,
      clinic_id,
      google_calendar_id,
      calendar_sync_enabled,
      make_webhook_url,
      integration_status,
      owner_report_email::text AS owner_report_email,
      daily_owner_report_enabled,
      last_sync_at,
      last_error_message,
      created_at,
      updated_at
    FROM clinic_integrations
    WHERE clinic_id = $1
    LIMIT 1
  `;

  const result = await db.query(query, [clinicId], client);
  return result.rows[0] || null;
}

async function updateByClinicId(clinicId, updates, client = null) {
  const fields = [];
  const values = [];
  let index = 1;

  const mapping = {
    googleCalendarId: 'google_calendar_id',
    calendarSyncEnabled: 'calendar_sync_enabled',
    makeWebhookUrl: 'make_webhook_url',
    integrationStatus: 'integration_status',
    ownerReportEmail: 'owner_report_email',
    dailyOwnerReportEnabled: 'daily_owner_report_enabled',
    lastErrorMessage: 'last_error_message',
  };

  Object.entries(mapping).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      fields.push(`${column} = $${index++}`);
      values.push(updates[key]);
    }
  });

  if (fields.some((field) => field.startsWith('integration_status')) || fields.some((field) => field.startsWith('last_error_message'))) {
    fields.push(`last_sync_at = NOW()`);
  }

  if (!fields.length) {
    return findByClinicId(clinicId, client);
  }

  values.push(clinicId);

  const query = `
    UPDATE clinic_integrations
    SET ${fields.join(', ')}
    WHERE clinic_id = $${index}
    RETURNING
      id,
      clinic_id,
      google_calendar_id,
      calendar_sync_enabled,
      make_webhook_url,
      integration_status,
      owner_report_email::text AS owner_report_email,
      daily_owner_report_enabled,
      last_sync_at,
      last_error_message,
      created_at,
      updated_at
  `;

  const result = await db.query(query, values, client);
  return result.rows[0] || null;
}

module.exports = {
  findByClinicId,
  updateByClinicId,
};