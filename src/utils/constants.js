// =============================================================================
// CONSTANTES TRANSVERSAIS DA API
// =============================================================================
// Constantes de NEGÓCIO (códigos de situação, IDs de departamento, etc.) NÃO
// vão aqui — cada módulo tem o seu próprio arquivo em
// src/services/<modulo>/constants/.
// =============================================================================

const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
};

const ERROR_MESSAGES = {
  INTERNAL_ERROR: 'Erro interno do servidor.',
  NOT_FOUND: 'Recurso não encontrado.',
  ROUTE_NOT_FOUND: 'Endpoint não encontrado.',
  UNAUTHORIZED: 'Não autorizado.',
  FORBIDDEN: 'Acesso negado.',
  BAD_REQUEST: 'Requisição inválida.',
  VALIDATION_ERROR: 'Erro de validação.',
  CONFLICT: 'Conflito de dados.',
  SERVICE_UNAVAILABLE: 'Serviço temporariamente indisponível.',
  TOO_MANY_REQUESTS: 'Muitas requisições. Tente novamente mais tarde.'
};

/**
 * Códigos de erro devolvidos no campo `code` da resposta.
 * O frontend deve reagir a ESTES valores, nunca ao texto da mensagem.
 */
const ERROR_CODES = {
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NO_TOKEN: 'NO_TOKEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  EXPIRED_TOKEN: 'EXPIRED_TOKEN',
  INVALID_API_KEY: 'INVALID_API_KEY',
  AUTH_NOT_CONFIGURED: 'AUTH_NOT_CONFIGURED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS'
};

/**
 * Limites padrão de paginação (ver src/utils/pagination.js).
 */
const PAGINACAO = {
  PAGINA_PADRAO: 1,
  LIMITE_PADRAO: 20,
  LIMITE_MAXIMO: 100
};

module.exports = {
  HTTP_STATUS,
  ERROR_MESSAGES,
  ERROR_CODES,
  PAGINACAO
};
