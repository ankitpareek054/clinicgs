const express = require('express');
const asyncHandler = require('../../utils/async-handler');
const validate = require('../../middlewares/validate.middleware');
const authMiddleware = require('../../middlewares/auth.middleware');
const followupsController = require('./followups.controller');
const {
  followupIdParamSchema,
  listFollowupsQuerySchema,
  createFollowupSchema,
  updateFollowupSchema,
  updateFollowupStatusSchema,
} = require('./followups.validators');

const router = express.Router();

router.use(authMiddleware);

router.get(
  '/',
  validate({ query: listFollowupsQuerySchema }),
  asyncHandler(followupsController.listFollowups)
);

router.post(
  '/',
  validate({ body: createFollowupSchema }),
  asyncHandler(followupsController.createFollowup)
);

router.patch(
  '/:followupId',
  validate({
    params: followupIdParamSchema,
    body: updateFollowupSchema,
  }),
  asyncHandler(followupsController.updateFollowup)
);

router.patch(
  '/:followupId/status',
  validate({
    params: followupIdParamSchema,
    body: updateFollowupStatusSchema,
  }),
  asyncHandler(followupsController.updateFollowupStatus)
);

module.exports = router;