const express = require('express');
const asyncHandler = require('../../utils/async-handler');
const validate = require('../../middlewares/validate.middleware');
const authMiddleware = require('../../middlewares/auth.middleware');
const requireRole = require('../../middlewares/require-role.middleware');
const { ROLES } = require('../../config/constants');
const { sendSuccess } = require('../../utils/api-response');
const clinicSettingsService = require('./clinic-settings.service');
const {
  clinicIdParamSchema,
  updateClinicSettingsSchema,
} = require('./clinic-settings.validators');

const router = express.Router();

router.use(authMiddleware);

router.get(
  '/:clinicId',
  requireRole([ROLES.SUPER_ADMIN, ROLES.OWNER]),
  validate({ params: clinicIdParamSchema }),
  asyncHandler(async (req, res) => {
    const data = await clinicSettingsService.getByClinicId(
      req.params.clinicId,
      req.user
    );

    return sendSuccess(res, {
      message: 'Clinic settings fetched successfully.',
      data,
    });
  })
);

router.patch(
  '/:clinicId',
  requireRole([ROLES.SUPER_ADMIN, ROLES.OWNER]),
  validate({
    params: clinicIdParamSchema,
    body: updateClinicSettingsSchema,
  }),
  asyncHandler(async (req, res) => {
    const data = await clinicSettingsService.updateByClinicId(
      req.params.clinicId,
      req.body,
      req.user
    );

    return sendSuccess(res, {
      message: 'Clinic settings updated successfully.',
      data,
    });
  })
);

module.exports = router;