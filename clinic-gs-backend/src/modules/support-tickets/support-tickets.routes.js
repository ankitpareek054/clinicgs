const express = require('express');
const asyncHandler = require('../../utils/async-handler');
const validate = require('../../middlewares/validate.middleware');
const authMiddleware = require('../../middlewares/auth.middleware');
const supportTicketsController = require('./support-tickets.controller');
const {
  ticketIdParamSchema,
  listSupportTicketsQuerySchema,
  createSupportTicketSchema,
  updateSupportTicketSchema,
} = require('./support-tickets.validators');

const router = express.Router();

router.use(authMiddleware);

router.get(
  '/',
  validate({ query: listSupportTicketsQuerySchema }),
  asyncHandler(supportTicketsController.listTickets)
);

router.get(
  '/:ticketId',
  validate({ params: ticketIdParamSchema }),
  asyncHandler(supportTicketsController.getTicketById)
);

router.post(
  '/',
  validate({ body: createSupportTicketSchema }),
  asyncHandler(supportTicketsController.createTicket)
);

router.patch(
  '/:ticketId',
  validate({
    params: ticketIdParamSchema,
    body: updateSupportTicketSchema,
  }),
  asyncHandler(supportTicketsController.updateTicket)
);

module.exports = router;