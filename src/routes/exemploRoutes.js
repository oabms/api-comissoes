const express = require('express');

const ExemploController = require('../controllers/ExemploController');
const ExemploValidator = require('../validators/exemploValidator');

const validate = require('../middlewares/validate');
const { autenticar } = require('../middlewares/authMiddleware');
const asyncHandler = require('../utils/asyncHandler');

// =============================================================================
// ROTAS DO MÓDULO EXEMPLO
// =============================================================================
// A ordem dos middlewares em cada rota é sempre a mesma:
//
//   [autenticar] -> [regras do validator] -> validate -> asyncHandler(controller)
//
// `asyncHandler` é OBRIGATÓRIO em handlers async — sem ele, um erro dentro do
// controller não chega ao errorHandler e a requisição fica pendurada.
// =============================================================================

const router = express.Router();

/**
 * GET /api/exemplos
 * Rota pública e paginada.
 */
router.get(
  '/',
  ExemploValidator.listar(),
  validate,
  asyncHandler(ExemploController.listar)
);

/**
 * GET /api/exemplos/:id
 */
router.get(
  '/:id',
  ExemploValidator.buscarPorId(),
  validate,
  asyncHandler(ExemploController.buscarPorId)
);

/**
 * POST /api/exemplos
 * Rota de escrita — exige JWT ou API Key.
 */
router.post(
  '/',
  autenticar,
  ExemploValidator.criar(),
  validate,
  asyncHandler(ExemploController.criar)
);

module.exports = router;
