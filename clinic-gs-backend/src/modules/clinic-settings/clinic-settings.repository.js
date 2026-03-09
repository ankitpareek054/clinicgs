const db = require('../../db');

async function findByClinicId(clinicId, client = null) {
  const query = `
    SELECT
      id,
      clinic_id,
      default_appointment_duration_mins,
      reminder_24h_enabled,
      reminder_2h_enabled,
      auto_followup_after_no_show,
      no_show_followup_delay_hours,
      public_form_auto_followup_enabled,
      public_form_followup_delay_hours,
      recall_interval_days,
      review_request_enabled,
      review_request_delay_hours,
      google_review_link,
      message_tone,
      receptionist_can_archive_leads,
      business_hours_json,
      created_at,
      updated_at
    FROM clinic_settings
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
    defaultAppointmentDurationMins: 'default_appointment_duration_mins',
    reminder24hEnabled: 'reminder_24h_enabled',
    reminder2hEnabled: 'reminder_2h_enabled',
    autoFollowupAfterNoShow: 'auto_followup_after_no_show',
    noShowFollowupDelayHours: 'no_show_followup_delay_hours',
    publicFormAutoFollowupEnabled: 'public_form_auto_followup_enabled',
    publicFormFollowupDelayHours: 'public_form_followup_delay_hours',
    recallIntervalDays: 'recall_interval_days',
    reviewRequestEnabled: 'review_request_enabled',
    reviewRequestDelayHours: 'review_request_delay_hours',
    googleReviewLink: 'google_review_link',
    messageTone: 'message_tone',
    receptionistCanArchiveLeads: 'receptionist_can_archive_leads',
    businessHoursJson: 'business_hours_json',
  };

  Object.entries(mapping).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      fields.push(`${column} = $${index++}`);
      values.push(updates[key]);
    }
  });

  if (!fields.length) {
    return findByClinicId(clinicId, client);
  }

  values.push(clinicId);

  const query = `
    UPDATE clinic_settings
    SET ${fields.join(', ')}
    WHERE clinic_id = $${index}
    RETURNING
      id,
      clinic_id,
      default_appointment_duration_mins,
      reminder_24h_enabled,
      reminder_2h_enabled,
      auto_followup_after_no_show,
      no_show_followup_delay_hours,
      public_form_auto_followup_enabled,
      public_form_followup_delay_hours,
      recall_interval_days,
      review_request_enabled,
      review_request_delay_hours,
      google_review_link,
      message_tone,
      receptionist_can_archive_leads,
      business_hours_json,
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