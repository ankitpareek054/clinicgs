const { sendSuccess } = require('../../utils/api-response');
const clinicIntegrationsService = require('./clinic-integrations.service');

async function getByClinicId(req, res) {
  const data = await clinicIntegrationsService.getByClinicId(req.params.clinicId, req.user);

  return sendSuccess(res, {
    message: 'Clinic integrations fetched successfully.',
    data,
  });
}

async function updateByClinicId(req, res) {
  const data = await clinicIntegrationsService.updateByClinicId(
    req.params.clinicId,
    req.body,
    req.user
  );

  return sendSuccess(res, {
    message: 'Clinic integrations updated successfully.',
    data,
  });
}

module.exports = {
  getByClinicId,
  updateByClinicId,
};