const { withTransaction } = require('../../db/transaction');
const ApiError = require('../../utils/api-error');
const { ROLES } = require('../../config/constants');
const reviewsRepository = require('./reviews.repository');

function mapReview(row) {
  if (!row) return null;

  return {
    id: row.id,
    clinicId: row.clinic_id,
    leadId: row.lead_id,
    appointmentId: row.appointment_id,
    requestedByUserId: row.requested_by_user_id,
    feedbackRating: row.feedback_rating,
    feedbackText: row.feedback_text,
    reviewLinkSentAt: row.review_link_sent_at,
    reviewPosted: row.review_posted,
    createdAt: row.created_at,
  };
}

function resolveClinicId(inputClinicId, currentUser) {
  if (currentUser.role === ROLES.SUPER_ADMIN) {
    if (!inputClinicId) {
      throw new ApiError(400, 'clinicId is required for super admin.', {
        code: 'CLINIC_ID_REQUIRED',
      });
    }

    return Number(inputClinicId);
  }

  return Number(currentUser.clinicId);
}

async function assertReviewAccess(reviewId, currentUser) {
  const review = await reviewsRepository.findById(reviewId);

  if (!review) {
    throw new ApiError(404, 'Review not found.', {
      code: 'REVIEW_NOT_FOUND',
    });
  }

  if (
    currentUser.role !== ROLES.SUPER_ADMIN &&
    Number(currentUser.clinicId) !== Number(review.clinic_id)
  ) {
    throw new ApiError(403, 'Forbidden.', { code: 'FORBIDDEN' });
  }

  return review;
}

async function listReviews(filters, currentUser) {
  const clinicId = resolveClinicId(filters.clinicId, currentUser);

  const rows = await reviewsRepository.listReviews({
    ...filters,
    clinicId,
  });

  return rows.map(mapReview);
}

async function createReview(input, currentUser) {
  const clinicId = resolveClinicId(input.clinicId, currentUser);
  const lead = await reviewsRepository.findLeadById(input.leadId);

  if (!lead) {
    throw new ApiError(404, 'Lead not found.', { code: 'LEAD_NOT_FOUND' });
  }

  if (Number(lead.clinic_id) !== Number(clinicId)) {
    throw new ApiError(400, 'Lead does not belong to the selected clinic.', {
      code: 'LEAD_CLINIC_MISMATCH',
    });
  }

  if (input.appointmentId) {
    const appointment = await reviewsRepository.findAppointmentById(input.appointmentId);

    if (!appointment) {
      throw new ApiError(404, 'Appointment not found.', {
        code: 'APPOINTMENT_NOT_FOUND',
      });
    }

    if (
      Number(appointment.clinic_id) !== Number(clinicId) ||
      Number(appointment.lead_id) !== Number(input.leadId)
    ) {
      throw new ApiError(400, 'Appointment does not match clinic/lead.', {
        code: 'APPOINTMENT_LEAD_MISMATCH',
      });
    }
  }

  return withTransaction(async (client) => {
    const created = await reviewsRepository.createReview(
      {
        clinicId,
        leadId: input.leadId,
        appointmentId: input.appointmentId || null,
        requestedByUserId: currentUser.id,
        feedbackRating: input.feedbackRating ?? null,
        feedbackText: input.feedbackText || null,
        reviewLinkSentAt: input.reviewLinkSentAt || null,
        reviewPosted: input.reviewPosted ?? null,
      },
      client
    );

    if (created.review_link_sent_at) {
      await reviewsRepository.updateLeadPipeline(input.leadId, 'review_pending', client);
    }

    return mapReview(created);
  });
}

async function updateReview(reviewId, updates, currentUser) {
  const existing = await assertReviewAccess(reviewId, currentUser);

  return withTransaction(async (client) => {
    const updated = await reviewsRepository.updateReview(reviewId, updates, client);

    if (updated.review_link_sent_at) {
      await reviewsRepository.updateLeadPipeline(existing.lead_id, 'review_pending', client);
    }

    return mapReview(updated);
  });
}

module.exports = {
  listReviews,
  createReview,
  updateReview,
};