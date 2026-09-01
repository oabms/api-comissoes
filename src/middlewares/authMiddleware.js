const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const env = require('../config/env');
const logger = require('../config/logger');
const Response = require('../utils/Response');
const { ERROR_CODES } = require('../utils/constants');

// =============================================================================
// AUTENTICAÇÃO
// =============================================================================
// Duas formas aceitas, na ordem:
//
//   1. JWT (chamadas do frontend)
//      Header: Authorization: Bearer <token>
//      O token é emitido pela api-register-login e assinado em HS256 com o
//      JWT_SECRET. O secret DEVE ser idêntico ao dela, senão todo token é
//      rejeitado com 401.
//
//   2. API Key (chamadas server-to-server entre APIs internas)
//      Header: x-api-key: <chave>
//      A chave precisa constar em ALLOWED_API_KEYS.
//
// Uso nas rotas:
//   router.get('/', autenticar, asyncHandler(Controller.listar));       // exige credencial
//   router.get('/', autenticarOpcional, asyncHandler(Controller.listar)); // usa se houver
// =============================================================================

/**
 * Compara duas strings em tempo constante.
 * `includes` em array vaza, pelo tempo de resposta, quantos caracteres iniciais
 * da chave estão corretos — o que permite descobri-la byte a byte.
 */
const compararSeguro = (a, b) => {
  const bufferA = Buffer.from(String(a));
  const bufferB = Buffer.from(String(b));

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
};

/**
 * Extrai o token do header `Authorization: Bearer <token>`.
 * @returns {string|null}
 */
const extrairToken = (authHeader) => {
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }

  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice(7).trim() || null;
};

/**
 * Tenta autenticar a requisição.
 *
 * @returns {{ ok: true, tipo: string } | { ok: false, message: string, code: string, status?: number }}
 */
const tentarAutenticar = (req) => {
  // ---------------------------------------------------------------------------
  // 1. JWT
  // ---------------------------------------------------------------------------
  const token = extrairToken(
    req.headers.authorization || req.headers.Authorization
  );

  if (token) {
    if (!env.jwtSecret) {
      logger.error('JWT_SECRET não configurado — rota autenticada é inacessível');

      return {
        ok: false,
        message: 'Configuração de autenticação ausente no servidor.',
        code: ERROR_CODES.AUTH_NOT_CONFIGURED,
        status: 500
      };
    }

    try {
      const payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });

      // Dados disponibilizados para controllers e services.
      req.user = {
        id: payload.userId || payload.id || null,
        documento: payload.documento || null,
        nome: payload.nome || null,
        pessoaId: payload.pessoaId || null,
        oab: payload.oab || { isInscrito: false },
        ...payload
      };
      req.userId = req.user.id;
      req.tipoAutenticacao = 'jwt';

      return { ok: true, tipo: 'jwt' };

    } catch (error) {
      const expirado = error.name === 'TokenExpiredError';

      return {
        ok: false,
        message: expirado ? 'Token expirado.' : 'Token JWT inválido.',
        code: expirado ? ERROR_CODES.EXPIRED_TOKEN : ERROR_CODES.INVALID_TOKEN
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 2. API Key
  // ---------------------------------------------------------------------------
  const apiKey = req.headers['x-api-key'];

  if (apiKey) {
    const autorizada = env.apiKeys.some(chave => compararSeguro(chave, apiKey));

    if (autorizada) {
      req.tipoAutenticacao = 'api-key';
      return { ok: true, tipo: 'api-key' };
    }

    return {
      ok: false,
      message: 'Chave de API inválida ou não autorizada.',
      code: ERROR_CODES.INVALID_API_KEY
    };
  }

  // ---------------------------------------------------------------------------
  // Nenhuma credencial
  // ---------------------------------------------------------------------------
  return {
    ok: false,
    message: 'Autenticação não fornecida (envie Authorization: Bearer <token> ou x-api-key).',
    code: ERROR_CODES.NO_TOKEN
  };
};

/**
 * Autenticação OBRIGATÓRIA. Bloqueia a requisição sem credencial válida.
 */
const autenticar = (req, res, next) => {
  const resultado = tentarAutenticar(req);

  if (resultado.ok) {
    return next();
  }

  logger.warn(`Falha de autenticação: ${resultado.message}`, {
    ip: (req.ip || '').replace('::ffff:', ''),
    path: req.originalUrl,
    code: resultado.code
  });

  if (resultado.status === 500) {
    return Response.error(res, resultado.message, 500, resultado.code);
  }

  return Response.unauthorized(res, resultado.message, resultado.code);
};

/**
 * Autenticação OPCIONAL. Preenche `req.user` quando houver credencial válida,
 * mas nunca bloqueia. Útil em rotas públicas que devolvem dados extras para
 * usuários logados.
 */
const autenticarOpcional = (req, res, next) => {
  tentarAutenticar(req);
  return next();
};

module.exports = {
  autenticar,
  autenticarOpcional,
  extrairToken
};
