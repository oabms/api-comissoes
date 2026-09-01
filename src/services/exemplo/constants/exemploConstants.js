// =============================================================================
// CONSTANTES DE NEGÓCIO DO MÓDULO EXEMPLO
// =============================================================================
// O banco legado usa códigos "mágicos" em quase toda tabela: situações como
// '1'/'3'/'9', flags booleanas gravadas como 'X' (verdadeiro) e '.' (falso),
// FKs fixas para departamento/serviço.
//
// Nunca espalhe esses literais pelo código — dê nome a eles aqui e comente o
// que cada um significa. Foi assim que api-protocolo manteve legível a
// integração com o sistema antigo.
// =============================================================================

module.exports = {

  /**
   * Flags booleanas do legado.
   * O banco não usa BIT nessas colunas: grava o caractere 'X' para verdadeiro
   * e '.' para falso.
   */
  FLAG: {
    SIM: 'X',
    NAO: '.'
  },

  SITUACAO: {
    ATIVO: '1',
    INATIVO: '9'
  },

  /**
   * Converte a flag do legado ('X'/'.') em booleano de verdade, para que a API
   * devolva `true`/`false` ao frontend em vez de vazar o formato interno.
   */
  flagParaBooleano: (valor) => String(valor || '').trim().toUpperCase() === 'X'

};
