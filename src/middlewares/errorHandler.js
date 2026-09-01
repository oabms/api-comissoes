const logger = require('../config/logger');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const { HTTP_STATUS, ERROR_MESSAGES, ERROR_CODES } = require('../utils/constants');

// =============================================================================
// ERROR HANDLER — TRATAMENTO CENTRALIZADO DE ERROS
// =============================================================================
// Precisa ser o ÚLTIMO `app.use` do server. Recebe:
//   - AppError lançado por um service (erro esperado);
//   - erros do driver mssql, do express-validator, do JSON parser, etc.;
//   - qualquer exceção não prevista.
//
// Regra de exposição: erros 5xx NÃO operacionais nunca vazam a mensagem
// original ao cliente (pode conter nome de tabela, servidor, credencial).
// O detalhe completo vai para o log.
// =============================================================================

/**
 * Traduz erros conhecidos de bibliotecas para AppError, para que a resposta
 * saia no formato padrão em vez de um 500 genérico.
 */
const normalizarErro = (err) => {
  if (err instanceof AppError) {
    return err;
  }

  // Body JSON malformado (body-parser)
  if (err.type === 'entity.parse.failed') {
    return AppError.requisicaoInvalida('Corpo da requisição não é um JSON válido.');
  }

  // Payload acima do limite configurado em express.json()
  if (err.type === 'entity.too.large') {
    return new AppError(
      'Corpo da requisição excede o tamanho máximo permitido.',
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  // Violação de chave única / PK no SQL Server
  if (err.number === 2627 || err.number === 2601) {
    return AppError.conflito('Registro já existente.');
  }

  // Violação de foreign key
  if (err.number === 547) {
    return AppError.requisicaoInvalida(
      'Operação viola uma referência existente no banco de dados.'
    );
  }

  // Timeout de request do mssql
  if (err.code === 'ETIMEOUT' || err.code === 'ESOCKET') {
    return new AppError(
      ERROR_MESSAGES.SERVICE_UNAVAILABLE,
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      ERROR_CODES.INTERNAL_ERROR
    );
  }

  return null;
};

// eslint-disable-next-line no-unused-vars -- o Express só reconhece o error
// handler se a função declarar os 4 parâmetros.
const errorHandler = (err, req, res, next) => {
  const erroNormalizado = normalizarErro(err);

  const statusCode = erroNormalizado?.statusCode
    || err.statusCode
    || err.status
    || HTTP_STATUS.INTERNAL_SERVER_ERROR;

  const code = erroNormalizado?.code || err.code || ERROR_CODES.INTERNAL_ERROR;
  const isOperational = erroNormalizado?.isOperational === true;

  // ---------------------------------------------------------------------------
  // Log
  // ---------------------------------------------------------------------------
  const contexto = {
    code,
    statusCode,
    method: req.method,
    url: req.originalUrl,
    ip: (req.ip || '').replace('::ffff:', ''),
    usuario: req.user?.id || null
  };

  if (statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR) {
    logger.error(err.message || 'Erro interno do servidor', {
      ...contexto,
      stack: err.stack
    });
  } else {
    // 4xx é erro do cliente: warn, sem stack (não é bug da API).
    logger.warn(err.message || 'Erro do cliente', contexto);
  }

  // ---------------------------------------------------------------------------
  // Resposta
  // ---------------------------------------------------------------------------
  const exporMensagem =
    statusCode < HTTP_STATUS.INTERNAL_SERVER_ERROR || isOperational;

  const resposta = {
    success: false,
    message: exporMensagem
      ? (erroNormalizado?.message || err.message)
      : ERROR_MESSAGES.INTERNAL_ERROR,
    code,
    timestamp: new Date().toISOString()
  };

  // Detalhes anexados ao AppError (ex: lista de campos inválidos)
  if (erroNormalizado?.detalhes) {
    Object.assign(resposta, erroNormalizado.detalhes);
  }

  if (err.errors) {
    resposta.errors = err.errors;
  }

  // Stack apenas fora de produção.
  if (!env.isProducao) {
    resposta.stack = err.stack;
  }

  return res.status(statusCode).json(resposta);
};

module.exports = errorHandler;
