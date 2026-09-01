const HealthService = require('../services/HealthService');
const Response = require('../utils/Response');
const { HTTP_STATUS, ERROR_CODES } = require('../utils/constants');

class HealthController {

  /**
   * GET /api/health
   *
   * Devolve 200 quando a API e o banco estão OK e 503 quando o banco está fora —
   * o status HTTP importa mais que o corpo aqui, porque é ele que o
   * monitoramento e o balanceador observam.
   */
  async health(req, res) {
    const resultado = await HealthService.status();

    if (resultado.status !== 'UP') {
      return Response.error(
        res,
        'API disponível, porém sem acesso ao banco de dados.',
        HTTP_STATUS.SERVICE_UNAVAILABLE,
        ERROR_CODES.INTERNAL_ERROR,
        { data: resultado }
      );
    }

    return Response.success(res, resultado, 'API disponível.');
  }

}

module.exports = new HealthController();
