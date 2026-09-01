const logger = require('../config/logger');

// =============================================================================
// REQUEST LOGGER
// =============================================================================
// Registra UMA linha por requisição, no encerramento da resposta — assim o log
// já traz o status e o tempo total:
//
//   [2026-09-01 09:31:04] INFO - GET /api/comissoes | 200 | 42ms {"ip":"10.0.0.1"}
//
// O nível acompanha o status: 5xx -> error, 4xx -> warn, resto -> info. Isso faz
// com que o arquivo logs/error/ contenha só o que realmente precisa de atenção.
// =============================================================================

// Rotas ruidosas que não agregam ao log (health check batido pelo monitoramento
// a cada poucos segundos). Ajuste conforme a necessidade da API.
const ROTAS_IGNORADAS = ['/api/health'];

module.exports = (req, res, next) => {
  if (ROTAS_IGNORADAS.includes(req.originalUrl)) {
    return next();
  }

  const inicio = Date.now();
  const ip = (req.ip || 'desconhecido').replace('::ffff:', '');

  res.on('finish', () => {
    const duracao = Date.now() - inicio;

    const mensagem =
      `${req.method} ${req.originalUrl} | ${res.statusCode} | ${duracao}ms`;

    const meta = {
      ip,
      userAgent: req.get('user-agent') || null
    };

    if (res.statusCode >= 500) {
      logger.error(mensagem, meta);
    } else if (res.statusCode >= 400) {
      logger.warn(mensagem, meta);
    } else {
      logger.info(mensagem, meta);
    }
  });

  return next();
};
