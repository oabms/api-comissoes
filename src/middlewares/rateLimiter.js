const rateLimit = require('express-rate-limit');

const env = require('../config/env');
const { HTTP_STATUS, ERROR_MESSAGES, ERROR_CODES } = require('../utils/constants');

// =============================================================================
// RATE LIMIT (por IP)
// =============================================================================
// O limitador global protege a API de abuso genérico. Rotas sensíveis (login,
// consultas que permitem enumerar dados pessoais, envio de e-mail) devem ganhar
// um limitador próprio e mais restrito, criado com `criarLimitador`.
//
// ATENÇÃO em produção: rodando atrás de Nginx/IIS, é preciso configurar
// `app.set('trust proxy', 1)` (já feito em src/app.js), senão TODAS as
// requisições chegam com o IP do proxy e um único cliente derruba o limite para
// todo mundo.
// =============================================================================

/**
 * Fábrica de limitadores.
 *
 * @param {Object} opcoes
 * @param {number} opcoes.janelaMs - Tamanho da janela em milissegundos
 * @param {number} opcoes.maximo   - Requisições permitidas por IP na janela
 * @param {string} [opcoes.code]   - Código devolvido no corpo da resposta
 * @param {string} [opcoes.message]
 */
const criarLimitador = ({
  janelaMs,
  maximo,
  code = ERROR_CODES.TOO_MANY_REQUESTS,
  message = ERROR_MESSAGES.TOO_MANY_REQUESTS
}) => rateLimit({
  windowMs: janelaMs,
  max: maximo,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
  message: {
    success: false,
    message,
    code
  }
});

/**
 * Limitador global aplicado a todas as rotas em src/app.js.
 */
const limitadorGlobal = criarLimitador({
  janelaMs: env.rateLimit.janelaMs,
  maximo: env.rateLimit.maximo
});

/**
 * Exemplo de limitador restrito, para rotas que expõem dados pessoais e podem
 * ser usadas para enumeração (ex: buscar advogado por CPF/OAB).
 * Aplique diretamente na rota:
 *
 *   router.get('/busca', limitadorConsultaSensivel, asyncHandler(...));
 */
const limitadorConsultaSensivel = criarLimitador({
  janelaMs: 15 * 60 * 1000,
  maximo: 20,
  message: 'Muitas consultas em sequência. Tente novamente mais tarde.'
});

module.exports = {
  criarLimitador,
  limitadorGlobal,
  limitadorConsultaSensivel
};
