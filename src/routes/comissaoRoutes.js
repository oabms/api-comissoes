const express = require('express');

const ComissaoController = require('../controllers/ComissaoController');
const ComissaoValidator = require('../validators/comissaoValidator');

const validate = require('../middlewares/validate');
const asyncHandler = require('../utils/asyncHandler');

// =============================================================================
// ROTAS DO MÓDULO COMISSÃO
// =============================================================================
// Ordem dos middlewares: [regras do validator] -> validate -> asyncHandler.
//
// Todas as rotas são públicas e de leitura. Se um dia a API passar a exigir
// token, basta acrescentar `autenticar` antes do validator em cada rota
// (src/middlewares/authMiddleware.js).
// =============================================================================

const router = express.Router();

/**
 * GET /api/comissoes
 * Catálogo de comissões, paginado, com busca por trecho da descrição.
 */
router.get(
  '/',
  ComissaoValidator.listar(),
  validate,
  asyncHandler(ComissaoController.listar)
);

/**
 * GET /api/comissoes/:id/membros
 * Declarada ANTES de '/:id' por clareza de leitura — as duas têm número de
 * segmentos diferente, então não competem entre si.
 */
router.get(
  '/:id/membros',
  ComissaoValidator.listarMembros(),
  validate,
  asyncHandler(ComissaoController.listarMembros)
);

/**
 * GET /api/comissoes/:id
 */
router.get(
  '/:id',
  ComissaoValidator.buscarPorId(),
  validate,
  asyncHandler(ComissaoController.buscarPorId)
);

module.exports = router;
