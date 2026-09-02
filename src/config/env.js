const path = require('path');

// =============================================================================
// CARREGAMENTO E VALIDAÇÃO DAS VARIÁVEIS DE AMBIENTE
// =============================================================================
// Este módulo é o ÚNICO lugar do projeto que lê `process.env` diretamente.
// O resto da aplicação importa `env` daqui. Isso garante que:
//
// 1. Toda variável obrigatória é validada no boot (falha alto, não em runtime);
// 2. Conversões (string -> número / booleano) acontecem em um lugar só;
// 3. Dá para ver todas as configurações da API lendo um arquivo.
//
// APP_ENV=producao -> carrega .env.producao
// qualquer outro valor (ou ausente) -> carrega .env (homologação/desenvolvimento)
// =============================================================================

const envFile = process.env.APP_ENV === 'producao' ? '.env.producao' : '.env';

require('dotenv').config({
  path: path.resolve(__dirname, '..', '..', envFile)
});

/**
 * Converte string de env para booleano.
 * Aceita 'true'/'1' como verdadeiro; qualquer outra coisa é falso.
 */
const toBoolean = (valor, padrao = false) => {
  if (valor === undefined || valor === '') return padrao;
  return valor === 'true' || valor === '1';
};

/**
 * Converte string de env para inteiro, com fallback.
 */
const toInt = (valor, padrao) => {
  const numero = parseInt(valor, 10);
  return Number.isNaN(numero) ? padrao : numero;
};

/**
 * Converte lista separada por vírgula em array limpo.
 * Ex: 'a.com, b.com' -> ['a.com', 'b.com']
 */
const toList = (valor) => (valor || '')
  .split(',')
  .map(item => item.trim())
  .filter(Boolean);

// -----------------------------------------------------------------------------
// Variáveis obrigatórias em QUALQUER API
// -----------------------------------------------------------------------------
// Adicione aqui o que a sua API não consegue subir sem (ex: 'JWT_SECRET' se as
// rotas forem autenticadas, credenciais de integrações externas, etc).
const OBRIGATORIAS = [
  'DB_SERVER',
  'DB_DATABASE',
  'DB_USER',
  'DB_PASSWORD'
];

const faltando = OBRIGATORIAS.filter(variavel => !process.env[variavel]);

if (faltando.length) {
  throw new Error(
    `Variáveis de ambiente não configuradas em ${envFile}: ${faltando.join(', ')}`
  );
}

const env = {
  // ---------------------------------------------------------------------------
  // Aplicação
  // ---------------------------------------------------------------------------
  arquivoEnv: envFile,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProducao: process.env.NODE_ENV === 'production',
  isDesenvolvimento: (process.env.NODE_ENV || 'development') === 'development',
  porta: toInt(process.env.PORT, 3000),

  // Nome e versão aparecem no log de boot, na rota `/` e no health check.
  nomeApi: process.env.API_NAME || 'api-comissoes',
  versaoApi: process.env.npm_package_version || '1.0.0',

  // Prefixo de todas as rotas de negócio (ex: /api/comissoes).
  prefixoApi: process.env.API_PREFIX || '/api',

  // ---------------------------------------------------------------------------
  // Banco de dados (SQL Server)
  // ---------------------------------------------------------------------------
  db: {
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: toInt(process.env.DB_PORT, 1433),
    encrypt: toBoolean(process.env.DB_ENCRYPT, false),
    trustServerCertificate: toBoolean(process.env.DB_TRUST_CERTIFICATE, true),
    connectTimeout: toInt(process.env.DB_CONNECT_TIMEOUT, 30000),
    requestTimeout: toInt(process.env.DB_REQUEST_TIMEOUT, 30000),
    poolMax: toInt(process.env.DB_POOL_MAX, 10),
    poolMin: toInt(process.env.DB_POOL_MIN, 0),
    poolIdleTimeout: toInt(process.env.DB_POOL_IDLE_TIMEOUT, 30000)
  },

  // ---------------------------------------------------------------------------
  // CORS
  // ---------------------------------------------------------------------------
  // Vazio = libera qualquer origem (use apenas em homologação).
  corsOrigins: toList(process.env.CORS_ORIGINS),

  // ---------------------------------------------------------------------------
  // Autenticação
  // ---------------------------------------------------------------------------
  // O middleware de auth aceita dois caminhos (ver src/middlewares/authMiddleware.js):
  //   - JWT emitido pela api-register-login (Authorization: Bearer <token>)
  //   - API Key para chamadas server-to-server (header x-api-key)
  // Deixe ambos vazios se a API for pública.
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  apiKeys: toList(process.env.ALLOWED_API_KEYS),

  // ---------------------------------------------------------------------------
  // Rate limit padrão (por IP)
  // ---------------------------------------------------------------------------
  rateLimit: {
    janelaMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    maximo: toInt(process.env.RATE_LIMIT_MAX, 300)
  },

  // ---------------------------------------------------------------------------
  // Logs
  // ---------------------------------------------------------------------------
  log: {
    nivel: process.env.LOG_LEVEL || 'info',
    retencao: process.env.LOG_MAX_FILES || '30d',
    tamanhoMaximo: process.env.LOG_MAX_SIZE || '20m'
  }
};

module.exports = env;
