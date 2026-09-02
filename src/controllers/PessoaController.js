const ComissaoService = require('../services/comissao/ComissaoService');
const Response = require('../utils/Response');

// =============================================================================
// PESSOA CONTROLLER
// =============================================================================
// Existe apenas para expor a visão "por pessoa" do mesmo vínculo que o módulo
// de comissão já modela (HistoricoCargo). Por isso ele reaproveita o
// ComissaoService em vez de criar um PessoaService: a regra é a mesma, muda só
// o lado pelo qual se olha o vínculo.
// =============================================================================

class PessoaController {

  /**
   * GET /api/pessoas/:id/comissoes?vigentes=true
   *
   * Diferente da listagem de membros, aqui o padrão é devolver TODO o histórico
   * (vigentes primeiro): quem consulta uma pessoa geralmente quer a ficha
   * completa, com data de início e de fim de cada passagem.
   */
  async listarComissoes(req, res) {
    const resultado = await ComissaoService.listarComissoesDaPessoa(
      req.params.id,
      { somenteVigentes: Boolean(req.query.vigentes) }
    );

    return Response.success(res, resultado, 'Comissões da pessoa encontradas.');
  }

  /**
   * GET /api/pessoas/oab/:registro/comissoes?vigentes=true
   *
   * Mesma resposta do endpoint acima, identificando a pessoa pelo número de
   * inscrição na OAB — que é o identificador que quem consome a API tem em
   * mãos, ao contrário do ID interno do cadastro.
   */
  async listarComissoesPorOab(req, res) {
    const resultado = await ComissaoService.listarComissoesPorRegistroConselho(
      req.params.registro,
      { somenteVigentes: Boolean(req.query.vigentes) }
    );

    return Response.success(res, resultado, 'Comissões da pessoa encontradas.');
  }

}

module.exports = new PessoaController();
