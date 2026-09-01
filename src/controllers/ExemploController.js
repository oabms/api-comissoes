const ExemploService = require('../services/exemplo/ExemploService');
const Response = require('../utils/Response');
const { extrairPaginacao } = require('../utils/pagination');

// =============================================================================
// EXEMPLO CONTROLLER — MODELO DE CONTROLLER
// =============================================================================
// O controller é uma camada FINA. Responsabilidades, e só estas:
//
//   1. Ler dados da requisição (params, query, body, req.user);
//   2. Chamar o service;
//   3. Devolver a resposta pelo helper `Response`.
//
// O que NÃO fica aqui: SQL, regra de negócio, try/catch (o `asyncHandler` das
// rotas cuida dos erros) e validação de formato (isso é do validator).
//
// Se um método de controller passou de ~15 linhas, provavelmente há regra de
// negócio vazando para cá — mova para o service.
// =============================================================================

class ExemploController {

  /**
   * GET /api/exemplos?q=texto&ativos=true&page=1&limit=20
   */
  async listar(req, res) {
    const paginacao = extrairPaginacao(req.query);

    const resultado = await ExemploService.listar(
      {
        termo: req.query.q,
        somenteAtivos: req.query.ativos === 'true'
      },
      paginacao
    );

    return Response.paginado(res, resultado, 'Registros encontrados.');
  }

  /**
   * GET /api/exemplos/:id
   *
   * Sem checagem de "não encontrado" aqui: o service lança AppError 404 e o
   * errorHandler devolve a resposta no formato padrão.
   */
  async buscarPorId(req, res) {
    const resultado = await ExemploService.buscarPorId(req.params.id);

    return Response.success(res, resultado, 'Registro encontrado.');
  }

  /**
   * POST /api/exemplos
   */
  async criar(req, res) {
    const resultado = await ExemploService.criar(req.body, req.userId);

    return Response.created(res, resultado, 'Registro criado com sucesso.');
  }

}

module.exports = new ExemploController();
