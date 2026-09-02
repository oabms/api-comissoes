const BaseService = require('../base/BaseService');
const queries = require('./queries/comissaoQueries');

const AppError = require('../../utils/AppError');
const { HTTP_STATUS, ERROR_CODES } = require('../../utils/constants');
const { montarResultadoPaginado, escaparLike } = require('../../utils/pagination');

// =============================================================================
// COMISSÃO SERVICE
// =============================================================================
// Regra de negócio das três consultas que a API oferece:
//
//   1. listar / buscarPorId       -> catálogo de comissões;
//   2. listarMembros              -> quem compõe uma comissão;
//   3. listarComissoesDaPessoa    -> em quais comissões alguém atua.
//
// Todas leem HistoricoCargo, a tabela de vínculos do legado. As colunas cruas
// (PascalCase, BIGINT como string, datas) nunca chegam ao cliente: passam pelos
// `mapear*` abaixo.
//
// API somente de consulta — não há escrita neste service.
// =============================================================================

class ComissaoService extends BaseService {

  constructor() {
    super('ComissaoService');
  }

  // ---------------------------------------------------------------------------
  // MAPEAMENTO
  // ---------------------------------------------------------------------------

  /**
   * Normaliza texto vindo do legado: espaços das pontas fora, vazio vira null.
   * Sem isso o consumidor recebe `"   "` em campos como Sigla e precisa tratar.
   */
  texto(valor) {
    const limpo = String(valor ?? '').trim();
    return limpo === '' ? null : limpo;
  }

  /**
   * Cargo ocupado no vínculo. Vem de LEFT JOIN, então pode não existir.
   */
  mapearCargo(linha) {
    if (linha.CargoID === null || linha.CargoID === undefined) {
      return null;
    }

    return {
      id: Number(linha.CargoID),
      descricao: this.texto(linha.CargoDescricao)
    };
  }

  mapearComissao(linha) {
    return {
      id: Number(linha.ID),
      descricao: this.texto(linha.Descricao),
      sigla: this.texto(linha.Sigla),
      inicioVigencia: linha.InicioVigencia ?? null,
      fimVigencia: linha.FimVigencia ?? null,
      totalMembrosVigentes: Number(linha.totalMembrosVigentes || 0)
    };
  }

  /**
   * Um membro dentro de uma comissão. Não repete a comissão: ela já é o
   * contexto do endpoint.
   */
  mapearMembro(linha) {
    return {
      id: Number(linha.ID),
      pessoa: {
        id: Number(linha.PessoaID),
        nome: this.texto(linha.PessoaNome),
        registroConselho: this.texto(linha.PessoaRegistroConselho)
      },
      cargo: this.mapearCargo(linha),
      cargoComplemento: this.texto(linha.CargoComplemento),
      dataInicio: linha.DataInicio,
      dataFim: linha.DataFim ?? null,
      vigente: Boolean(linha.Vigente)
    };
  }

  /**
   * O mesmo vínculo visto pelo outro lado: a comissão em que a pessoa atua.
   */
  mapearVinculoDaPessoa(linha) {
    return {
      id: Number(linha.ID),
      comissao: {
        id: Number(linha.ComissaoID),
        descricao: this.texto(linha.ComissaoDescricao),
        sigla: this.texto(linha.ComissaoSigla)
      },
      cargo: this.mapearCargo(linha),
      cargoComplemento: this.texto(linha.CargoComplemento),
      dataInicio: linha.DataInicio,
      dataFim: linha.DataFim ?? null,
      vigente: Boolean(linha.Vigente)
    };
  }

  // ---------------------------------------------------------------------------
  // COMISSÕES
  // ---------------------------------------------------------------------------

