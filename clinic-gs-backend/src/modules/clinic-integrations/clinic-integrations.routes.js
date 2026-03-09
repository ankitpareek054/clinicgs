const express = require('express');
const asyncHandler = require('../../utils/async-handler');
const validate = require('../../middlewares/validate.middleware');
const authMiddleware = require('../../middlewares/auth.middleware');
const clinicIntegrationsController = require('./clinic-integrations.controller');
const {
  clinicIdParamSchema,
  updateClinicIntegrationSchema,
} = require('./clinic-integrations.validators');

const router = express.Router();

router.use(authMiddleware);

router.get(
  '/:clinicId',
  validate({ params: clinicIdParamSchema }),
  asyncHandler(clinicIntegrationsController.getByClinicId)
);

router.patch(
  '/:clinicId',
  validate({
    params: clinicIdParamSchema,
    body: updateClinicIntegrationSchema,
  }),
  asyncHandler(clinicIntegrationsController.updateByClinicId)
);

module.exports = router;