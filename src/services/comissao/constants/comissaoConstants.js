// =============================================================================
// CONSTANTES DE NEGÓCIO DO MÓDULO COMISSÃO
// =============================================================================
// Os IDs abaixo foram levantados diretamente do banco (HBConselhos), cruzando
// HistoricoCargo com a tabela Cargo:
//
//   SELECT c.ID, c.Descricao, COUNT(h.ID)
//   FROM Cargo c
//   JOIN HistoricoCargo h ON h.Cargo = c.ID AND h.Comissao IS NOT NULL
//   GROUP BY c.ID, c.Descricao
//
// Só entram aqui os cargos que de fato aparecem vinculados a uma comissão. Se
// o cadastro passar a usar um cargo novo, ele continua funcionando na API (o
// nome vem do JOIN com Cargo) — apenas cairá no fim da ordenação até ser
// acrescentado em ORDEM_CARGO.
// =============================================================================

/**
 * Flags booleanas do legado: 'X' = verdadeiro, '.' = falso.
 *
 * ATENÇÃO: em HistoricoCargo a coluna `Ativo` está gravada como '.' em
 * TODOS os 1.090 registros de comissão — ela não distingue membro atual de
 * membro encerrado. Quem determina isso é `DataFim` (ver VIGENTE nas queries).
 * Por isso a API não filtra por `Ativo`.
 */
const FLAG = {
  SIM: 'X',
  NAO: '.'
};

/**
 * IDs da tabela Cargo usados em comissões.
 */
const CARGO = {
  MEMBRO_DE_COMISSAO: 32,
  VICE_PRESIDENTE_SECCIONAL: 33,
  CONSELHEIRO_ESTADUAL: 38,
  PRESIDENTE_DE_COMISSAO: 54,
  VICE_PRESIDENTE_DE_COMISSAO: 55,
  SECRETARIO_GERAL_DE_COMISSAO: 56,
  SECRETARIO_GERAL_ADJUNTO_DE_COMISSAO: 57,
  MEMBRO: 59,
  RELATOR_PLENO: 72
};

/**
 * Hierarquia usada para ordenar a listagem de membros de uma comissão: a
 * posição no array define a ordem (presidente primeiro, membros por último).
 *
 * Quem consome a API espera ver a mesa diretora no topo, não uma lista
 * alfabética em que o presidente aparece na página 3.
 */
const ORDEM_CARGO = [
  CARGO.PRESIDENTE_DE_COMISSAO,
  CARGO.VICE_PRESIDENTE_DE_COMISSAO,
  CARGO.SECRETARIO_GERAL_DE_COMISSAO,
  CARGO.SECRETARIO_GERAL_ADJUNTO_DE_COMISSAO,
  CARGO.VICE_PRESIDENTE_SECCIONAL,
  CARGO.CONSELHEIRO_ESTADUAL,
  CARGO.RELATOR_PLENO,
  CARGO.MEMBRO_DE_COMISSAO,
  CARGO.MEMBRO
];

/**
 * Converte a flag do legado ('X'/'.') em booleano.
 */
const flagParaBooleano = (valor) => String(valor || '').trim().toUpperCase() === FLAG.SIM;

module.exports = {
  FLAG,
  CARGO,
  ORDEM_CARGO,
  flagParaBooleano
};
