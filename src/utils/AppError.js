const { HTTP_STATUS, ERROR_CODES, ERROR_MESSAGES } = require('./constants');

// =============================================================================
// APP ERROR — ERROS ESPERADOS DE NEGÓCIO
// =============================================================================
// Regra do projeto:
//
//   - Erro ESPERADO (regra de negócio, entrada inválida, recurso inexistente)
//     -> `throw new AppError(...)` no SERVICE. O errorHandler devolve a mensagem
//        ao cliente, com o status e o code corretos.
//
//   - Erro INESPERADO (bug, banco fora do ar) -> deixe a exceção subir. O
//     errorHandler loga o stack e devolve 500 com mensagem genérica, sem vazar
//     detalhes de infraestrutura.
//
// O controller NÃO precisa de try/catch: o `asyncHandler` das rotas encaminha
// qualquer rejeição para o errorHandler.
// =============================================================================

class AppError extends Error {

  /**
   * @param {string} message     - Mensagem exibida ao cliente
   * @param {number} statusCode  - Status HTTP (use HTTP_STATUS)
   * @param {string} code        - Código estável para o frontend (use ERROR_CODES)
   * @param {Object} [detalhes]  - Campos extras anexados à resposta (ex: { errors: [...] })
   */
  constructor(message, statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, code = ERROR_CODES.INTERNAL_ERROR, detalhes = null) {
    super(message);

    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.detalhes = detalhes;

    // Marca o erro como previsto — o errorHandler usa isso para decidir se a
    // mensagem pode ser exibida ao cliente mesmo com status >= 500.
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  // ---------------------------------------------------------------------------
  // Atalhos para os casos mais comuns
  // ---------------------------------------------------------------------------

  static naoEncontrado(message = ERROR_MESSAGES.NOT_FOUND, code = ERROR_CODES.NOT_FOUND) {
    return new AppError(message, HTTP_STATUS.NOT_FOUND, code);
  }

  static requisicaoInvalida(message = ERROR_MESSAGES.BAD_REQUEST, code = ERROR_CODES.VALIDATION_ERROR, detalhes = null) {
    return new AppError(message, HTTP_STATUS.BAD_REQUEST, code, detalhes);
  }

  static naoAutorizado(message = ERROR_MESSAGES.UNAUTHORIZED, code = ERROR_CODES.INVALID_TOKEN) {
    return new AppError(message, HTTP_STATUS.UNAUTHORIZED, code);
  }

  static acessoNegado(message = ERROR_MESSAGES.FORBIDDEN, code = ERROR_CODES.FORBIDDEN) {
    return new AppError(message, HTTP_STATUS.FORBIDDEN, code);
  }

  static conflito(message = ERROR_MESSAGES.CONFLICT, code = ERROR_CODES.CONFLICT) {
    return new AppError(message, HTTP_STATUS.CONFLICT, code);
  }

}

module.exports = AppError;
