const { sendSuccess } = require('../../utils/api-response');
const clinicSettingsService = require('./clinic-settings.service');

async function getByClinicId(req, res) {
  const data = await clinicSettingsService.getByClinicId(req.params.clinicId, req.user);

  return sendSuccess(res, {
    message: 'Clinic settings fetched successfully.',
    data,
  });
}

async function updateByClinicId(req, res) {
  const data = await clinicSettingsService.updateByClinicId(
    req.params.clinicId,
    req.body,
    req.user
  );

  return sendSuccess(res, {
    message: 'Clinic settings updated successfully.',
    data,
  });
}

module.exports = {
  getByClinicId,
  updateByClinicId,
};