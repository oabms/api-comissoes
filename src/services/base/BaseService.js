const logger = require('../../config/logger');
const db = require('../../config/database');

// =============================================================================
// BASE SERVICE
// =============================================================================
// Classe base dos services de domínio. Fornece:
//   - `this.db`   -> instância única do DatabaseService
//   - logs já prefixados com o nome do service (`[ComissaoService] ...`),
//     o que torna o rastreio em produção muito mais rápido.
//
// Uso:
//
//   class ComissaoService extends BaseService {
//     constructor() {
//       super('ComissaoService');
//     }
//
//     async listar() {
//       this.logInfo('Listando comissões');
//       return this.db.query(queries.LISTAR_COMISSOES);
//     }
//   }
//
//   module.exports = new ComissaoService();   // singleton
// =============================================================================

class BaseService {

  /**
   * @param {string} nome - Nome do service, usado como prefixo nos logs
   */
  constructor(nome) {
    this.nome = nome || this.constructor.name;
    this.db = db;
  }

  logInfo(mensagem, dados = {}) {
    logger.info(`[${this.nome}] ${mensagem}`, dados);
  }

  logWarn(mensagem, dados = {}) {
    logger.warn(`[${this.nome}] ${mensagem}`, dados);
  }

  logDebug(mensagem, dados = {}) {
    logger.debug(`[${this.nome}] ${mensagem}`, dados);
  }

  /**
   * @param {string} mensagem
   * @param {Error}  error
   */
  logError(mensagem, error, dados = {}) {
    logger.error(`[${this.nome}] ${mensagem}`, {
      ...dados,
      error: error?.message || String(error),
      stack: error?.stack
    });
  }

}

module.exports = BaseService;
