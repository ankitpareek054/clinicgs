const express = require('express');
const asyncHandler = require('../../utils/async-handler');
const validate = require('../../middlewares/validate.middleware');
const authMiddleware = require('../../middlewares/auth.middleware');
const appointmentsController = require('./appointments.controller');
const {
  appointmentIdParamSchema,
  listAppointmentsQuerySchema,
  createAppointmentSchema,
  updateAppointmentSchema,
} = require('./appointments.validators');

const router = express.Router();

router.use(authMiddleware);

router.get(
  '/',
  validate({ query: listAppointmentsQuerySchema }),
  asyncHandler(appointmentsController.listAppointments)
);

router.post(
  '/',
  validate({ body: createAppointmentSchema }),
  asyncHandler(appointmentsController.createAppointment)
);

router.patch(
  '/:appointmentId',
  validate({
    params: appointmentIdParamSchema,
    body: updateAppointmentSchema,
  }),
  asyncHandler(appointmentsController.updateAppointment)
);

module.exports = router;