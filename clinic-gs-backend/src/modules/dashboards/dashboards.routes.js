const express = require('express');
const asyncHandler = require('../../utils/async-handler');
const authMiddleware = require('../../middlewares/auth.middleware');
const dashboardsController = require('./dashboards.controller');

const router = express.Router();

router.use(authMiddleware);

router.get(
  '/super-admin',
  asyncHandler(dashboardsController.getSuperAdminDashboard)
);

router.get(
  '/clinic',
  asyncHandler(dashboardsController.getClinicDashboard)
);

module.exports = router;