const { sendSuccess } = require('../../utils/api-response');
const leadsService = require('./leads.service');

async function listLeads(req, res) {
  const data = await leadsService.listLeads(req.query, req.user);

  return sendSuccess(res, {
    message: 'Leads fetched successfully.',
    data,
  });
}

async function getLeadById(req, res) {
  const data = await leadsService.getLeadById(req.params.leadId, req.user);

  return sendSuccess(res, {
    message: 'Lead fetched successfully.',
    data,
  });
}

async function createLead(req, res) {
  const data = await leadsService.createLead(req.body, req.user);

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Lead created successfully.',
    data,
  });
}

async function updateLead(req, res) {
  const data = await leadsService.updateLead(req.params.leadId, req.body, req.user);

  return sendSuccess(res, {
    message: 'Lead updated successfully.',
    data,
  });
}

async function assignLeadToSelf(req, res) {
  const data = await leadsService.assignLeadToSelf(req.params.leadId, req.user);

  return sendSuccess(res, {
    message: 'Lead assigned to self successfully.',
    data,
  });
}

async function unassignLeadFromSelf(req, res) {
  const data = await leadsService.unassignLeadFromSelf(req.params.leadId, req.user);

  return sendSuccess(res, {
    message: 'Lead unassigned successfully.',
    data,
  });
}

async function reassignLead(req, res) {
  const data = await leadsService.reassignLead(req.params.leadId, req.body, req.user);

  return sendSuccess(res, {
    message: 'Lead reassigned successfully.',
    data,
  });
}

async function archiveLead(req, res) {
  const data = await leadsService.archiveLead(req.params.leadId, req.body, req.user);

  return sendSuccess(res, {
    message: 'Lead archived successfully.',
    data,
  });
}

async function unarchiveLead(req, res) {
  const data = await leadsService.unarchiveLead(req.params.leadId, req.user);

  return sendSuccess(res, {
    message: 'Lead unarchived successfully.',
    data,
  });
}

async function listDuplicateWarnings(req, res) {
  const data = await leadsService.listDuplicateWarnings(req.query, req.user);

  return sendSuccess(res, {
    message: 'Duplicate review groups fetched successfully.',
    data,
  });
}

module.exports = {
  listLeads,
  getLeadById,
  createLead,
  updateLead,
  assignLeadToSelf,
  unassignLeadFromSelf,
  reassignLead,
  archiveLead,
  unarchiveLead,
  listDuplicateWarnings,
};