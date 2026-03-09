const express = require('express');
const asyncHandler = require('../../utils/async-handler');
const validate = require('../../middlewares/validate.middleware');
const authMiddleware = require('../../middlewares/auth.middleware');
const requireRole = require('../../middlewares/require-role.middleware');
const { ROLES } = require('../../config/constants');
const clinicsController = require('./clinics.controller');
const {
  clinicIdParamSchema,
  createClinicSchema,
  listClinicsQuerySchema,
  updateClinicProfileSchema,
  updateClinicStatusSchema,
} = require('./clinics.validators');

const router = express.Router();

router.use(authMiddleware);

router.get(
  '/',
  validate({ query: listClinicsQuerySchema }),
  asyncHandler(clinicsController.listClinics)
);

router.get(
  '/:clinicId',
  validate({ params: clinicIdParamSchema }),
  asyncHandler(clinicsController.getClinicById)
);

router.post(
  '/',
  requireRole([ROLES.SUPER_ADMIN]),
  validate({ body: createClinicSchema }),
  asyncHandler(clinicsController.createClinic)
);

router.patch(
  '/:clinicId/profile',
  requireRole([ROLES.SUPER_ADMIN, ROLES.OWNER]),
  validate({ params: clinicIdParamSchema, body: updateClinicProfileSchema }),
  asyncHandler(clinicsController.updateClinicProfile)
);

router.patch(
  '/:clinicId/status',
  requireRole([ROLES.SUPER_ADMIN]),
  validate({ params: clinicIdParamSchema, body: updateClinicStatusSchema }),
  asyncHandler(clinicsController.updateClinicStatus)
);

module.exports = router;