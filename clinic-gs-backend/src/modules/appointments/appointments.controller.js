const { sendSuccess } = require('../../utils/api-response');
const appointmentsService = require('./appointments.service');

async function listAppointments(req, res) {
  const data = await appointmentsService.listAppointments(req.query, req.user);

  return sendSuccess(res, {
    message: 'Appointments fetched successfully.',
    data,
  });
}

async function createAppointment(req, res) {
  const data = await appointmentsService.createAppointment(req.body, req.user);

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Appointment created successfully.',
    data,
  });
}

async function updateAppointment(req, res) {
  const data = await appointmentsService.updateAppointment(
    req.params.appointmentId,
    req.body,
    req.user
  );

  return sendSuccess(res, {
    message: 'Appointment updated successfully.',
    data,
  });
}

module.exports = {
  listAppointments,
  createAppointment,
  updateAppointment,
};