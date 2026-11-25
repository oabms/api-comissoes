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
// A autenticação NÃO aparece aqui: o `x-api-key` é exigido no `router.use` do
// índice (src/routes/index.js), de modo que vale para todas as rotas de
// `router`, inclusive as que forem criadas depois. A exceção é `rotasFrontend`,
// no fim do arquivo, que aceita JWT.
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

// =============================================================================
// ROTAS CONSUMIDAS PELO FRONTEND (JWT)
// =============================================================================
// Router separado porque a autenticação é outra: o navegador manda o JWT do
// usuário logado (Authorization: Bearer), já que a x-api-key não pode ficar
// exposta no código do front. O índice monta este router em
// '/comissoes/ativas' com `autenticar` (JWT ou x-api-key), ANTES do router
// principal — por isso "ativas" nunca chega a ser lido como '/:id'.
// =============================================================================

const rotasFrontend = express.Router();

/**
 * GET /api/comissoes/ativas
 * Lista enxuta (id, descricao, sigla) das comissões ativas, para seletores.
 */
rotasFrontend.get(
  '/',
  asyncHandler(ComissaoController.listarAtivas)
);

module.exports = router;
module.exports.rotasFrontend = rotasFrontend;
