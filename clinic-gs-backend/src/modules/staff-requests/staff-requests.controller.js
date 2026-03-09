const { sendSuccess } = require('../../utils/api-response');
const staffRequestsService = require('./staff-requests.service');

async function listRequests(req, res) {
  const data = await staffRequestsService.listRequests(req.query, req.user);

  return sendSuccess(res, {
    message: 'Staff requests fetched successfully.',
    data,
  });
}

async function createRequest(req, res) {
  const data = await staffRequestsService.createRequest(req.body, req.user);

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Staff request created successfully.',
    data,
  });
}

async function decideRequest(req, res) {
  const data = await staffRequestsService.decideRequest(
    req.params.requestId,
    req.body,
    req.user
  );

  return sendSuccess(res, {
    message: 'Staff request decision saved successfully.',
    data,
  });
}

module.exports = {
  listRequests,
  createRequest,
  decideRequest,
};