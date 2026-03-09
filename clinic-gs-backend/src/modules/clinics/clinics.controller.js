const { sendSuccess } = require('../../utils/api-response');
const clinicsService = require('./clinics.service');

async function listClinics(req, res) {
  const data = await clinicsService.listClinics(req.query, req.user);

  return sendSuccess(res, {
    message: 'Clinics fetched successfully.',
    data,
  });
}

async function getClinicById(req, res) {
  const data = await clinicsService.getClinicById(req.params.clinicId, req.user);

  return sendSuccess(res, {
    message: 'Clinic fetched successfully.',
    data,
  });
}

async function createClinic(req, res) {
  const data = await clinicsService.createClinic(req.body, req.user);

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Clinic created successfully.',
    data,
  });
}

async function updateClinicProfile(req, res) {
  const data = await clinicsService.updateClinicProfile(
    req.params.clinicId,
    req.body,
    req.user
  );

  return sendSuccess(res, {
    message: 'Clinic profile updated successfully.',
    data,
  });
}

async function updateClinicStatus(req, res) {
  const data = await clinicsService.updateClinicStatus(
    req.params.clinicId,
    req.body.status,
    req.user
  );

  return sendSuccess(res, {
    message: 'Clinic status updated successfully.',
    data,
  });
}

module.exports = {
  listClinics,
  getClinicById,
  createClinic,
  updateClinicProfile,
  updateClinicStatus,
};