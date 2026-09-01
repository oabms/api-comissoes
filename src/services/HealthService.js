const BaseService = require('./base/BaseService');
const env = require('../config/env');

// =============================================================================
// HEALTH SERVICE
// =============================================================================
// Alimenta o endpoint GET /api/health, consumido pelo monitoramento e pelo PM2.
// =============================================================================

class HealthService extends BaseService {

  constructor() {
    super('HealthService');
  }

  /**
   * @returns {Promise<{ status: string, database: string, ... }>}
   *          `status` é 'UP' quando o banco responde e 'DEGRADED' quando não —
   *          a API está de pé, mas não consegue atender.
   */
  async status() {
    const banco = await this.db.healthCheck();
    const bancoOk = banco.status === 'healthy';

    if (!bancoOk) {
      this.logWarn('Health check falhou no banco de dados', { error: banco.error });
    }

    return {
      status: bancoOk ? 'UP' : 'DEGRADED',
      api: env.nomeApi,
      versao: env.versaoApi,
      ambiente: env.nodeEnv,
      database: {
        status: bancoOk ? 'CONNECTED' : 'DISCONNECTED',
        nome: banco.banco || env.db.database,
        serverTime: banco.serverTime || null
      },
      uptimeSegundos: Number(process.uptime().toFixed(2)),
      timestamp: new Date().toISOString()
    };
  }

}

module.exports = new HealthService();
