const express = require('express');
const asyncHandler = require('../../utils/async-handler');
const validate = require('../../middlewares/validate.middleware');
const authMiddleware = require('../../middlewares/auth.middleware');
const staffRequestsController = require('./staff-requests.controller');
const {
  requestIdParamSchema,
  listStaffRequestsQuerySchema,
  createStaffRequestSchema,
  decideStaffRequestSchema,
  resendInviteSchema,
} = require('./staff-requests.validators');

const router = express.Router();

router.use(authMiddleware);

router.get(
  '/',
  validate({ query: listStaffRequestsQuerySchema }),
  asyncHandler(staffRequestsController.listRequests)
);

router.post(
  '/',
  validate({ body: createStaffRequestSchema }),
  asyncHandler(staffRequestsController.createRequest)
);

router.post(
  '/resend-invite',
  validate({ body: resendInviteSchema }),
  asyncHandler(staffRequestsController.resendInvite)
);

router.patch(
  '/:requestId/decision',
  validate({
    params: requestIdParamSchema,
    body: decideStaffRequestSchema,
  }),
  asyncHandler(staffRequestsController.decideRequest)
);

module.exports = router;