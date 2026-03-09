const { sendSuccess } = require('../../utils/api-response');
const reviewsService = require('./reviews.service');

async function listReviews(req, res) {
  const data = await reviewsService.listReviews(req.query, req.user);

  return sendSuccess(res, {
    message: 'Reviews fetched successfully.',
    data,
  });
}

async function createReview(req, res) {
  const data = await reviewsService.createReview(req.body, req.user);

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Review record created successfully.',
    data,
  });
}

async function updateReview(req, res) {
  const data = await reviewsService.updateReview(req.params.reviewId, req.body, req.user);

  return sendSuccess(res, {
    message: 'Review record updated successfully.',
    data,
  });
}

module.exports = {
  listReviews,
  createReview,
  updateReview,
};