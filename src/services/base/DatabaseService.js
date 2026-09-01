const sql = require('mssql');
const logger = require('../../config/logger');

// =============================================================================
// DATABASE SERVICE — CONEXÃO E EXECUÇÃO DE QUERIES NO SQL SERVER
// =============================================================================
// Responsabilidades:
//   1. Gerenciar o pool de conexões (lazy, singleton, à prova de corrida);
//   2. Executar queries com parâmetros TIPADOS (previne SQL Injection e erros
//      de conversão do tipo "nvarchar to bigint");
//   3. Executar blocos transacionais com commit/rollback automáticos;
//   4. Expor health check e encerramento gracioso.
//
// A instância única da aplicação é criada em src/config/database.js.
// =============================================================================

/**
 * @function bindTypedParam
 * @description Vincula um parâmetro a uma request do mssql inferindo o tipo SQL
 *              a partir do tipo JavaScript do valor.
 *
 *              Existe como função solta (e não como método) porque também é
 *              usada em requests criadas dentro de uma transação, onde não há
 *              acesso ao pool.
 *
 * @param {sql.Request} request - Request do mssql (do pool ou de uma transação)
 * @param {string} key   - Nome do parâmetro (referenciado como @key na query)
 * @param {*}      value - Valor a vincular
 */
function bindTypedParam(request, key, value) {
  // Nulo/indefinido: precisa de um tipo explícito, senão o driver reclama.
  if (value === undefined || value === null) {
    request.input(key, sql.NVarChar, null);
    return;
  }

  switch (typeof value) {
    case 'number':
      if (Number.isInteger(value)) {
        // Cabe em INT? usa INT. Senão, BIGINT.
        if (value >= -2147483648 && value <= 2147483647) {
          request.input(key, sql.Int, value);
        } else {
          request.input(key, sql.BigInt, value);
        }
      } else {
        request.input(key, sql.Decimal(18, 4), value);
      }
      break;

    case 'boolean':
      request.input(key, sql.Bit, value);
      break;

    case 'string':
      request.input(key, sql.NVarChar, value);
      break;

    case 'object':
      if (Buffer.isBuffer(value)) {
        // Arquivos / conteúdo binário (ex: upload de anexo)
        request.input(key, sql.VarBinary(sql.MAX), value);
      } else if (value instanceof Date) {
        request.input(key, sql.DateTime, value);
      } else {
        request.input(key, sql.NVarChar(sql.MAX), JSON.stringify(value));
      }
      break;

    default:
      request.input(key, sql.NVarChar, String(value));
  }
}

class DatabaseService {

  /**
   * @param {Object} config - Configuração aceita pelo driver mssql
   */
  constructor(config) {
    this.config = config;
    this.pool = null;

    // Guarda a promise da conexão em andamento. Sem isso, N requisições
    // simultâneas no boot disparariam N conexões concorrentes.
    this.connectionPromise = null;
  }

  // ---------------------------------------------------------------------------
  // CONEXÃO
  // ---------------------------------------------------------------------------

