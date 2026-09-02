const { param, query } = require('express-validator');

// =============================================================================
// PESSOA VALIDATOR
// =============================================================================

class PessoaValidator {

  /**
   * Filtro de vigência, comum aos dois endpoints.
   */
  vigencia() {
    return [
      query('vigentes')
        .optional()
        .isBoolean()
        .withMessage('O parâmetro "vigentes" deve ser true ou false.')
        .toBoolean()
    ];
  }

  listarComissoes() {
    return [
      param('id')
        .isInt({ min: 1 })
        .withMessage('O ID da pessoa deve ser um número inteiro positivo.')
        .toInt(),

      ...this.vigencia()
    ];
  }

  listarComissoesPorOab() {
    return [
      // `allow_leading_zeroes` é o padrão do express-validator, então tanto
      // /oab/29739 quanto /oab/029739 passam — e `.toInt()` normaliza os dois
      // para o mesmo número antes de chegar ao service.
      param('registro')
        .isInt({ min: 1 })
        .withMessage('A inscrição na OAB deve conter apenas números.')
        .toInt(),

      ...this.vigencia()
    ];
  }

}

module.exports = new PessoaValidator();