  /**
   * Lista paginada de comissões, com busca opcional por trecho da descrição.
   *
   * @param {Object} filtros
   * @param {string} [filtros.termo] - Trecho do nome da comissão
   * @param {{ pagina: number, limite: number, offset: number }} paginacao
   */
  async listar(filtros = {}, paginacao) {
    const params = {
      // Neutraliza os curingas % e _ digitados pelo usuário.
      termo: filtros.termo ? escaparLike(filtros.termo) : null
    };

    const [linhas, contagem] = await Promise.all([
      this.db.query(queries.LISTAR_COMISSOES, {
        ...params,
        offset: paginacao.offset,
        limite: paginacao.limite
      }),
      this.db.queryOne(queries.CONTAR_COMISSOES, params)
    ]);

    return montarResultadoPaginado(
      linhas.map(linha => this.mapearComissao(linha)),
      Number(contagem?.total || 0),
      paginacao
    );
  }

  /**
   * Detalhe de uma comissão. Lança 404 se não existir.
   */
  async buscarPorId(id) {
    const linha = await this.db.queryOne(queries.BUSCAR_COMISSAO_POR_ID, { id: Number(id) });

    if (!linha) {
      throw AppError.naoEncontrado('Comissão não encontrada.');
    }

    return this.mapearComissao(linha);
  }

  // ---------------------------------------------------------------------------
  // MEMBROS DE UMA COMISSÃO
  // ---------------------------------------------------------------------------

  /**
   * Membros de uma comissão, do presidente ao membro comum.
   *
   * A existência da comissão é conferida ANTES da listagem: sem isso, um ID
   * inexistente devolveria uma lista vazia com 200, e o consumidor não teria
   * como distinguir "comissão sem membros" de "comissão que não existe".
   *
   * @param {number|string} comissaoId
   * @param {Object} filtros
   * @param {boolean} [filtros.somenteVigentes=true] - Só quem está em exercício
   * @param {number}  [filtros.cargoId]              - Filtra por um cargo específico
   * @param {string}  [filtros.termo]                - Trecho do nome da pessoa
   * @param {{ pagina: number, limite: number, offset: number }} paginacao
   */
  async listarMembros(comissaoId, filtros = {}, paginacao) {
    const comissao = await this.buscarPorId(comissaoId);

    const { somenteVigentes = true, cargoId, termo } = filtros;

    const params = {
      comissaoId: comissao.id,
      somenteVigentes: somenteVigentes ? 1 : 0,
      cargoId: cargoId ? Number(cargoId) : null,
      termo: termo ? escaparLike(termo) : null
    };

    const [linhas, contagem] = await Promise.all([
      this.db.query(queries.LISTAR_MEMBROS, {
        ...params,
        offset: paginacao.offset,
        limite: paginacao.limite
      }),
      this.db.queryOne(queries.CONTAR_MEMBROS, params)
    ]);

    return montarResultadoPaginado(
      linhas.map(linha => this.mapearMembro(linha)),
      Number(contagem?.total || 0),
      paginacao
    );
  }

  // ---------------------------------------------------------------------------
  // COMISSÕES DE UMA PESSOA
  // ---------------------------------------------------------------------------

  /**
   * Em quais comissões uma pessoa atua (ou atuou), com cargo e período.
   *
   * @param {number|string} pessoaId - Pessoa.ID
   * @param {Object} filtros
   * @param {boolean} [filtros.somenteVigentes=false] - Só os vínculos em aberto
   */
  async listarComissoesDaPessoa(pessoaId, filtros = {}) {
    const pessoa = await this.db.queryOne(queries.BUSCAR_PESSOA_POR_ID, { id: Number(pessoaId) });

    if (!pessoa) {
      throw AppError.naoEncontrado('Pessoa não encontrada.');
    }

    return this.montarComissoesDaPessoa(pessoa, filtros);
  }

