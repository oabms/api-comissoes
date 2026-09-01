// =============================================================================
// PONTO DE ENTRADA
// =============================================================================
// Responsabilidades deste arquivo (e só estas):
//   1. Subir o servidor HTTP;
//   2. Testar a conexão com o banco antes de aceitar tráfego;
//   3. Encerrar de forma graciosa em SIGINT/SIGTERM (PM2 reload/restart);
//   4. Capturar erros não tratados no nível do processo.
//
// A montagem do Express está em src/app.js.
//
// Observação: `require('./src/config/env')` precisa vir ANTES de qualquer outro
// módulo do projeto — é ele que carrega o .env. Como src/app.js já o importa em
// primeiro lugar na sua própria cadeia, basta manter esta ordem de requires.
// =============================================================================

const env = require('./src/config/env');
const logger = require('./src/config/logger');
const db = require('./src/config/database');
const app = require('./src/app');
const { ENDPOINTS } = require('./src/routes');

let servidor = null;

// -----------------------------------------------------------------------------
// BOOT
// -----------------------------------------------------------------------------

async function iniciar() {
  // Conecta antes de escutar: em produção, subir uma API que não alcança o banco
  // só produz uma fila de 500. Falhar no boot faz o PM2 reiniciar e o deploy
  // aparecer como quebrado, que é o comportamento desejado.
  try {
    await db.connect();
    logger.info('Banco de dados conectado');
  } catch (error) {
    logger.error('Falha na conexão inicial com o banco de dados', {
      error: error.message
    });

    if (env.isProducao) {
      process.exit(1);
    }

    // Fora de produção, segue em frente para permitir desenvolver sem VPN.
    logger.warn('Iniciando mesmo sem banco (ambiente não produtivo)');
  }

  servidor = app.listen(env.porta, () => {
    logger.info('========================================================');
    logger.info(`${env.nomeApi} v${env.versaoApi}`);
    logger.info('========================================================');
    logger.info(`Porta      : ${env.porta}`);
    logger.info(`Ambiente   : ${env.nodeEnv}`);
    logger.info(`Arquivo env: ${env.arquivoEnv}`);
    logger.info(`Banco      : ${env.db.database} @ ${env.db.server}`);
    logger.info(`URL        : http://localhost:${env.porta}${env.prefixoApi}`);
    logger.info('========================================================');

    Object.entries(ENDPOINTS).forEach(([modulo, rotas]) => {
      logger.info(`[${modulo}]`);
      Object.entries(rotas).forEach(([rota, descricao]) => {
        logger.info(`  ${rota.padEnd(34)} - ${descricao}`);
      });
    });

    logger.info('========================================================');
  });

  // Porta ocupada é o erro de boot mais comum — vale a mensagem explícita.
  servidor.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`A porta ${env.porta} já está em uso.`);
    } else {
      logger.error('Erro no servidor HTTP', { error: error.message });
    }

    process.exit(1);
  });
}

// -----------------------------------------------------------------------------
// ENCERRAMENTO GRACIOSO
// -----------------------------------------------------------------------------

let encerrando = false;

async function encerrar(sinal) {
  // PM2 pode mandar SIGINT e SIGTERM em sequência; sem esta guarda o processo
  // tentaria fechar o pool duas vezes.
  if (encerrando) return;
  encerrando = true;

  logger.info(`Sinal ${sinal} recebido. Encerrando...`);

  // Rede de segurança: se alguma conexão HTTP ficar pendurada, derruba mesmo assim.
  const prazo = setTimeout(() => {
    logger.warn('Encerramento excedeu o tempo limite. Forçando saída.');
    process.exit(1);
  }, 10000);

  prazo.unref();

  try {
    if (servidor) {
      // Para de aceitar novas conexões e aguarda as em andamento terminarem.
      await new Promise(resolve => servidor.close(resolve));
    }

    await db.close();

    logger.info('Encerramento concluído.');
    process.exit(0);

  } catch (error) {
    logger.error('Erro durante o encerramento', { error: error.message });
    process.exit(1);
  }
}

process.on('SIGINT', () => encerrar('SIGINT'));
process.on('SIGTERM', () => encerrar('SIGTERM'));

// -----------------------------------------------------------------------------
// ERROS NÃO TRATADOS
// -----------------------------------------------------------------------------

process.on('unhandledRejection', (reason) => {
  // Não derruba o processo: quase sempre é um `await` esquecido em um ponto
  // isolado, e matar a API por isso é pior que registrar e seguir.
  logger.error('Unhandled Rejection', {
    reason: reason?.message || String(reason),
    stack: reason?.stack
  });
});

process.on('uncaughtException', (error) => {
  // Aqui o estado do processo é imprevisível: registra e sai para o PM2
  // reiniciar limpo.
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  encerrar('uncaughtException');
});

iniciar();
