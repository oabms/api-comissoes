// =============================================================================
// ASYNC HANDLER
// =============================================================================
// O Express 4 não captura rejeições de funções `async`: um `throw` dentro de um
// controller assíncrono vira "unhandled rejection" e a requisição fica pendurada
// até o timeout do cliente.
//
// Envolvendo o controller com este wrapper, qualquer erro é encaminhado para o
// `next(err)` e cai no errorHandler — por isso os controllers deste projeto NÃO
// têm try/catch.
//
// Uso obrigatório em TODA rota cujo handler seja `async`:
//
//   router.get('/:id', asyncHandler(ComissaoController.buscarPorId));
// =============================================================================

module.exports = (fn) => (req, res, next) => {
  Promise
    .resolve(fn(req, res, next))
    .catch(next);
};
