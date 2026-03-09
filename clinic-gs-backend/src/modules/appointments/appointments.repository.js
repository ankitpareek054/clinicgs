const db = require('../../db');

async function listAppointments(filters = {}, client = null) {
  const values = [];
  const conditions = [];
  let index = 1;

  if (filters.clinicId !== undefined && filters.clinicId !== null) {
    conditions.push(`clinic_id = $${index++}`);
    values.push(filters.clinicId);
  }

  if (filters.leadId) {
    conditions.push(`lead_id = $${index++}`);
    values.push(filters.leadId);
  }

  if (filters.status) {
    conditions.push(`status = $${index++}`);
    values.push(filters.status);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT
      id,
      clinic_id,
      lead_id,
      created_by_user_id,
      start_time,
      end_time,
      status,
      calendar_event_id,
      sync_status,
      last_sync_attempt_at,
      sync_error_message,
      reminder_24h_sent_at,
      reminder_2h_sent_at,
      notes,
      created_at,
      updated_at
    FROM appointments
    ${whereClause}
    ORDER BY start_time DESC, id DESC
  `;

  const result = await db.query(query, values, client);
  return result.rows;
}

async function findById(appointmentId, client = null) {
  const query = `
    SELECT
      id,
      clinic_id,
      lead_id,
      created_by_user_id,
      start_time,
      end_time,
      status,
      calendar_event_id,
      sync_status,
      last_sync_attempt_at,
      sync_error_message,
      reminder_24h_sent_at,
      reminder_2h_sent_at,
      notes,
      created_at,
      updated_at
    FROM appointments
    WHERE id = $1
    LIMIT 1
  `;

  const result = await db.query(query, [appointmentId], client);
  return result.rows[0] || null;
}

async function findLeadById(leadId, client = null) {
  const query = `
    SELECT
      id,
      clinic_id,
      pipeline_status
    FROM leads
    WHERE id = $1
    LIMIT 1
  `;

  const result = await db.query(query, [leadId], client);
  return result.rows[0] || null;
}

async function findClinicIntegration(clinicId, client = null) {
  const query = `
    SELECT
      clinic_id,
      calendar_sync_enabled,
      integration_status,
      google_calendar_id
    FROM clinic_integrations
    WHERE clinic_id = $1
    LIMIT 1
  `;

  const result = await db.query(query, [clinicId], client);
  return result.rows[0] || null;
}

async function createAppointment(input, client = null) {
  const query = `
    INSERT INTO appointments (
      clinic_id,
      lead_id,
      created_by_user_id,
      start_time,
      end_time,
      status,
      calendar_event_id,
      sync_status,
      last_sync_attempt_at,
      sync_error_message,
      notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $8, $9, $10)
    RETURNING
      id,
      clinic_id,
      lead_id,
      created_by_user_id,
      start_time,
      end_time,
      status,
      calendar_event_id,
      sync_status,
      last_sync_attempt_at,
      sync_error_message,
      reminder_24h_sent_at,
      reminder_2h_sent_at,
      notes,
      created_at,
      updated_at
  `;

  const result = await db.query(
    query,
    [
      input.clinicId,
      input.leadId,
      input.createdByUserId || null,
      input.startTime,
      input.endTime,
      input.status,
      input.syncStatus,
      input.lastSyncAttemptAt || null,
      input.syncErrorMessage || null,
      input.notes || null,
    ],
    client
  );

  return result.rows[0];
}

async function updateAppointment(appointmentId, updates, client = null) {
  const fields = [];
  const values = [];
  let index = 1;

  const mapping = {
    startTime: 'start_time',
    endTime: 'end_time',
    status: 'status',
    syncStatus: 'sync_status',
    lastSyncAttemptAt: 'last_sync_attempt_at',
    syncErrorMessage: 'sync_error_message',
    notes: 'notes',
  };

  Object.entries(mapping).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      fields.push(`${column} = $${index++}`);
      values.push(updates[key]);
    }
  });

  if (!fields.length) {
    return findById(appointmentId, client);
  }

  values.push(appointmentId);

  const query = `
    UPDATE appointments
    SET ${fields.join(', ')}
    WHERE id = $${index}
    RETURNING
      id,
      clinic_id,
      lead_id,
      created_by_user_id,
      start_time,
      end_time,
      status,
      calendar_event_id,
      sync_status,
      last_sync_attempt_at,
      sync_error_message,
      reminder_24h_sent_at,
      reminder_2h_sent_at,
      notes,
      created_at,
      updated_at
  `;

  const result = await db.query(query, values, client);
  return result.rows[0] || null;
}

async function updateLeadPipeline(leadId, pipelineStatus, client = null) {
  const query = `
    UPDATE leads
    SET pipeline_status = $2
    WHERE id = $1
  `;

  await db.query(query, [leadId, pipelineStatus], client);
}

module.exports = {
  listAppointments,
  findById,
  findLeadById,
  findClinicIntegration,
  createAppointment,
  updateAppointment,
  updateLeadPipeline,
};