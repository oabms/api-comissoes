const { HTTP_STATUS, ERROR_MESSAGES, ERROR_CODES } = require('./constants');

// =============================================================================
// RESPONSE — CONTRATO ÚNICO DE RESPOSTA DA API
// =============================================================================
// Toda resposta desta API (e das outras APIs da OAB/MS) tem o mesmo formato,
// para que o frontend possa tratar sucesso e erro de forma genérica.
//
// Sucesso:
//   {
//     "success": true,
//     "message": "Comissões encontradas.",
//     "data": [ ... ],
//     "timestamp": "2026-09-01T12:00:00.000Z"
//   }
//
// Erro:
//   {
//     "success": false,
//     "message": "Comissão não encontrada.",
//     "code": "NOT_FOUND",
//     "timestamp": "2026-09-01T12:00:00.000Z"
//   }
//
// Listas paginadas ganham ainda o bloco `meta` (ver `paginado`).
// =============================================================================

class Response {

  // ---------------------------------------------------------------------------
  // SUCESSO
  // ---------------------------------------------------------------------------

  /**
   * 200 OK
   */
  static success(res, data = null, message = 'Operação realizada com sucesso.') {
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 200 OK com metadados de paginação.
   *
   * @param {Object} resultado - Saída de `montarResultadoPaginado` (src/utils/pagination.js)
   */
  static paginado(res, resultado, message = 'Registros encontrados.') {
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message,
      data: resultado.data,
      meta: resultado.meta,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 201 Created
   */
  static created(res, data = null, message = 'Registro criado com sucesso.') {
    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 204 No Content — sem corpo (ex: DELETE bem-sucedido).
   */
  static noContent(res) {
    return res.status(HTTP_STATUS.NO_CONTENT).send();
  }

  // ---------------------------------------------------------------------------
  // ERRO
  // ---------------------------------------------------------------------------

  /**
   * Erro genérico. Prefira os atalhos abaixo quando existir um.
   */
  static error(
    res,
    message = ERROR_MESSAGES.INTERNAL_ERROR,
    statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code = ERROR_CODES.INTERNAL_ERROR,
    extras = null
  ) {
    return res.status(statusCode).json({
      success: false,
      message,
      code,
      ...(extras || {}),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 400 Bad Request — `errors` recebe o array do express-validator.
   */
  static badRequest(res, message = ERROR_MESSAGES.VALIDATION_ERROR, errors = null, code = ERROR_CODES.VALIDATION_ERROR) {
    return Response.error(
      res,
      message,
      HTTP_STATUS.BAD_REQUEST,
      code,
      errors ? { errors } : null
    );
  }

  /**
   * 401 Unauthorized
   */
  static unauthorized(res, message = ERROR_MESSAGES.UNAUTHORIZED, code = ERROR_CODES.INVALID_TOKEN) {
    return Response.error(res, message, HTTP_STATUS.UNAUTHORIZED, code);
  }

  /**
   * 403 Forbidden
   */
  static forbidden(res, message = ERROR_MESSAGES.FORBIDDEN, code = ERROR_CODES.FORBIDDEN) {
    return Response.error(res, message, HTTP_STATUS.FORBIDDEN, code);
  }

  /**
   * 404 Not Found
   */
  static notFound(res, message = ERROR_MESSAGES.NOT_FOUND, code = ERROR_CODES.NOT_FOUND) {
    return Response.error(res, message, HTTP_STATUS.NOT_FOUND, code);
  }

  /**
   * 409 Conflict
   */
  static conflict(res, message = ERROR_MESSAGES.CONFLICT, code = ERROR_CODES.CONFLICT) {
    return Response.error(res, message, HTTP_STATUS.CONFLICT, code);
  }

}

module.exports = Response;
