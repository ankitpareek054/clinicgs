const express = require('express');
const asyncHandler = require('../../utils/async-handler');
const validate = require('../../middlewares/validate.middleware');
const authMiddleware = require('../../middlewares/auth.middleware');
const clinicServicesController = require('./clinic-services.controller');
const {
  clinicIdParamSchema,
  serviceIdParamSchema,
  createClinicServiceSchema,
  updateClinicServiceSchema,
} = require('./clinic-services.validators');

const router = express.Router();

router.use(authMiddleware);

router.get(
  '/:clinicId',
  validate({ params: clinicIdParamSchema }),
  asyncHandler(clinicServicesController.listByClinicId)
);

router.post(
  '/:clinicId',
  validate({
    params: clinicIdParamSchema,
    body: createClinicServiceSchema,
  }),
  asyncHandler(clinicServicesController.createService)
);

router.patch(
  '/:clinicId/:serviceId',
  validate({
    params: clinicIdParamSchema.merge(serviceIdParamSchema),
    body: updateClinicServiceSchema,
  }),
  asyncHandler(clinicServicesController.updateService)
);

router.delete(
  '/:clinicId/:serviceId',
  validate({
    params: clinicIdParamSchema.merge(serviceIdParamSchema),
  }),
  asyncHandler(clinicServicesController.archiveService)
);

module.exports = router;