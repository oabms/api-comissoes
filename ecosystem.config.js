// =============================================================================
// PM2 — CONFIGURAÇÃO DE PROCESSO
// =============================================================================
// Subir:      pm2 start ecosystem.config.js --env production
// Atualizar:  pm2 reload ecosystem.config.js --env production   (sem downtime)
// Persistir:  pm2 save
//
// `name` é o que aparece no `pm2 list` e o que distingue os processos no
// servidor — não repita o de outra API.
// =============================================================================

module.exports = {
  apps: [
    {
      name: 'api-comissoes-oabms',
      script: './server.js',

      // Duas instâncias em cluster: aproveita mais de um núcleo e permite
      // reload sem derrubar a API.
      //
      // ATENÇÃO: com mais de uma instância, qualquer estado em memória
      // (cache, contador, sessão) deixa de ser confiável — cada processo tem o
      // seu. Geração de número sequencial precisa ser resolvida no banco, com
      // SEQUENCE ou lock, nunca em variável de módulo.
      instances: 1,
      exec_mode: 'fork',

      watch: false,
      max_memory_restart: '1G',

      // O Winston já grava em logs/ com rotação; estes arquivos do PM2 pegam o
      // que escapa (stdout de crash antes do logger subir).
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      time: true,

      // Tempo que o PM2 espera o encerramento gracioso (ver server.js) antes de
      // matar o processo. Precisa ser maior que o timeout interno de 10s.
      kill_timeout: 12000,

      env: {
        NODE_ENV: 'development'
      },

      env_production: {
        NODE_ENV: 'production',
        // Faz o src/config/env.js carregar .env.producao em vez de .env
        APP_ENV: 'producao'
      }
    }
  ]
};
