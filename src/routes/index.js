const express = require('express');

const env = require('../config/env');

const { autenticarApiKey } = require('../middlewares/authMiddleware');

const healthRoutes = require('./healthRoutes');
const comissaoRoutes = require('./comissaoRoutes');
const pessoaRoutes = require('./pessoaRoutes');

// =============================================================================
// ÍNDICE DE ROTAS
// =============================================================================
// Ponto único de registro dos módulos. Ao criar um módulo novo, adicione duas
// linhas aqui (o `require` e o `router.use`) e documente o endpoint no objeto
// `ENDPOINTS` abaixo.
//
// AUTENTICAÇÃO: as rotas de dados exigem o header `x-api-key` com uma das
// chaves de ALLOWED_API_KEYS. O middleware é aplicado AQUI, no `router.use` de
// cada módulo, e não rota a rota — assim uma rota nova já nasce protegida.
//
// Ficam abertas apenas /api (catálogo de endpoints) e /api/health, que não
// devolvem dado de pessoa e são o que o monitoramento consulta.
// =============================================================================

const router = express.Router();

/**
 * Catálogo de endpoints devolvido em GET /api — serve como documentação viva
 * e é a primeira coisa consultada por quem vai integrar com a API.
 * Mantenha atualizado ao criar rotas.
 *
 * Os endpoints marcados com [auth] exigem o header `x-api-key`.
 */
const ENDPOINTS = {
  health: {
    'GET /api/health': 'Status da API e do banco de dados'
  },
  comissoes: {
    'GET /api/comissoes': '[auth] Catálogo de comissões (?q=&page=&limit=)',
    'GET /api/comissoes/:id': '[auth] Detalhe de uma comissão',
    'GET /api/comissoes/:id/membros': '[auth] Membros da comissão (?vigentes=&cargo=&q=&page=&limit=)'
  },
  pessoas: {
    'GET /api/pessoas/oab/:registro/comissoes': '[auth] Comissões da pessoa pelo número da OAB (?vigentes=)',
    'GET /api/pessoas/:id/comissoes': '[auth] Comissões da pessoa pelo ID do cadastro (?vigentes=)'
  }
};

router.use('/health', healthRoutes);
router.use('/comissoes', autenticarApiKey, comissaoRoutes);
router.use('/pessoas', autenticarApiKey, pessoaRoutes);

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
