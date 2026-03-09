const { sendSuccess } = require('../../utils/api-response');
const followupsService = require('./followups.service');

async function listFollowups(req, res) {
  const data = await followupsService.listFollowups(req.query, req.user);

  return sendSuccess(res, {
    message: 'Follow-ups fetched successfully.',
    data,
  });
}

async function createFollowup(req, res) {
  const data = await followupsService.createFollowup(req.body, req.user);

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Follow-up created successfully.',
    data,
  });
}

async function updateFollowup(req, res) {
  const data = await followupsService.updateFollowup(req.params.followupId, req.body, req.user);

  return sendSuccess(res, {
    message: 'Follow-up updated successfully.',
    data,
  });
}

async function updateFollowupStatus(req, res) {
  const data = await followupsService.updateFollowupStatus(
    req.params.followupId,
    req.body,
    req.user
  );

  return sendSuccess(res, {
    message: 'Follow-up status updated successfully.',
    data,
  });
}

module.exports = {
  listFollowups,
  createFollowup,
  updateFollowup,
  updateFollowupStatus,
};