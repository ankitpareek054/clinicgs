const { sendSuccess } = require('../../utils/api-response');
const messagesService = require('./messages.service');

async function listMessageLogs(req, res) {
  const data = await messagesService.listMessageLogs(req.query, req.user);

  return sendSuccess(res, {
    message: 'Message logs fetched successfully.',
    data,
  });
}

async function getMessageLogById(req, res) {
  const data = await messagesService.getMessageLogById(req.params.messageLogId, req.user);

  return sendSuccess(res, {
    message: 'Message log fetched successfully.',
    data,
  });
}

async function createMessageLog(req, res) {
  const data = await messagesService.createMessageLog(req.body, req.user);

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Message log created successfully.',
    data,
  });
}

module.exports = {
  listMessageLogs,
  getMessageLogById,
  createMessageLog,
};