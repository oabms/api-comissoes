const logger = require('../config/logger');
const Response = require('../utils/Response');
const { ERROR_MESSAGES, ERROR_CODES } = require('../utils/constants');

// =============================================================================
// NOT FOUND — ROTA INEXISTENTE
// =============================================================================
// Registrado DEPOIS de todas as rotas e ANTES do errorHandler. Garante que uma
// URL errada devolva o JSON padrão da API em vez do HTML de erro do Express.
// =============================================================================

module.exports = (req, res) => {
  logger.warn(`Endpoint não encontrado: ${req.method} ${req.originalUrl}`, {
    ip: (req.ip || '').replace('::ffff:', '')
  });

  return Response.notFound(
    res,
    ERROR_MESSAGES.ROUTE_NOT_FOUND,
    ERROR_CODES.ROUTE_NOT_FOUND
  );
};
