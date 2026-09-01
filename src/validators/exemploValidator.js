const { param, query, body } = require('express-validator');

const { PAGINACAO } = require('../utils/constants');

// =============================================================================
// EXEMPLO VALIDATOR — MODELO DE VALIDATOR
// =============================================================================
// Cada método devolve um ARRAY de regras do express-validator, aplicado na rota
// antes do middleware `validate`:
//
//   router.get('/:id', ExemploValidator.buscarPorId(), validate, asyncHandler(...));
//
// O validator cuida de FORMATO (obrigatório, tipo, tamanho, sanitização).
// Regra de negócio ("essa comissão já tem presidente") é do service.
//
// Sanitizar aqui evita repetição no service: quando a requisição chega ao
// controller, o CPF já veio só com dígitos e o texto já veio sem espaços nas
// pontas.
// =============================================================================

class ExemploValidator {

  /**
   * Regras reaproveitáveis de paginação — inclua em toda rota de listagem.
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
        .withMessage('Informe ao menos 3 caracteres para buscar.'),

      query('ativos')
        .optional()
        .isBoolean()
        .withMessage('O parâmetro "ativos" deve ser true ou false.')
    ];
  }

  buscarPorId() {
    return [
      param('id')
        .isInt({ min: 1 })
        .withMessage('O ID deve ser um número inteiro positivo.')
        .toInt()
    ];
  }

  criar() {
    return [
      body('descricao')
        .trim()
        .notEmpty()
        .withMessage('A descrição é obrigatória.')
        .isLength({ max: 200 })
        .withMessage('A descrição deve ter no máximo 200 caracteres.'),

      body('ativo')
        .optional()
        .isBoolean()
        .withMessage('O campo "ativo" deve ser true ou false.')
        .toBoolean()
    ];
  }

}

module.exports = new ExemploValidator();
