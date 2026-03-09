const { sendSuccess } = require('../../utils/api-response');
const publicFormsService = require('./public-forms.service');

async function listByClinicId(req, res) {
  const data = await publicFormsService.listByClinicId(req.params.clinicId, req.user);

  return sendSuccess(res, {
    message: 'Public forms fetched successfully.',
    data,
  });
}

async function createForm(req, res) {
  const data = await publicFormsService.createForm(req.params.clinicId, req.body, req.user);

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Public form created successfully.',
    data,
  });
}

async function updateForm(req, res) {
  const data = await publicFormsService.updateForm(req.params.formId, req.body, req.user);

  return sendSuccess(res, {
    message: 'Public form updated successfully.',
    data,
  });
}

async function getPublicFormBySlug(req, res) {
  const data = await publicFormsService.getPublicFormBySlug(req.params.slug);

  return sendSuccess(res, {
    message: 'Public form fetched successfully.',
    data,
  });
}

async function submitPublicForm(req, res) {
  const data = await publicFormsService.submitPublicForm(req.params.slug, req.body);

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Public form submitted successfully.',
    data,
  });
}

module.exports = {
  listByClinicId,
  createForm,
  updateForm,
  getPublicFormBySlug,
  submitPublicForm,
};