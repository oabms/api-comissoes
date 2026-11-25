const ComissaoService = require('../services/comissao/ComissaoService');
const Response = require('../utils/Response');
const { extrairPaginacao } = require('../utils/pagination');

// =============================================================================
// COMISSÃO CONTROLLER
// =============================================================================
// Camada fina: lê a requisição, chama o service, devolve pelo `Response`.
// Nada de SQL, regra de negócio ou try/catch aqui.
// =============================================================================

class ComissaoController {

  /**
   * GET /api/comissoes?q=penal&page=1&limit=20
   */
  async listar(req, res) {
    const paginacao = extrairPaginacao(req.query);

    const resultado = await ComissaoService.listar(
      { termo: req.query.q },
      paginacao
    );

    return Response.paginado(res, resultado, 'Comissões encontradas.');
  }

  /**
   * GET /api/comissoes/ativas
   */
  async listarAtivas(req, res) {
    const resultado = await ComissaoService.listarAtivas();

    return Response.success(res, resultado, 'Comissões ativas encontradas.');
  }

  /**
   * GET /api/comissoes/:id
   */
  async buscarPorId(req, res) {
    const resultado = await ComissaoService.buscarPorId(req.params.id);

    return Response.success(res, resultado, 'Comissão encontrada.');
  }

  /**
   * GET /api/comissoes/:id/membros?vigentes=false&cargo=54&q=maria&page=1&limit=20
   *
   * `vigentes` é tri-estado: ausente vale `true` (o caso de uso normal é ver a
   * composição atual); só quem quer o histórico completo passa `vigentes=false`.
   */
  async listarMembros(req, res) {
    const paginacao = extrairPaginacao(req.query);

    const resultado = await ComissaoService.listarMembros(
      req.params.id,
      {
        somenteVigentes: req.query.vigentes === undefined ? true : Boolean(req.query.vigentes),
        cargoId: req.query.cargo,
        termo: req.query.q
      },
      paginacao
    );

    return Response.paginado(res, resultado, 'Membros encontrados.');
  }

}

module.exports = new ComissaoController();
