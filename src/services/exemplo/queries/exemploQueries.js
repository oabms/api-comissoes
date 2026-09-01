// =============================================================================
// QUERIES DO MÓDULO EXEMPLO
// =============================================================================
// Por que as queries ficam separadas do service:
//
//   1. O service passa a mostrar a REGRA (o que faz, em que ordem), sem 60
//      linhas de SQL no meio;
//   2. Fica fácil rodar a query direta no SSMS ao investigar um problema;
//   3. Reaproveitamento entre métodos (listar e contar usam o mesmo WHERE).
//
// Regras:
//   - Nome da constante em MAIÚSCULAS, descrevendo a ação;
//   - SEMPRE parâmetros nomeados (@id, @termo). Nunca concatene valor vindo do
//     cliente na string — é SQL Injection na hora;
//   - Comente decisões não óbvias (hints de lock, JOINs de tabela legada,
//     colunas com nome enganoso).
// =============================================================================

module.exports = {

  /**
   * Lista paginada. O ORDER BY é obrigatório: OFFSET/FETCH do SQL Server não
   * funciona sem ele.
   */
  LISTAR: `
    SELECT
        e.ID,
        e.Descricao,
        e.Ativo,
        e.CreatedOn
    FROM Exemplo e
    WHERE (@somenteAtivos = 0 OR e.Ativo = 'X')
      AND (@termo IS NULL OR e.Descricao LIKE @termo + '%')
    ORDER BY e.Descricao
    OFFSET @offset ROWS FETCH NEXT @limite ROWS ONLY
  `,

  /**
   * Total de registros do MESMO filtro do LISTAR — usado para montar o `meta`
   * da paginação. Mantenha os dois WHERE sincronizados.
   */
  CONTAR: `
    SELECT COUNT(1) AS total
    FROM Exemplo e
    WHERE (@somenteAtivos = 0 OR e.Ativo = 'X')
      AND (@termo IS NULL OR e.Descricao LIKE @termo + '%')
  `,

  BUSCAR_POR_ID: `
    SELECT
        e.ID,
        e.Descricao,
        e.Ativo,
        e.CreatedOn,
        e.UpdatedOn
    FROM Exemplo e
    WHERE e.ID = @id
  `,

  // ---------------------------------------------------------------------------
  // ESCRITA
  // ---------------------------------------------------------------------------
  // O banco é compartilhado com o sistema legado, que gera os IDs a partir das
  // mesmas SEQUENCEs. Por isso o ID vem SEMPRE da SEQUENCE — nunca de MAX(ID)+1,
  // que deixaria o contador parado enquanto a tabela avança e faria o legado
  // gravar IDs já usados (violação de PK do lado dele).
  PROXIMO_ID: `
    SELECT NEXT VALUE FOR SEQ_Exemplo AS nextId
  `,

  INSERIR: `
    INSERT INTO Exemplo (ID, Descricao, Ativo, CreatedBy, CreatedOn)
    VALUES (@id, @descricao, @ativo, @createdBy, GETDATE())
  `

};
