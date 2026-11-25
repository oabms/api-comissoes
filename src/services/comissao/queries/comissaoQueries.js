const {
  ORDEM_CARGO,
  PREFIXO_DESCRICAO_COMISSAO,
  DESCRICOES_IGNORADAS
} = require('../constants/comissaoConstants');

// =============================================================================
// QUERIES DO MÓDULO COMISSÃO
// =============================================================================
// Modelo de dados no legado (HBConselhos):
//
//   Comissao         ID, Descricao, Sigla, InicioVigencia, FimVigencia
//   HistoricoCargo   ID, Comissao -> Comissao.ID
//                        Pessoa   -> Pessoa.ID
//                        Cargo    -> Cargo.ID
//                        CargoComplemento, DataInicio, DataFim
//   Pessoa           ID, Nome, RegistroConselho
//   Cargo            ID, Descricao
//
// HistoricoCargo é a tabela de vínculos: uma linha = uma pessoa ocupando um
// cargo em uma comissão a partir de DataInicio. Ela também guarda vínculos que
// NÃO são de comissão (subunidade, órgão público, colaborador) — por isso todo
// filtro parte de `h.Comissao`, que nesses casos vem nulo.
//
// A API é somente de consulta: não há INSERT/UPDATE/DELETE aqui.
// =============================================================================

/**
 * Regra de vigência do vínculo.
 *
 * `DataInicio` está sempre preenchida; `DataFim` fica nula enquanto o membro
 * está em exercício (1.084 dos 1.090 vínculos de comissão hoje). A comparação
 * com GETDATE() cobre o caso de uma data de término já cadastrada para o futuro.
 *
 * A coluna `Ativo` da tabela NÃO serve para isso — está gravada como '.' em
 * todos os registros de comissão (ver comissaoConstants.js).
 */
const VIGENTE = `(h.DataFim IS NULL OR h.DataFim > GETDATE())`;

/**
 * Ordenação por hierarquia de cargo, montada a partir de ORDEM_CARGO para que
 * exista uma única fonte de verdade da hierarquia (o arquivo de constantes).
 *
 * A interpolação aqui é segura e não abre exceção à regra de usar sempre
 * parâmetros nomeados: os valores vêm de constantes internas do projeto, nunca
 * da requisição.
 */
const ORDENACAO_POR_CARGO = `
    CASE h.Cargo
      ${ORDEM_CARGO.map((cargoId, indice) => `WHEN ${cargoId} THEN ${indice + 1}`).join('\n      ')}
      ELSE ${ORDEM_CARGO.length + 1}
    END`;

/**
 * Recorte da tabela `Comissao`: o que esta API considera uma comissão.
 *
 * A tabela mistura comissões com a estrutura administrativa do conselho
 * (gabinetes, câmaras, secretarias, setores da CAAMS) e `TipoComissao` está
 * nula em todas as linhas, então o critério é o nome — ver
 * PREFIXO_DESCRICAO_COMISSAO em constants/comissaoConstants.js.
 *
 * Vale para TODA consulta que toca `Comissao`, inclusive a busca por ID e os
 * vínculos de uma pessoa: uma estrutura administrativa não existe do ponto de
 * vista desta API, então responde 404 e não aparece na ficha de ninguém.
 *
 * O prefixo é literal e sem acento — seguro de interpolar. Já as descrições
 * ignoradas vão como parâmetros nomeados (@descricaoIgnorada0, ...): além da
 * regra do projeto, isso evita que o acento de "COMISSÃO DESATIVADA" dependa da
 * codificação do arquivo ou do collation do servidor.
 */
const PLACEHOLDERS_IGNORADAS = DESCRICOES_IGNORADAS
  .map((descricao, indice) => `@descricaoIgnorada${indice}`)
  .join(', ');

const E_UMA_COMISSAO = `c.Descricao LIKE '${PREFIXO_DESCRICAO_COMISSAO}%'`
  // Guarda contra a lista vazia: `NOT IN ()` não é SQL válido.
  + (DESCRICOES_IGNORADAS.length ? `\n      AND c.Descricao NOT IN (${PLACEHOLDERS_IGNORADAS})` : '');

/**
 * Valores dos @descricaoIgnoradaN, para o service espalhar nos params de toda
 * query que use E_UMA_COMISSAO. Fica aqui, junto dos placeholders, para que os
 * dois não saiam de sincronia.
 *
 * @returns {Object} { descricaoIgnorada0: 'COMISSÃO DESATIVADA', ... }
 */
const paramsDescricoesIgnoradas = () => Object.fromEntries(
  DESCRICOES_IGNORADAS.map((descricao, indice) => [`descricaoIgnorada${indice}`, descricao])
);

