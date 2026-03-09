const express = require('express');
const asyncHandler = require('../../utils/async-handler');
const validate = require('../../middlewares/validate.middleware');
const authMiddleware = require('../../middlewares/auth.middleware');
const usersController = require('./users.controller');
const {
  userIdParamSchema,
  listUsersQuerySchema,
  updateUserStatusSchema,
} = require('./users.validators');

const router = express.Router();

router.use(authMiddleware);

router.get(
  '/',
  validate({ query: listUsersQuerySchema }),
  asyncHandler(usersController.listUsers)
);

router.get(
  '/:userId',
  validate({ params: userIdParamSchema }),
  asyncHandler(usersController.getUserById)
);

router.patch(
  '/:userId/status',
  validate({
    params: userIdParamSchema,
    body: updateUserStatusSchema,
  }),
  asyncHandler(usersController.updateUserStatus)
);

module.exports = router;