const express = require('express');
const asyncHandler = require('../../utils/async-handler');
const validate = require('../../middlewares/validate.middleware');
const authMiddleware = require('../../middlewares/auth.middleware');
const publicFormsController = require('./public-forms.controller');
const {
  clinicIdParamSchema,
  formIdParamSchema,
  publicSlugParamSchema,
  createPublicFormSchema,
  updatePublicFormSchema,
  submitPublicFormSchema,
} = require('./public-forms.validators');

const router = express.Router();

router.get(
  '/public/:slug',
  validate({ params: publicSlugParamSchema }),
  asyncHandler(publicFormsController.getPublicFormBySlug)
);

router.post(
  '/public/:slug/submit',
  validate({
    params: publicSlugParamSchema,
    body: submitPublicFormSchema,
  }),
  asyncHandler(publicFormsController.submitPublicForm)
);

router.use(authMiddleware);

router.get(
  '/clinic/:clinicId',
  validate({ params: clinicIdParamSchema }),
  asyncHandler(publicFormsController.listByClinicId)
);

router.post(
  '/clinic/:clinicId',
  validate({
    params: clinicIdParamSchema,
    body: createPublicFormSchema,
  }),
  asyncHandler(publicFormsController.createForm)
);

router.patch(
  '/:formId',
  validate({
    params: formIdParamSchema,
    body: updatePublicFormSchema,
  }),
  asyncHandler(publicFormsController.updateForm)
);

module.exports = router;