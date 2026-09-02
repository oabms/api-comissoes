const express = require('express');

const env = require('../config/env');

const healthRoutes = require('./healthRoutes');
const comissaoRoutes = require('./comissaoRoutes');
const pessoaRoutes = require('./pessoaRoutes');

// =============================================================================
// ÍNDICE DE ROTAS
// =============================================================================
// Ponto único de registro dos módulos. Ao criar um módulo novo, adicione duas
// linhas aqui (o `require` e o `router.use`) e documente o endpoint no objeto
// `ENDPOINTS` abaixo.
// =============================================================================

const router = express.Router();

/**
 * Catálogo de endpoints devolvido em GET /api — serve como documentação viva
 * e é a primeira coisa consultada por quem vai integrar com a API.
 * Mantenha atualizado ao criar rotas.
 */
const ENDPOINTS = {
  health: {
    'GET /api/health': 'Status da API e do banco de dados'
  },
  comissoes: {
    'GET /api/comissoes': 'Catálogo de comissões (?q=&page=&limit=)',
    'GET /api/comissoes/:id': 'Detalhe de uma comissão',
    'GET /api/comissoes/:id/membros': 'Membros da comissão (?vigentes=&cargo=&q=&page=&limit=)'
  },
  pessoas: {
    'GET /api/pessoas/oab/:registro/comissoes': 'Comissões da pessoa pelo número da OAB (?vigentes=)',
    'GET /api/pessoas/:id/comissoes': 'Comissões da pessoa pelo ID do cadastro (?vigentes=)'
  }
};

router.use('/health', healthRoutes);
router.use('/comissoes', comissaoRoutes);
router.use('/pessoas', pessoaRoutes);

router.get('/', (req, res) => {
  res.json({
    success: true,
    api: env.nomeApi,
    versao: env.versaoApi,
    ambiente: env.nodeEnv,
    endpoints: ENDPOINTS,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
module.exports.ENDPOINTS = ENDPOINTS;
