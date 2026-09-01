const fs = require('fs');
const path = require('path');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const env = require('./env');

// =============================================================================
// LOGGER (Winston + rotação diária)
// =============================================================================
// Estrutura gerada:
//
//   logs/application/2026-09-01-application.log   -> tudo (info, warn, error)
//   logs/error/2026-09-01-error.log               -> somente erros
//   logs/exceptions/2026-09-01-exceptions.log     -> uncaughtException / unhandledRejection
//
// Arquivos antigos são compactados (.gz) e removidos após o período de retenção
// definido em LOG_MAX_FILES.
// =============================================================================

const pastaLogs = path.resolve(__dirname, '..', '..', 'logs');

const pastas = {
  application: path.join(pastaLogs, 'application'),
  error: path.join(pastaLogs, 'error'),
  exceptions: path.join(pastaLogs, 'exceptions')
};

Object.values(pastas).forEach(pasta => {
  if (!fs.existsSync(pasta)) {
    fs.mkdirSync(pasta, { recursive: true });
  }
});

/**
 * Formato de linha:
 *   [2026-09-01 09:31:04] INFO - GET /api/comissoes | Status: 200 | 42ms {"ip":"10.0.0.1"}
 *
 * Metadados passados como segundo argumento (logger.info('msg', { ip })) são
 * serializados em JSON no final da linha. O stack de erros vai em linha separada.
 */
const formato = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    delete meta[Symbol.for('level')];
    delete meta[Symbol.for('splat')];

    let extra = '';

    if (Object.keys(meta).length > 0) {
      extra += ` ${JSON.stringify(meta)}`;
    }

    if (stack) {
      extra += `\n${stack}`;
    }

    return `[${timestamp}] ${level.toUpperCase()} - ${message}${extra}`;
  })
);

const opcoesRotacao = {
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: env.log.tamanhoMaximo,
  maxFiles: env.log.retencao
};

const transporteExcecoes = new DailyRotateFile({
  ...opcoesRotacao,
  dirname: pastas.exceptions,
  filename: '%DATE%-exceptions.log'
});

const logger = winston.createLogger({
  level: env.log.nivel,
  format: formato,

  transports: [
    new winston.transports.Console(),

    // Todas as mensagens
    new DailyRotateFile({
      ...opcoesRotacao,
      dirname: pastas.application,
      filename: '%DATE%-application.log'
    }),

    // Apenas erros — facilita a triagem em produção
    new DailyRotateFile({
      ...opcoesRotacao,
      dirname: pastas.error,
      filename: '%DATE%-error.log',
      level: 'error'
    })
  ],

  exceptionHandlers: [transporteExcecoes],
  rejectionHandlers: [transporteExcecoes],

  // Não derruba o processo automaticamente — o encerramento é controlado
  // no server.js (ver `process.on('uncaughtException')`).
  exitOnError: false
});

module.exports = logger;
