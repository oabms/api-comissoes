const DatabaseService = require('../services/base/DatabaseService');
const env = require('./env');

// =============================================================================
// CONFIGURAÇÃO DA CONEXÃO COM O SQL SERVER
// =============================================================================
// A validação das variáveis obrigatórias (DB_SERVER, DB_DATABASE, DB_USER,
// DB_PASSWORD) já acontece em src/config/env.js — se faltar alguma, a API nem
// sobe.
// =============================================================================

const databaseConfig = {
  server: env.db.server,
  database: env.db.database,
  user: env.db.user,
  password: env.db.password,
  port: env.db.port,

  // Timeouts no nível da conexão (o driver aceita nos dois lugares; manter aqui
  // vale para toda a conexão, não só por request).
  connectionTimeout: env.db.connectTimeout,
  requestTimeout: env.db.requestTimeout,

  pool: {
    max: env.db.poolMax,
    min: env.db.poolMin,
    idleTimeoutMillis: env.db.poolIdleTimeout
  },

  options: {
    encrypt: env.db.encrypt,

    // Os servidores internos usam certificado autoassinado. Em produção, prefira
    // DB_ENCRYPT=true com um certificado válido e DB_TRUST_CERTIFICATE=false.
    trustServerCertificate: env.db.trustServerCertificate,

    enableArithAbort: true
  }
};

// Instância única (singleton) compartilhada por todos os services.
module.exports = new DatabaseService(databaseConfig);