  /**
   * Retorna o pool de conexões, criando-o na primeira chamada (lazy).
   *
   * @returns {Promise<sql.ConnectionPool>}
   */
  async connect() {
    if (this.pool) {
      return this.pool;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    try {
      logger.info(`Conectando ao banco: ${this.config.database}...`);

      // `new sql.ConnectionPool` em vez de `sql.connect` — este último grava em
      // um singleton global do módulo mssql, o que impede conectar em mais de um
      // banco no mesmo processo e atrapalha os testes.
      this.connectionPromise = new sql.ConnectionPool(this.config).connect();

      this.pool = await this.connectionPromise;
      this.connectionPromise = null;

      // Se o pool cair depois de estabelecido, zera o estado para que a próxima
      // chamada reconecte em vez de reutilizar um pool morto.
      this.pool.on('error', (error) => {
        logger.error('Erro no pool de conexões', { error: error.message });
        this.pool = null;
      });

      await this.pool.request().query('SELECT 1');

      logger.info(`Conectado ao banco: ${this.config.database}`);

      return this.pool;

    } catch (error) {
      this.pool = null;
      this.connectionPromise = null;

      logger.error('Erro ao conectar ao banco', { error: error.message });

      throw new Error(`Falha na conexão com o banco: ${error.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // CONSULTAS
  // ---------------------------------------------------------------------------

  /**
   * Executa uma query e devolve as LINHAS do primeiro recordset.
   * É o método usado em 95% dos casos.
   *
   * @param {string} sqlQuery - SQL com parâmetros nomeados (@id, @nome, ...)
   * @param {Object} params   - { id: 1, nome: 'x' }
   * @returns {Promise<Array<Object>>} Linhas retornadas
   *
   * @example
   * const linhas = await db.query(
   *   'SELECT ID, Nome FROM Comissao WHERE Ativa = @ativa',
   *   { ativa: true }
   * );
   */
  async query(sqlQuery, params = {}) {
    const resultado = await this.execute(sqlQuery, params);
    return resultado.recordset || [];
  }

  /**
   * Executa uma query e devolve as LINHAS do primeiro recordset.
   *
   * @deprecated Use {@link DatabaseService#query}. Mantido apenas para leitura
   *             mais explícita em pontos onde o nome ajuda.
   */
  async queryRows(sqlQuery, params = {}) {
    return this.query(sqlQuery, params);
  }

  /**
   * Executa uma query e devolve a PRIMEIRA linha (ou null).
   * Evita o `resultado[0]` espalhado pelos services.
   *
   * @returns {Promise<Object|null>}
   */
  async queryOne(sqlQuery, params = {}) {
    const linhas = await this.query(sqlQuery, params);
    return linhas.length ? linhas[0] : null;
  }

  /**
   * Executa uma query e devolve o resultado COMPLETO do driver
   * (`recordset`, `recordsets`, `rowsAffected`, `output`).
   *
   * Use quando precisar de múltiplos recordsets ou de `rowsAffected`
   * (INSERT/UPDATE/DELETE).
   *
   * @returns {Promise<sql.IResult>}
   */
  async execute(sqlQuery, params = {}) {
    try {
      const pool = await this.connect();
      const request = pool.request();

      Object.entries(params).forEach(([key, value]) => {
        bindTypedParam(request, key, value);
      });

      return await request.query(sqlQuery);

    } catch (error) {
      // A query é truncada no log: queries grandes poluem o arquivo e podem
      // conter dados sensíveis interpolados por engano.
      logger.error('Erro ao executar consulta SQL', {
        error: error.message,
        params: Object.keys(params),
        query: sqlQuery.substring(0, 500) + (sqlQuery.length > 500 ? '...' : '')
      });

      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // TRANSAÇÕES
  // ---------------------------------------------------------------------------

  /**
   * Executa um bloco dentro de uma transação. Commit automático no sucesso,
   * rollback automático em qualquer erro.
   *
   * O callback recebe `(exec, transaction)`:
   *   - `exec(sql, params)`  -> executa uma query tipada DENTRO da transação
   *   - `transaction`        -> objeto cru do mssql, para casos avançados
   *
   * IMPORTANTE: dentro do callback, use SEMPRE `exec` (ou `transaction.request()`).
   * Chamar `db.query()` ali usa uma conexão diferente do pool e a operação fica
   * FORA da transação — além de travar em deadlock contra os locks dela.
   *
   * @param {(exec: Function, transaction: sql.Transaction) => Promise<any>} callback
   * @returns {Promise<any>} O que o callback retornar
   *
   * @example
   * const id = await db.transaction(async (exec) => {
   *   const [{ nextId }] = (await exec('SELECT NEXT VALUE FOR SEQ_Comissao AS nextId')).recordset;
   *   await exec('INSERT INTO Comissao (ID, Nome) VALUES (@id, @nome)', { id: nextId, nome });
   *   return nextId;
   * });
   */
  async transaction(callback) {
    const pool = await this.connect();
    const transaction = new sql.Transaction(pool);

    await transaction.begin();

    const exec = async (sqlQuery, params = {}) => {
      const request = transaction.request();

      Object.entries(params).forEach(([key, value]) => {
        bindTypedParam(request, key, value);
      });

      return request.query(sqlQuery);
    };

    try {
      const resultado = await callback(exec, transaction);

      await transaction.commit();

      return resultado;

    } catch (error) {
      // O rollback é protegido porque ele próprio pode falhar: se o SQL Server já
      // tiver derrubado a transação sozinho (deadlock, XACT_ABORT), o driver a
      // marca como abortada e `rollback()` lança "Transaction has been aborted.".
      // Sem este try/catch, essa exceção substituiria o erro original e esconderia
      // a causa real do problema.
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        logger.warn('Rollback falhou (transação provavelmente já abortada pelo servidor)', {
          rollbackError: rollbackError.message,
          erroOriginal: error.message
        });
      }

      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // OPERACIONAL
  // ---------------------------------------------------------------------------

  /**
   * Verifica se o banco responde. Usado pelo endpoint /api/health.
   *
   * @returns {Promise<{ status: string, banco?: string, serverTime?: Date, error?: string }>}
   */
  async healthCheck() {
    try {
      const linha = await this.queryOne(
        'SELECT DB_NAME() AS banco, GETDATE() AS serverTime'
      );

      return {
        status: 'healthy',
        banco: linha.banco,
        serverTime: linha.serverTime
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  /**
   * Fecha o pool. Chamado no encerramento gracioso (SIGINT/SIGTERM).
   */
  async close() {
    try {
      if (this.pool) {
        await this.pool.close();

        this.pool = null;
        this.connectionPromise = null;

        logger.info(`Conexão com o banco ${this.config.database} encerrada`);
      }
    } catch (error) {
      logger.error('Erro ao fechar conexão com o banco', { error: error.message });
    }
  }

}

module.exports = DatabaseService;
module.exports.bindTypedParam = bindTypedParam;
module.exports.sql = sql;
