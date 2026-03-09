const { sendSuccess } = require('../../utils/api-response');
const supportTicketsService = require('./support-tickets.service');

async function listTickets(req, res) {
  const data = await supportTicketsService.listTickets(req.query, req.user);

  return sendSuccess(res, {
    message: 'Support tickets fetched successfully.',
    data,
  });
}

async function getTicketById(req, res) {
  const data = await supportTicketsService.getTicketById(req.params.ticketId, req.user);

  return sendSuccess(res, {
    message: 'Support ticket fetched successfully.',
    data,
  });
}

async function createTicket(req, res) {
  const data = await supportTicketsService.createTicket(req.body, req.user);

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Support ticket created successfully.',
    data,
  });
}

async function updateTicket(req, res) {
  const data = await supportTicketsService.updateTicket(req.params.ticketId, req.body, req.user);

  return sendSuccess(res, {
    message: 'Support ticket updated successfully.',
    data,
  });
}

module.exports = {
  listTickets,
  getTicketById,
  createTicket,
  updateTicket,
};