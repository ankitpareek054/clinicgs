const { sendSuccess } = require('../../utils/api-response');
const usersService = require('./users.service');

async function listUsers(req, res) {
  const data = await usersService.listUsers(req.query, req.user);

  return sendSuccess(res, {
    message: 'Users fetched successfully.',
    data,
  });
}

async function getUserById(req, res) {
  const data = await usersService.getUserById(req.params.userId, req.user);

  return sendSuccess(res, {
    message: 'User fetched successfully.',
    data,
  });
}

async function updateUserStatus(req, res) {
  const data = await usersService.updateUserStatus(req.params.userId, req.body, req.user);

  return sendSuccess(res, {
    message: 'User status updated successfully.',
    data,
  });
}

module.exports = {
  listUsers,
  getUserById,
  updateUserStatus,
};