const { sendSuccess } = require('../../utils/api-response');
const dashboardsService = require('./dashboards.service');

async function getSuperAdminDashboard(req, res) {
  const data = await dashboardsService.getSuperAdminDashboard(req.user);

  return sendSuccess(res, {
    message: 'Super admin dashboard fetched successfully.',
    data,
  });
}

async function getClinicDashboard(req, res) {
  const data = await dashboardsService.getClinicDashboard(req.user);

  return sendSuccess(res, {
    message: 'Clinic dashboard fetched successfully.',
    data,
  });
}

module.exports = {
  getSuperAdminDashboard,
  getClinicDashboard,
};