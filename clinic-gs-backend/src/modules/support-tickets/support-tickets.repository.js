const db = require('../../db');

async function listTickets(filters = {}, client = null) {
  const values = [];
  const conditions = [];
  let index = 1;

  if (filters.clinicId !== undefined && filters.clinicId !== null) {
    conditions.push(`clinic_id = $${index++}`);
    values.push(filters.clinicId);
  }

  if (filters.createdByUserId !== undefined && filters.createdByUserId !== null) {
    conditions.push(`created_by_user_id = $${index++}`);
    values.push(filters.createdByUserId);
  }

  if (filters.status) {
    conditions.push(`status = $${index++}`);
    values.push(filters.status);
  }

  if (filters.priority) {
    conditions.push(`priority = $${index++}`);
    values.push(filters.priority);
  }

  if (filters.ticketType) {
    conditions.push(`ticket_type = $${index++}`);
    values.push(filters.ticketType);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT
      id,
      clinic_id,
      created_by_user_id,
      ticket_type,
      status,
      priority,
      title,
      description,
      resolved_by_user_id,
      resolved_at,
      created_at,
      updated_at
    FROM support_tickets
    ${whereClause}
    ORDER BY created_at DESC, id DESC
  `;

  const result = await db.query(query, values, client);
  return result.rows;
}

async function findTicketById(ticketId, client = null) {
  const query = `
    SELECT
      id,
      clinic_id,
      created_by_user_id,
      ticket_type,
      status,
      priority,
      title,
      description,
      resolved_by_user_id,
      resolved_at,
      created_at,
      updated_at
    FROM support_tickets
    WHERE id = $1
    LIMIT 1
  `;

  const result = await db.query(query, [ticketId], client);
  return result.rows[0] || null;
}

async function createTicket(input, client = null) {
  const query = `
    INSERT INTO support_tickets (
      clinic_id,
      created_by_user_id,
      ticket_type,
      status,
      priority,
      title,
      description
    )
    VALUES ($1, $2, $3, 'open', $4, $5, $6)
    RETURNING
      id,
      clinic_id,
      created_by_user_id,
      ticket_type,
      status,
      priority,
      title,
      description,
      resolved_by_user_id,
      resolved_at,
      created_at,
      updated_at
  `;

  const result = await db.query(
    query,
    [
      input.clinicId,
      input.createdByUserId,
      input.ticketType,
      input.priority || 'medium',
      input.title,
      input.description,
    ],
    client
  );

  return result.rows[0];
}

async function updateTicket(ticketId, updates, client = null) {
  const fields = [];
  const values = [];
  let index = 1;

  const mapping = {
    status: 'status',
    priority: 'priority',
    title: 'title',
    description: 'description',
  };

  Object.entries(mapping).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      fields.push(`${column} = $${index++}`);
      values.push(updates[key]);
    }
  });

  if (Object.prototype.hasOwnProperty.call(updates, 'resolvedByUserId')) {
    fields.push(`resolved_by_user_id = $${index++}`);
    values.push(updates.resolvedByUserId);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'resolvedAt')) {
    fields.push(`resolved_at = $${index++}`);
    values.push(updates.resolvedAt);
  }

  if (!fields.length) {
    return findTicketById(ticketId, client);
  }

  values.push(ticketId);

  const query = `
    UPDATE support_tickets
    SET ${fields.join(', ')}
    WHERE id = $${index}
    RETURNING
      id,
      clinic_id,
      created_by_user_id,
      ticket_type,
      status,
      priority,
      title,
      description,
      resolved_by_user_id,
      resolved_at,
      created_at,
      updated_at
  `;

  const result = await db.query(query, values, client);
  return result.rows[0] || null;
}

module.exports = {
  listTickets,
  findTicketById,
  createTicket,
  updateTicket,
};