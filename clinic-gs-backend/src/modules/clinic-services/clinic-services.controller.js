const { sendSuccess } = require('../../utils/api-response');
const clinicServicesService = require('./clinic-services.service');

async function listByClinicId(req, res) {
  const data = await clinicServicesService.listByClinicId(req.params.clinicId, req.user);

  return sendSuccess(res, {
    message: 'Clinic services fetched successfully.',
    data,
  });
}

async function createService(req, res) {
  const data = await clinicServicesService.createService(
    req.params.clinicId,
    req.body,
    req.user
  );

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Clinic service created successfully.',
    data,
  });
}

async function updateService(req, res) {
  const data = await clinicServicesService.updateService(
    req.params.clinicId,
    req.params.serviceId,
    req.body,
    req.user
  );

  return sendSuccess(res, {
    message: 'Clinic service updated successfully.',
    data,
  });
}

async function archiveService(req, res) {
  const data = await clinicServicesService.archiveService(
    req.params.clinicId,
    req.params.serviceId,
    req.user
  );

  return sendSuccess(res, {
    message: 'Clinic service archived successfully.',
    data,
  });
}

module.exports = {
  listByClinicId,
  createService,
  updateService,
  archiveService,
};