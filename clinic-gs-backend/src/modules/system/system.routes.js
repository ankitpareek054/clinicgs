const express = require('express');
const asyncHandler = require('../../utils/async-handler');
const systemController = require('./system.controller');

const router = express.Router();

router.get('/health', asyncHandler(systemController.health));
router.get('/db-health', asyncHandler(systemController.dbHealth));

module.exports = router;