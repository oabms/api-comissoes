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
 * A tabela `Comissao` não guarda só comissões: das 167 linhas, 67 são
 * estruturas administrativas do conselho e da CAAMS — câmaras julgadoras,
 * turmas do Tribunal de Ética, gabinetes, secretarias, contabilidade,
 * "CORRESPONDENTE BANCÁRIO", "1ª CÂMARA SECCIONAL". A coluna `TipoComissao`
 * existe e serviria para separar isso, mas está nula nas 167 linhas.
 *
 * Sobrou o nome como critério, e ele é confiável: TODA comissão de verdade
 * começa com "COMISSÃO"/"COMISSAO".
 *
 * O prefixo é comparado sem o "ÃO" de propósito: há registro gravado sem
 * acento ("COMISSAO DE ADMISSIBILIDADE"), e cortar antes do acento faz os dois
 * casarem sem depender do collation.
 *
 * Repare que é PREFIXO, não "contém": "COORDENADORIA DAS COMISSÕES" e
 * "SECRETARIA DAS COMISSÕES" têm a palavra no nome, mas são setores que
 * administram as comissões — não comissões.
 */
const PREFIXO_DESCRICAO_COMISSAO = 'COMISS';

/**
 * Descrições que passam pelo prefixo mas não são comissões utilizáveis:
 * 8 linhas idênticas de "COMISSÃO DESATIVADA" (registros esvaziados quando uma
 * comissão é encerrada) e um "COMISSÃO TESTE". Nenhuma tem membro algum.
 *
 * A comparação é exata — uma comissão real jamais se chamará assim.
 */
const DESCRICOES_IGNORADAS = [
  'COMISSÃO DESATIVADA',
  'COMISSÃO TESTE'
];

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
  PREFIXO_DESCRICAO_COMISSAO,
  DESCRICOES_IGNORADAS,
  FLAG,
  CARGO,
  ORDEM_CARGO,
  flagParaBooleano
};
