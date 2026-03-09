const express = require('express');
const asyncHandler = require('../../utils/async-handler');
const validate = require('../../middlewares/validate.middleware');
const authMiddleware = require('../../middlewares/auth.middleware');
const messagesController = require('./messages.controller');
const {
  messageLogIdParamSchema,
  listMessagesQuerySchema,
  createMessageLogSchema,
} = require('./messages.validators');

const router = express.Router();

router.use(authMiddleware);

router.get(
  '/',
  validate({ query: listMessagesQuerySchema }),
  asyncHandler(messagesController.listMessageLogs)
);

router.get(
  '/:messageLogId',
  validate({ params: messageLogIdParamSchema }),
  asyncHandler(messagesController.getMessageLogById)
);

router.post(
  '/',
  validate({ body: createMessageLogSchema }),
  asyncHandler(messagesController.createMessageLog)
);

module.exports = router;