/* =============================================================================
   USUÁRIO DE BANCO DA api-comissoes
   =============================================================================
   Execute conectado ao banco alvo:
     Homologação: 172.29.7.7  -> HBConselhoshml
     Produção:    172.29.7.20 -> HBConselhos

   Troque a senha abaixo e depois atualize DB_USER / DB_PASSWORD no .env.
   ============================================================================= */

-- Login (nível de servidor)
CREATE LOGIN [api_comissoes]
    WITH PASSWORD = N'SENHA',
         CHECK_EXPIRATION = OFF,
         CHECK_POLICY = ON;
GO

-- Usuário no banco
CREATE USER [api_comissoes] FOR LOGIN [api_comissoes] WITH DEFAULT_SCHEMA = [dbo];
GO

-- Permissões: a API só lê estas 4 tabelas
GRANT SELECT ON dbo.Comissao       TO [api_comissoes];
GRANT SELECT ON dbo.HistoricoCargo TO [api_comissoes];
GRANT SELECT ON dbo.Pessoa         TO [api_comissoes];
GRANT SELECT ON dbo.Cargo          TO [api_comissoes];
GO
