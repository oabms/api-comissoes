const express = require('express');

const env = require('../config/env');

const healthRoutes = require('./healthRoutes');
const exemploRoutes = require('./exemploRoutes');

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
  exemplos: {
    'GET  /api/exemplos': 'Lista paginada (?q=&ativos=&page=&limit=)',
    'GET  /api/exemplos/:id': 'Detalhe de um registro',
    'POST /api/exemplos': 'Cria um registro (requer autenticação)'
  }
};

router.use('/health', healthRoutes);
router.use('/exemplos', exemploRoutes);

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
