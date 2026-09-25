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
//
// Nesta API o que está em uso é `autenticarApiKey` (aplicado em bloco em
// src/routes/index.js): só há consumidores server-to-server, e aceitar JWT
// ampliaria a superfície sem necessidade. O caminho JWT fica disponível para
// quando o portal passar a consumir a API direto do navegador.
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
 * Autenticação por API KEY, exclusivamente.
 *
 * Exige `x-api-key` com uma das chaves de ALLOWED_API_KEYS. Um `Authorization:
 * Bearer <token>` válido NÃO abre a rota — é o modo usado pelas rotas de
 * negócio desta API.
 */
const autenticarApiKey = (req, res, next) => {
  const registrarFalha = (message, code) => {
    logger.warn(`Falha de autenticação: ${message}`, {
      ip: (req.ip || '').replace('::ffff:', ''),
      path: req.originalUrl,
      code
    });
  };

  // Sem chave configurada nenhuma requisição poderia ser aceita. Isso é barrado
  // no boot (src/config/env.js); a guarda aqui cobre o caso de a lista ser
  // esvaziada em tempo de execução e evita responder 401 por um erro que é do
  // servidor, não do cliente.
  if (!env.apiKeys.length) {
    logger.error('ALLOWED_API_KEYS não configurado — rota autenticada é inacessível');

    return Response.error(
      res,
      'Configuração de autenticação ausente no servidor.',
      500,
      ERROR_CODES.AUTH_NOT_CONFIGURED
    );
  }

  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    registrarFalha('Chave de API não fornecida.', ERROR_CODES.NO_TOKEN);

    return Response.unauthorized(
      res,
      'Autenticação não fornecida (envie o header x-api-key).',
      ERROR_CODES.NO_TOKEN
    );
  }

  const autorizada = env.apiKeys.some(chave => compararSeguro(chave, apiKey));

  if (!autorizada) {
    registrarFalha('Chave de API inválida ou não autorizada.', ERROR_CODES.INVALID_API_KEY);

    return Response.unauthorized(
      res,
      'Chave de API inválida ou não autorizada.',
      ERROR_CODES.INVALID_API_KEY
    );
  }

  req.tipoAutenticacao = 'api-key';

  return next();
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
  autenticarApiKey,
  autenticarOpcional,
  extrairToken
};
