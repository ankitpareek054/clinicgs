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

router.patch(
  '/:requestId/decision',
  validate({
    params: requestIdParamSchema,
    body: decideStaffRequestSchema,
  }),
  asyncHandler(staffRequestsController.decideRequest)
);

module.exports = router;