  /**
   * O mesmo que `listarComissoesDaPessoa`, identificando a pessoa pelo número
   * de inscrição na OAB em vez do ID interno — que é o número que o consumidor
   * da API realmente tem em mãos.
   *
   * @param {number|string} registro - Número da OAB (Pessoa.RegistroConselho)
   * @param {Object} filtros - Mesmos filtros de `listarComissoesDaPessoa`
   */
  async listarComissoesPorRegistroConselho(registro, filtros = {}) {
    const candidatos = await this.db.query(
      queries.BUSCAR_PESSOAS_POR_REGISTRO_CONSELHO,
      { registro: Number(registro) }
    );

    if (!candidatos.length) {
      throw AppError.naoEncontrado(`Nenhuma pessoa cadastrada com a inscrição OAB ${registro}.`);
    }

    const pessoa = this.resolverCadastroUnico(candidatos, registro);

    return this.montarComissoesDaPessoa(pessoa, filtros);
  }

  /**
   * Escolhe um cadastro quando o mesmo número de OAB aparece em mais de uma
   * linha da tabela Pessoa (o legado não garante unicidade do campo).
   *
   * A regra, nesta ordem:
   *
   *   1. Um único cadastro   -> é ele;
   *   2. Vários, mas só um com vínculo de comissão -> é o que interessa a esta
   *      API; os outros são cadastros duplicados sem participação;
   *   3. Vários com vínculo  -> 409. A API não tem como adivinhar qual é o
   *      certo, então devolve a lista para o consumidor escolher pelo ID;
   *   4. Nenhum com vínculo  -> o mais recente (a query ordena por ID DESC),
   *      que devolverá uma lista de comissões vazia. Qualquer um serviria: a
   *      resposta seria a mesma.
   *
   * @param {Array<Object>} candidatos - Linhas de BUSCAR_PESSOAS_POR_REGISTRO_CONSELHO
   * @param {number|string} registro
   */
  resolverCadastroUnico(candidatos, registro) {
    if (candidatos.length === 1) {
      return candidatos[0];
    }

    const comVinculo = candidatos.filter(linha => Number(linha.totalVinculosComissao) > 0);

    if (comVinculo.length === 1) {
      this.logWarn('Inscrição OAB em cadastros duplicados; usado o único com vínculo de comissão', {
        registro,
        pessoaEscolhida: Number(comVinculo[0].ID),
        candidatos: candidatos.map(linha => Number(linha.ID))
      });

      return comVinculo[0];
    }

    if (comVinculo.length > 1) {
      throw new AppError(
        `A inscrição OAB ${registro} está em mais de um cadastro com vínculo de comissão. `
        + 'Repita a consulta por ID, em /api/pessoas/{id}/comissoes.',
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.CONFLICT,
        {
          pessoas: comVinculo.map(linha => ({
            id: Number(linha.ID),
            nome: this.texto(linha.Nome),
            registroConselho: this.texto(linha.RegistroConselho)
          }))
        }
      );
    }

    this.logWarn('Inscrição OAB em cadastros duplicados, nenhum com vínculo de comissão', {
      registro,
      candidatos: candidatos.map(linha => Number(linha.ID))
    });

    return candidatos[0];
  }

  /**
   * Monta a resposta a partir de um cadastro de pessoa já resolvido — o ponto
   * onde as duas formas de identificar a pessoa (ID e inscrição OAB) se
   * encontram, para que devolvam exatamente o mesmo formato.
   *
   * A pessoa vai junto da lista para que a tela se identifique sem uma segunda
   * chamada. Sem paginação — ver a nota em queries/comissaoQueries.js
   * (LISTAR_COMISSOES_DA_PESSOA).
   */
  async montarComissoesDaPessoa(pessoa, filtros = {}) {
    const linhas = await this.db.query(queries.LISTAR_COMISSOES_DA_PESSOA, {
      pessoaId: Number(pessoa.ID),
      somenteVigentes: filtros.somenteVigentes ? 1 : 0
    });

    return {
      pessoa: {
        id: Number(pessoa.ID),
        nome: this.texto(pessoa.Nome),
        registroConselho: this.texto(pessoa.RegistroConselho)
      },
      comissoes: linhas.map(linha => this.mapearVinculoDaPessoa(linha))
    };
  }

}

// Singleton: uma instância compartilhada por toda a aplicação.
module.exports = new ComissaoService();
