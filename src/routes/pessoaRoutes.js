const express = require('express');

const PessoaController = require('../controllers/PessoaController');
const PessoaValidator = require('../validators/pessoaValidator');

const validate = require('../middlewares/validate');
const asyncHandler = require('../utils/asyncHandler');

// =============================================================================
// ROTAS DO MÓDULO PESSOA
// =============================================================================
// A visão "por pessoa" dos vínculos de comissão, com duas formas de identificar
// a pessoa: pelo ID do cadastro ou pelo número de inscrição na OAB.
//
// A rota de OAB é declarada primeiro por clareza; as duas não competem entre si
// porque têm número de segmentos diferente ('/oab/29739/comissoes' contra
// '/79394/comissoes').
//
// A autenticação por `x-api-key` é exigida no `router.use` do índice
// (src/routes/index.js) e vale para todas as rotas deste arquivo.
// =============================================================================

const router = express.Router();

/**
 * GET /api/pessoas/oab/:registro/comissoes
 */
router.get(
  '/oab/:registro/comissoes',
  PessoaValidator.listarComissoesPorOab(),
  validate,
  asyncHandler(PessoaController.listarComissoesPorOab)
);

/**
 * GET /api/pessoas/:id/comissoes
 */
router.get(
  '/:id/comissoes',
  PessoaValidator.listarComissoes(),
  validate,
  asyncHandler(PessoaController.listarComissoes)
);

module.exports = router;
