const express = require('express');
const asyncHandler = require('../../utils/async-handler');
const validate = require('../../middlewares/validate.middleware');
const authMiddleware = require('../../middlewares/auth.middleware');
const reviewsController = require('./reviews.controller');
const {
  reviewIdParamSchema,
  listReviewsQuerySchema,
  createReviewSchema,
  updateReviewSchema,
} = require('./reviews.validators');

const router = express.Router();

router.use(authMiddleware);

router.get(
  '/',
  validate({ query: listReviewsQuerySchema }),
  asyncHandler(reviewsController.listReviews)
);

router.post(
  '/',
  validate({ body: createReviewSchema }),
  asyncHandler(reviewsController.createReview)
);

router.patch(
  '/:reviewId',
  validate({
    params: reviewIdParamSchema,
    body: updateReviewSchema,
  }),
  asyncHandler(reviewsController.updateReview)
);

module.exports = router;