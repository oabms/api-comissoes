const { param, query } = require('express-validator');

const { PAGINACAO } = require('../utils/constants');

// =============================================================================
// COMISSÃO VALIDATOR
// =============================================================================
// Só FORMATO (tipo, faixa, sanitização). Existência da comissão, do cargo ou da
// pessoa é responsabilidade do service — ele é quem devolve 404.
// =============================================================================

class ComissaoValidator {

  /**
   * Regras reaproveitáveis de paginação.
   */
  paginacao() {
    return [
      query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('A página deve ser um número inteiro maior que zero.')
        .toInt(),

      query('limit')
        .optional()
        .isInt({ min: 1, max: PAGINACAO.LIMITE_MAXIMO })
        .withMessage(`O limite deve estar entre 1 e ${PAGINACAO.LIMITE_MAXIMO}.`)
        .toInt()
    ];
  }

  listar() {
    return [
      ...this.paginacao(),

      query('q')
        .optional()
        .trim()
        .isLength({ min: 3 })
        .withMessage('Informe ao menos 3 caracteres para buscar.')
    ];
  }

  buscarPorId() {
    return [
      param('id')
        .isInt({ min: 1 })
        .withMessage('O ID da comissão deve ser um número inteiro positivo.')
        .toInt()
    ];
  }

  listarMembros() {
    return [
      ...this.buscarPorId(),
      ...this.paginacao(),

      query('vigentes')
        .optional()
        .isBoolean()
        .withMessage('O parâmetro "vigentes" deve ser true ou false.')
        .toBoolean(),

      query('cargo')
        .optional()
        .isInt({ min: 1 })
        .withMessage('O cargo deve ser o ID numérico do cargo.')
        .toInt(),

      query('q')
        .optional()
        .trim()
        .isLength({ min: 3 })
        .withMessage('Informe ao menos 3 caracteres para buscar pelo nome.')
    ];
  }

}

module.exports = new ComissaoValidator();
