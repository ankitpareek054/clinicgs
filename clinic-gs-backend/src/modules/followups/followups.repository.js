const db = require('../../db');

async function listFollowups(filters = {}, client = null) {
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
      due_at,
      status,
      outcome,
      notes,
      created_by_user_id,
      completed_by_user_id,
      created_at,
      completed_at
    FROM followups
    ${whereClause}
    ORDER BY due_at ASC, id ASC
  `;

  const result = await db.query(query, values, client);
  return result.rows;
}

async function findById(followupId, client = null) {
  const query = `
    SELECT
      id,
      clinic_id,
      lead_id,
      due_at,
      status,
      outcome,
      notes,
      created_by_user_id,
      completed_by_user_id,
      created_at,
      completed_at
    FROM followups
    WHERE id = $1
    LIMIT 1
  `;

  const result = await db.query(query, [followupId], client);
  return result.rows[0] || null;
}

async function findLeadById(leadId, client = null) {
  const query = `
    SELECT id, clinic_id, next_followup_at
    FROM leads
    WHERE id = $1
    LIMIT 1
  `;

  const result = await db.query(query, [leadId], client);
  return result.rows[0] || null;
}

async function createFollowup(input, client = null) {
  const query = `
    INSERT INTO followups (
      clinic_id,
      lead_id,
      due_at,
      status,
      outcome,
      notes,
      created_by_user_id
    )
    VALUES ($1, $2, $3, 'pending', $4, $5, NULLIF($6, '')::bigint)
    RETURNING
      id,
      clinic_id,
      lead_id,
      due_at,
      status,
      outcome,
      notes,
      created_by_user_id,
      completed_by_user_id,
      created_at,
      completed_at
  `;

  const result = await db.query(
    query,
    [
      input.clinicId,
      input.leadId,
      input.dueAt,
      input.outcome || null,
      input.notes || null,
      input.createdByUserId || null,
    ],
    client
  );

  return result.rows[0];
}

async function updateFollowup(followupId, updates, client = null) {
  const fields = [];
  const values = [];
  let index = 1;

  const mapping = {
    dueAt: 'due_at',
    outcome: 'outcome',
    notes: 'notes',
  };

  Object.entries(mapping).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      fields.push(`${column} = $${index++}`);
      values.push(updates[key]);
    }
  });

  if (!fields.length) {
    return findById(followupId, client);
  }

  values.push(followupId);

  const query = `
    UPDATE followups
    SET ${fields.join(', ')}
    WHERE id = $${index}
    RETURNING
      id,
      clinic_id,
      lead_id,
      due_at,
      status,
      outcome,
      notes,
      created_by_user_id,
      completed_by_user_id,
      created_at,
      completed_at
  `;

  const result = await db.query(query, values, client);
  return result.rows[0] || null;
}

async function updateFollowupStatus(followupId, input, client = null) {
  const query = `
    UPDATE followups
    SET
      status = $2,
      outcome = COALESCE($3, outcome),
      notes = COALESCE($4, notes),
      completed_by_user_id = CASE
        WHEN $2 IN ('done', 'skipped') THEN NULLIF($5, '')::bigint
        ELSE NULL
      END,
      completed_at = CASE
        WHEN $2 IN ('done', 'skipped') THEN NOW()
        ELSE NULL
      END
    WHERE id = $1
    RETURNING
      id,
      clinic_id,
      lead_id,
      due_at,
      status,
      outcome,
      notes,
      created_by_user_id,
      completed_by_user_id,
      created_at,
      completed_at
  `;

  const result = await db.query(
    query,
    [
      followupId,
      input.status,
      input.outcome || null,
      input.notes || null,
      input.completedByUserId || null,
    ],
    client
  );

  return result.rows[0] || null;
}

async function updateLeadNextFollowup(leadId, nextFollowupAt, client = null) {
  const query = `
    UPDATE leads
    SET next_followup_at = $2
    WHERE id = $1
  `;

  await db.query(query, [leadId, nextFollowupAt], client);
}

async function findNextPendingFollowupForLead(leadId, client = null) {
  const query = `
    SELECT due_at
    FROM followups
    WHERE lead_id = $1
      AND status = 'pending'
    ORDER BY due_at ASC
    LIMIT 1
  `;

  const result = await db.query(query, [leadId], client);
  return result.rows[0] || null;
}

module.exports = {
  listFollowups,
  findById,
  findLeadById,
  createFollowup,
  updateFollowup,
  updateFollowupStatus,
  updateLeadNextFollowup,
  findNextPendingFollowupForLead,
};