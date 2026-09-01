const { validationResult } = require('express-validator');

const Response = require('../utils/Response');
const { ERROR_MESSAGES } = require('../utils/constants');

// =============================================================================
// VALIDATE — COLETOR DE ERROS DO EXPRESS-VALIDATOR
// =============================================================================
// As regras ficam nos validators de cada módulo (src/validators/). Este
// middleware entra DEPOIS das regras na cadeia da rota e interrompe a
// requisição se alguma falhar:
//
//   router.get(
//     '/:id',
//     ComissaoValidator.buscarPorId(),   // regras
//     validate,                          // coletor
//     asyncHandler(ComissaoController.buscarPorId)
//   );
//
// Antes existia um `validarRequisicao` duplicado dentro de cada validator;
// aqui ele é único e importado por todas as rotas.
// =============================================================================

module.exports = (req, res, next) => {
  const erros = validationResult(req);

  if (erros.isEmpty()) {
    return next();
  }

  const detalhes = erros.array().map(erro => ({
    campo: erro.path || erro.param,
    valor: erro.value,
    mensagem: erro.msg,
    local: erro.location
  }));

  return Response.badRequest(res, ERROR_MESSAGES.VALIDATION_ERROR, detalhes);
};
