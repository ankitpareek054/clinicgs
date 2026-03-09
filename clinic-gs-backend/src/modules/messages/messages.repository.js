const db = require('../../db');

async function listMessageLogs(filters = {}, client = null) {
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

  if (filters.appointmentId) {
    conditions.push(`appointment_id = $${index++}`);
    values.push(filters.appointmentId);
  }

  if (filters.channel) {
    conditions.push(`channel = $${index++}`);
    values.push(filters.channel);
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
      appointment_id,
      created_by_user_id,
      channel,
      template_name,
      recipient,
      status,
      error_message,
      created_at
    FROM message_logs
    ${whereClause}
    ORDER BY created_at DESC, id DESC
  `;

  const result = await db.query(query, values, client);
  return result.rows;
}

async function findMessageLogById(messageLogId, client = null) {
  const query = `
    SELECT
      id,
      clinic_id,
      lead_id,
      appointment_id,
      created_by_user_id,
      channel,
      template_name,
      recipient,
      status,
      error_message,
      created_at
    FROM message_logs
    WHERE id = $1
    LIMIT 1
  `;

  const result = await db.query(query, [messageLogId], client);
  return result.rows[0] || null;
}

async function findLeadById(leadId, client = null) {
  const query = `
    SELECT id, clinic_id
    FROM leads
    WHERE id = $1
    LIMIT 1
  `;

  const result = await db.query(query, [leadId], client);
  return result.rows[0] || null;
}

async function findAppointmentById(appointmentId, client = null) {
  const query = `
    SELECT id, clinic_id, lead_id
    FROM appointments
    WHERE id = $1
    LIMIT 1
  `;

  const result = await db.query(query, [appointmentId], client);
  return result.rows[0] || null;
}

async function createMessageLog(input, client = null) {
  const query = `
    INSERT INTO message_logs (
      clinic_id,
      lead_id,
      appointment_id,
      created_by_user_id,
      channel,
      template_name,
      recipient,
      status,
      error_message
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING
      id,
      clinic_id,
      lead_id,
      appointment_id,
      created_by_user_id,
      channel,
      template_name,
      recipient,
      status,
      error_message,
      created_at
  `;

  const result = await db.query(
    query,
    [
      input.clinicId,
      input.leadId || null,
      input.appointmentId || null,
      input.createdByUserId || null,
      input.channel,
      input.templateName || null,
      input.recipient || null,
      input.status,
      input.errorMessage || null,
    ],
    client
  );

  return result.rows[0];
}

module.exports = {
  listMessageLogs,
  findMessageLogById,
  findLeadById,
  findAppointmentById,
  createMessageLog,
};