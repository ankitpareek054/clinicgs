const db = require('../../db');

async function listReviews(filters = {}, client = null) {
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

  if (filters.reviewPosted !== undefined) {
    conditions.push(`review_posted = $${index++}`);
    values.push(filters.reviewPosted);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT
      id,
      clinic_id,
      lead_id,
      appointment_id,
      requested_by_user_id,
      feedback_rating,
      feedback_text,
      review_link_sent_at,
      review_posted,
      created_at
    FROM reviews
    ${whereClause}
    ORDER BY created_at DESC, id DESC
  `;

  const result = await db.query(query, values, client);
  return result.rows;
}

async function findById(reviewId, client = null) {
  const query = `
    SELECT
      id,
      clinic_id,
      lead_id,
      appointment_id,
      requested_by_user_id,
      feedback_rating,
      feedback_text,
      review_link_sent_at,
      review_posted,
      created_at
    FROM reviews
    WHERE id = $1
    LIMIT 1
  `;

  const result = await db.query(query, [reviewId], client);
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

async function findAppointmentById(appointmentId, client = null) {
  const query = `
    SELECT
      id,
      clinic_id,
      lead_id,
      status
    FROM appointments
    WHERE id = $1
    LIMIT 1
  `;

  const result = await db.query(query, [appointmentId], client);
  return result.rows[0] || null;
}

async function createReview(input, client = null) {
  const query = `
    INSERT INTO reviews (
      clinic_id,
      lead_id,
      appointment_id,
      requested_by_user_id,
      feedback_rating,
      feedback_text,
      review_link_sent_at,
      review_posted
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING
      id,
      clinic_id,
      lead_id,
      appointment_id,
      requested_by_user_id,
      feedback_rating,
      feedback_text,
      review_link_sent_at,
      review_posted,
      created_at
  `;

  const result = await db.query(
    query,
    [
      input.clinicId,
      input.leadId,
      input.appointmentId || null,
      input.requestedByUserId || null,
      input.feedbackRating ?? null,
      input.feedbackText || null,
      input.reviewLinkSentAt || null,
      input.reviewPosted ?? null,
    ],
    client
  );

  return result.rows[0];
}

async function updateReview(reviewId, updates, client = null) {
  const fields = [];
  const values = [];
  let index = 1;

  const mapping = {
    feedbackRating: 'feedback_rating',
    feedbackText: 'feedback_text',
    reviewLinkSentAt: 'review_link_sent_at',
    reviewPosted: 'review_posted',
  };

  Object.entries(mapping).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      fields.push(`${column} = $${index++}`);
      values.push(updates[key]);
    }
  });

  if (!fields.length) {
    return findById(reviewId, client);
  }

  values.push(reviewId);

  const query = `
    UPDATE reviews
    SET ${fields.join(', ')}
    WHERE id = $${index}
    RETURNING
      id,
      clinic_id,
      lead_id,
      appointment_id,
      requested_by_user_id,
      feedback_rating,
      feedback_text,
      review_link_sent_at,
      review_posted,
      created_at
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
  listReviews,
  findById,
  findLeadById,
  findAppointmentById,
  createReview,
  updateReview,
  updateLeadPipeline,
};