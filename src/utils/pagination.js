const { PAGINACAO } = require('./constants');

// =============================================================================
// PAGINAÇÃO
// =============================================================================
// Listagens que podem crescer (membros de comissão, títulos, protocolos) devem
// ser paginadas. Este utilitário padroniza a leitura da query string e o bloco
// `meta` devolvido ao cliente.
//
// No SQL Server, use sempre OFFSET/FETCH — que EXIGE ORDER BY:
//
//   SELECT ...
//   FROM ...
//   ORDER BY p.Nome
//   OFFSET @offset ROWS FETCH NEXT @limite ROWS ONLY
// =============================================================================

/**
 * Lê `page` e `limit` da query string, aplicando limites seguros.
 * Valores inválidos caem no padrão em vez de gerar erro — a validação formal,
 * quando desejada, fica no validator da rota.
 *
 * @param {Object} query - `req.query`
 * @returns {{ pagina: number, limite: number, offset: number }}
 */
const extrairPaginacao = (query = {}) => {
  const paginaBruta = parseInt(query.page ?? query.pagina, 10);
  const limiteBruto = parseInt(query.limit ?? query.limite, 10);

  const pagina = Number.isNaN(paginaBruta) || paginaBruta < 1
    ? PAGINACAO.PAGINA_PADRAO
    : paginaBruta;

  let limite = Number.isNaN(limiteBruto) || limiteBruto < 1
    ? PAGINACAO.LIMITE_PADRAO
    : limiteBruto;

  // Teto para impedir que um cliente peça `?limit=999999` e derrube o banco.
  if (limite > PAGINACAO.LIMITE_MAXIMO) {
    limite = PAGINACAO.LIMITE_MAXIMO;
  }

  return {
    pagina,
    limite,
    offset: (pagina - 1) * limite
  };
};

/**
 * Monta o objeto devolvido por `Response.paginado`.
 *
 * @param {Array}  registros - Linhas da página atual (já mapeadas)
 * @param {number} total     - Total de registros SEM paginação (COUNT)
 * @param {{ pagina: number, limite: number }} paginacao
 */
const montarResultadoPaginado = (registros, total, { pagina, limite }) => {
  const totalPaginas = limite > 0 ? Math.ceil(total / limite) : 0;

  return {
    data: registros,
    meta: {
      pagina,
      limite,
      total,
      totalPaginas,
      temProxima: pagina < totalPaginas,
      temAnterior: pagina > 1
    }
  };
};

/**
 * Escapa os curingas do LIKE (`%`, `_`, `[`) para que a busca por texto trate o
 * termo do usuário como literal.
 *
 * Sem isso, um `?q=%` faz varredura de tabela inteira.
 *
 * @param {string} termo
 * @returns {string} Termo pronto para `LIKE @termo + '%'`
 */
const escaparLike = (termo = '') => termo.replace(/[[%_]/g, match => `[${match}]`);

module.exports = {
  extrairPaginacao,
  montarResultadoPaginado,
  escaparLike
};
