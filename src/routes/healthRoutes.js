const express = require('express');

const HealthController = require('../controllers/HealthController');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

/**
 * GET /api/health
 * Usado pelo monitoramento. Não exige autenticação.
 */
router.get('/', asyncHandler(HealthController.health));

module.exports = router;
