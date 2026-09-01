const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const env = require('./config/env');
const logger = require('./config/logger');

const routes = require('./routes');
const requestLogger = require('./middlewares/requestLogger');
const { limitadorGlobal } = require('./middlewares/rateLimiter');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');

// =============================================================================
// APLICAÇÃO EXPRESS
// =============================================================================
// A montagem do app fica separada do `listen` (server.js) para que a aplicação
// possa ser importada em testes sem subir uma porta.
//
// A ORDEM dos middlewares importa e é sempre esta:
//
//   1. Segurança (helmet, cors)
//   2. Parsers (json, urlencoded)
//   3. Observabilidade (requestLogger)
//   4. Rate limit
//   5. Rotas
//   6. notFound
//   7. errorHandler   <- sempre por último
// =============================================================================

const app = express();

// -----------------------------------------------------------------------------
// 1. Segurança
// -----------------------------------------------------------------------------

// Necessário atrás de Nginx/IIS: sem isso `req.ip` devolve o IP do proxy, o que
// quebra tanto o rate limit quanto os logs de auditoria.
app.set('trust proxy', 1);

// Não anunciar que é Express.
app.disable('x-powered-by');

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS_ORIGINS vazio libera qualquer origem — aceitável em homologação e em
// APIs públicas de leitura; em produção, liste os domínios do portal.
app.use(cors({
  origin: env.corsOrigins.length ? env.corsOrigins : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));

// -----------------------------------------------------------------------------
// 2. Parsers
// -----------------------------------------------------------------------------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// -----------------------------------------------------------------------------
// 3. Observabilidade
// -----------------------------------------------------------------------------
app.use(requestLogger);

// -----------------------------------------------------------------------------
// 4. Rate limit
// -----------------------------------------------------------------------------
app.use(limitadorGlobal);

// -----------------------------------------------------------------------------
// 5. Rotas
// -----------------------------------------------------------------------------
app.get('/', (req, res) => {
  res.json({
    success: true,
    api: env.nomeApi,
    versao: env.versaoApi,
    status: 'online',
    documentacao: `${env.prefixoApi}`,
    timestamp: new Date().toISOString()
  });
});

app.use(env.prefixoApi, routes);

// -----------------------------------------------------------------------------
// 6 e 7. Rota inexistente e tratamento de erros
// -----------------------------------------------------------------------------
app.use(notFound);
app.use(errorHandler);

logger.debug('Aplicação Express montada');

module.exports = app;
