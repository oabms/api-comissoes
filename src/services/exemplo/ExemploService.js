const BaseService = require('../base/BaseService');
const queries = require('./queries/exemploQueries');
const { FLAG, flagParaBooleano } = require('./constants/exemploConstants');

const AppError = require('../../utils/AppError');
const { montarResultadoPaginado, escaparLike } = require('../../utils/pagination');

// =============================================================================
// EXEMPLO SERVICE — MODELO DE SERVICE DE DOMÍNIO
// =============================================================================
// Este arquivo existe para ser COPIADO. Ele demonstra as quatro decisões que se
// repetem em todos os services do projeto:
//
//   1. Toda a regra de negócio mora aqui (o controller só traduz HTTP);
//   2. O SQL vem de ./queries/ — nenhuma string SQL solta no meio da lógica;
//   3. A saída do banco é SEMPRE mapeada antes de virar resposta (ver `mapear`),
//      para não vazar nomes de coluna do legado nem BigInt como string;
//   4. Erro esperado -> `throw new AppError(...)`; erro inesperado sobe puro.
//
// O service é exportado como INSTÂNCIA ÚNICA (singleton) no fim do arquivo.
// =============================================================================

class ExemploService extends BaseService {

  constructor() {
    super('ExemploService');
  }

  // ---------------------------------------------------------------------------
  // MAPEAMENTO
  // ---------------------------------------------------------------------------

  /**
   * Traduz uma linha do banco para o objeto público da API.
   *
   * Por que isso é obrigatório:
   *   - As colunas do legado são PascalCase e às vezes têm nomes que não fazem
   *     sentido fora do sistema antigo. A API expõe camelCase estável;
   *   - IDs BIGINT chegam como string do driver — `Number()` evita que o
   *     frontend receba `"123"` em um campo e `123` em outro;
   *   - Flags 'X'/'.' viram booleano de verdade.
   *
   * @param {Object} linha - Registro cru do recordset
   */
  mapear(linha) {
    return {
      id: Number(linha.ID),
      descricao: linha.Descricao,
      ativo: flagParaBooleano(linha.Ativo),
      criadoEm: linha.CreatedOn,
      atualizadoEm: linha.UpdatedOn ?? null
    };
  }

  // ---------------------------------------------------------------------------
  // LEITURA
  // ---------------------------------------------------------------------------

  /**
   * Lista paginada, com busca opcional por descrição.
   *
   * @param {Object} filtros
   * @param {string} [filtros.termo]         - Busca por início da descrição
   * @param {boolean} [filtros.somenteAtivos]
   * @param {{ pagina: number, limite: number, offset: number }} paginacao
   */
  async listar(filtros = {}, paginacao) {
    const { termo, somenteAtivos = false } = filtros;

    const params = {
      // `escaparLike` neutraliza os curingas % e _ digitados pelo usuário; sem
      // isso um `?q=%` vira varredura da tabela inteira.
      termo: termo ? escaparLike(termo) : null,
      somenteAtivos: somenteAtivos ? 1 : 0
    };

    // As duas consultas são independentes — rodam em paralelo.
    const [linhas, contagem] = await Promise.all([
      this.db.query(queries.LISTAR, {
        ...params,
        offset: paginacao.offset,
        limite: paginacao.limite
      }),
      this.db.queryOne(queries.CONTAR, params)
    ]);

    return montarResultadoPaginado(
      linhas.map(linha => this.mapear(linha)),
      Number(contagem?.total || 0),
      paginacao
    );
  }

  /**
   * Busca um registro por ID.
   *
   * Lança AppError 404 em vez de devolver null: assim o controller não precisa
   * decidir o status e a regra fica no service, onde ela pertence.
   */
  async buscarPorId(id) {
    const linha = await this.db.queryOne(queries.BUSCAR_POR_ID, { id: Number(id) });

    if (!linha) {
      throw AppError.naoEncontrado('Registro não encontrado.');
    }

    return this.mapear(linha);
  }

  // ---------------------------------------------------------------------------
  // ESCRITA
  // ---------------------------------------------------------------------------

  /**
   * Criação dentro de uma transação.
   *
   * O padrão vale para qualquer escrita que toque mais de uma tabela ou dependa
   * de uma SEQUENCE: se qualquer passo falhar, nada é gravado.
   *
   * Repare que TODAS as queries usam `exec` (o executor da transação) — chamar
   * `this.db.query` aqui dentro pegaria outra conexão do pool, ficaria fora da
   * transação e ainda travaria contra os locks dela.
   */
  async criar(dados, usuarioId) {
    return this.db.transaction(async (exec) => {
      const resultadoId = await exec(queries.PROXIMO_ID);
      const novoId = Number(resultadoId.recordset[0].nextId);

      await exec(queries.INSERIR, {
        id: novoId,
        descricao: dados.descricao,
        ativo: dados.ativo === false ? FLAG.NAO : FLAG.SIM,
        createdBy: usuarioId || null
      });

      this.logInfo('Registro criado', { id: novoId, usuarioId });

      return { id: novoId, descricao: dados.descricao, ativo: dados.ativo !== false };
    });
  }

}

// Singleton: uma instância compartilhada por toda a aplicação.
module.exports = new ExemploService();
