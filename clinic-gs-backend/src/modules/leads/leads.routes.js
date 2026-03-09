const express = require('express');
const asyncHandler = require('../../utils/async-handler');
const validate = require('../../middlewares/validate.middleware');
const authMiddleware = require('../../middlewares/auth.middleware');
const leadsController = require('./leads.controller');
const {
  leadIdParamSchema,
  listLeadsQuerySchema,
  createLeadSchema,
  updateLeadSchema,
  reassignLeadSchema,
  archiveLeadSchema,
  duplicateWarningsQuerySchema,
} = require('./leads.validators');

const router = express.Router();

router.use(authMiddleware);

router.get(
  '/duplicates',
  validate({ query: duplicateWarningsQuerySchema }),
  asyncHandler(leadsController.listDuplicateWarnings)
);

router.get(
  '/',
  validate({ query: listLeadsQuerySchema }),
  asyncHandler(leadsController.listLeads)
);

router.get(
  '/:leadId',
  validate({ params: leadIdParamSchema }),
  asyncHandler(leadsController.getLeadById)
);

router.post(
  '/',
  validate({ body: createLeadSchema }),
  asyncHandler(leadsController.createLead)
);

router.patch(
  '/:leadId',
  validate({
    params: leadIdParamSchema,
    body: updateLeadSchema,
  }),
  asyncHandler(leadsController.updateLead)
);

router.post(
  '/:leadId/assign-self',
  validate({ params: leadIdParamSchema }),
  asyncHandler(leadsController.assignLeadToSelf)
);

router.post(
  '/:leadId/unassign-self',
  validate({ params: leadIdParamSchema }),
  asyncHandler(leadsController.unassignLeadFromSelf)
);

router.post(
  '/:leadId/reassign',
  validate({
    params: leadIdParamSchema,
    body: reassignLeadSchema,
  }),
  asyncHandler(leadsController.reassignLead)
);

router.post(
  '/:leadId/archive',
  validate({
    params: leadIdParamSchema,
    body: archiveLeadSchema,
  }),
  asyncHandler(leadsController.archiveLead)
);

router.post(
  '/:leadId/unarchive',
  validate({ params: leadIdParamSchema }),
  asyncHandler(leadsController.unarchiveLead)
);

module.exports = router;