/**
 * WHERE compartilhado por LISTAR_COMISSOES e CONTAR_COMISSOES.
 * Mantenha os dois sincronizados alterando apenas esta constante.
 */
const FILTRO_COMISSOES = `
    WHERE ${E_UMA_COMISSAO}
      AND (@termo IS NULL OR c.Descricao LIKE '%' + @termo + '%')`;

/**
 * WHERE compartilhado por LISTAR_MEMBROS e CONTAR_MEMBROS.
 */
const FILTRO_MEMBROS = `
    WHERE h.Comissao = @comissaoId
      AND (@somenteVigentes = 0 OR ${VIGENTE})
      AND (@cargoId IS NULL OR h.Cargo = @cargoId)
      AND (@termo IS NULL OR p.Nome LIKE '%' + @termo + '%')`;

module.exports = {

  paramsDescricoesIgnoradas,

  // ---------------------------------------------------------------------------
  // COMISSÕES
  // ---------------------------------------------------------------------------

  /**
   * Lista paginada de comissões.
   *
   * A busca usa LIKE '%termo%' (e não o prefixo padrão do boilerplate) porque
   * ninguém procura uma comissão pelo começo do nome — procura por "penal",
   * "prerrogativas". São 167 comissões no total, então a varredura é irrelevante.
   *
   * `totalMembrosVigentes` sai de subconsulta correlacionada para que a tela de
   * listagem não precise de uma chamada por comissão só para exibir o contador.
   */
  LISTAR_COMISSOES: `
    SELECT
        c.ID,
        c.Descricao,
        c.Sigla,
        c.InicioVigencia,
        c.FimVigencia,
        totalMembrosVigentes = (
            SELECT COUNT(1)
            FROM HistoricoCargo h
            WHERE h.Comissao = c.ID
              AND (h.DataFim IS NULL OR h.DataFim > GETDATE())
        )
    FROM Comissao c
    ${FILTRO_COMISSOES}
    ORDER BY c.Descricao
    OFFSET @offset ROWS FETCH NEXT @limite ROWS ONLY
  `,

  /**
   * Lista enxuta das comissões ATIVAS (ID, descrição, sigla), sem paginação,
   * para o frontend montar seletores.
   *
   * EXCEÇÃO DELIBERADA ao recorte E_UMA_COMISSAO: o filtro aqui foi definido
   * pela área que consome o endpoint — nome CONTENDO "COMISSÃO" e
   * `CLI_Ativo = 'X'` (flag do legado, ver FLAG em comissaoConstants.js).
   * Consequências conhecidas:
   *   - um registro gravado sem acento ("COMISSAO ...") não aparece;
   *   - um ID devolvido aqui pode responder 404 em /api/comissoes/:id, que
   *     segue o recorte por prefixo.
   *
   * Os literais são constantes do próprio SQL, nada vem da requisição.
   */
  LISTAR_COMISSOES_ATIVAS: `
    SELECT
        ID,
        Descricao,
        Sigla
    FROM
        Comissao
    WHERE
        Descricao LIKE '%COMISSÃO%'
        AND CLI_Ativo = 'X'
    ORDER BY Descricao
  `,

  CONTAR_COMISSOES: `
    SELECT COUNT(1) AS total
    FROM Comissao c
    ${FILTRO_COMISSOES}
  `,

  BUSCAR_COMISSAO_POR_ID: `
    SELECT
        c.ID,
        c.Descricao,
        c.Sigla,
        c.InicioVigencia,
        c.FimVigencia,
        totalMembrosVigentes = (
            SELECT COUNT(1)
            FROM HistoricoCargo h
            WHERE h.Comissao = c.ID
              AND (h.DataFim IS NULL OR h.DataFim > GETDATE())
        )
    FROM Comissao c
    WHERE c.ID = @id
      AND ${E_UMA_COMISSAO}
  `,

  // ---------------------------------------------------------------------------
  // MEMBROS DE UMA COMISSÃO
  // ---------------------------------------------------------------------------

  /**
   * Membros de uma comissão, ordenados pela hierarquia do cargo e, dentro do
   * mesmo cargo, por nome.
   *
   * O JOIN com Pessoa é interno (todo vínculo de comissão tem Pessoa preenchida);
   * o de Cargo é LEFT para que um cargo removido do cadastro não faça o membro
   * sumir da listagem.
   */
  LISTAR_MEMBROS: `
    SELECT
        h.ID,
        h.Pessoa            AS PessoaID,
        p.Nome              AS PessoaNome,
        p.RegistroConselho  AS PessoaRegistroConselho,
        h.Cargo             AS CargoID,
        ca.Descricao        AS CargoDescricao,
        h.CargoComplemento,
        h.DataInicio,
        h.DataFim,
        Vigente = CASE WHEN ${VIGENTE} THEN 1 ELSE 0 END
    FROM HistoricoCargo h
    INNER JOIN Pessoa p ON p.ID = h.Pessoa
    LEFT  JOIN Cargo ca ON ca.ID = h.Cargo
    ${FILTRO_MEMBROS}
    ORDER BY
        ${ORDENACAO_POR_CARGO},
        p.Nome
    OFFSET @offset ROWS FETCH NEXT @limite ROWS ONLY
  `,

  CONTAR_MEMBROS: `
    SELECT COUNT(1) AS total
    FROM HistoricoCargo h
    INNER JOIN Pessoa p ON p.ID = h.Pessoa
    ${FILTRO_MEMBROS}
  `,

  // ---------------------------------------------------------------------------
  // COMISSÕES DE UMA PESSOA
  // ---------------------------------------------------------------------------

  /**
   * Vínculos de uma pessoa com comissões.
   *
   * Sem paginação de propósito: o vínculo é por natureza um conjunto pequeno
   * (o recordista do banco tem 6 comissões). Paginar aqui só obrigaria o
   * consumidor a montar um laço para exibir uma lista de meia dúzia de linhas.
   *
   * Ordem: vigentes primeiro, depois os encerrados, ambos do mais recente para
   * o mais antigo.
   */
  LISTAR_COMISSOES_DA_PESSOA: `
    SELECT
        h.ID,
        h.Comissao          AS ComissaoID,
        c.Descricao         AS ComissaoDescricao,
        c.Sigla             AS ComissaoSigla,
        h.Cargo             AS CargoID,
        ca.Descricao        AS CargoDescricao,
        h.CargoComplemento,
        h.DataInicio,
        h.DataFim,
        Vigente = CASE WHEN ${VIGENTE} THEN 1 ELSE 0 END
    FROM HistoricoCargo h
    INNER JOIN Comissao c ON c.ID = h.Comissao
    LEFT  JOIN Cargo ca ON ca.ID = h.Cargo
    WHERE h.Pessoa = @pessoaId
      AND ${E_UMA_COMISSAO}
      AND (@somenteVigentes = 0 OR ${VIGENTE})
    ORDER BY
        CASE WHEN ${VIGENTE} THEN 0 ELSE 1 END,
        h.DataInicio DESC,
        c.Descricao
  `,

  /**
   * Usado para devolver 404 quando o ID não existe — e para identificar a
   * pessoa no corpo da resposta, evitando uma segunda chamada só para pegar
   * o nome.
   */
  BUSCAR_PESSOA_POR_ID: `
    SELECT
        p.ID,
        p.Nome,
        p.RegistroConselho
    FROM Pessoa p
    WHERE p.ID = @id
  `,

  /**
   * Busca pelo número de inscrição na OAB (Pessoa.RegistroConselho).
   *
   * Devolve LISTA, não uma linha: o campo não tem unicidade garantida no
   * legado — há registros repetidos em cadastros diferentes da tabela Pessoa
   * (hoje, 21.885 e outros ~dezenas de casos). Entre os membros de comissão não
   * existe repetição, mas a API não pode depender disso. Quem decide qual
   * cadastro usar é o service (ver `resolverCadastroUnico`).
   *
   * A comparação é NUMÉRICA de propósito: o valor é gravado como varchar e
   * TRY_CAST normaliza espaços e zeros à esquerda dos dois lados, aceitando
   * tanto `29739` quanto `029739` na URL. Linhas com letras no campo viram
   * NULL no TRY_CAST e simplesmente não casam — sem erro de conversão.
   *
   * `totalVinculosComissao` é o critério de desempate e sai daqui para não
   * exigir uma segunda ida ao banco.
   */
  BUSCAR_PESSOAS_POR_REGISTRO_CONSELHO: `
    SELECT
        p.ID,
        p.Nome,
        p.RegistroConselho,
        totalVinculosComissao = (
            SELECT COUNT(1)
            FROM HistoricoCargo h
            INNER JOIN Comissao c ON c.ID = h.Comissao
            WHERE h.Pessoa = p.ID
              AND ${E_UMA_COMISSAO}
        )
    FROM Pessoa p
    WHERE TRY_CAST(NULLIF(LTRIM(RTRIM(p.RegistroConselho)), '') AS BIGINT) = @registro
    ORDER BY p.ID DESC
  `

};
