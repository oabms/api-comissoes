# API Comissões — manual técnico

Documentação interna: como o projeto é organizado, como rodar, como manter.
Quem vai **consumir** a API deve ler o [README.md](README.md).

---

## Sumário

- [Modelo de dados no legado](#modelo-de-dados-no-legado)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Execução](#execução)
- [Arquitetura](#arquitetura)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Criando um módulo novo](#criando-um-módulo-novo)
- [Contrato de resposta](#contrato-de-resposta)
- [Tratamento de erros](#tratamento-de-erros)
- [Acesso ao banco](#acesso-ao-banco)
- [Autenticação](#autenticação)
- [Paginação](#paginação)
- [Logs](#logs)
- [Deploy](#deploy)
- [Convenções](#convenções)

---

## Modelo de dados no legado

```
Comissao         ID, Descricao, Sigla, InicioVigencia, FimVigencia
HistoricoCargo   ID, Comissao -> Comissao.ID
                     Pessoa   -> Pessoa.ID
                     Cargo    -> Cargo.ID
                     CargoComplemento, DataInicio, DataFim
Pessoa           ID, Nome, RegistroConselho
Cargo            ID, Descricao
```

`HistoricoCargo` é a tabela de vínculos: **uma linha = uma pessoa ocupando um
cargo em uma comissão** a partir de `DataInicio`. Três armadilhas do legado que
o código já trata:

1. **`HistoricoCargo` guarda vínculos que não são de comissão** (subunidade,
   órgão público, colaborador). Nesses casos `Comissao` vem nulo — por isso todo
   filtro parte de `h.Comissao`;

2. **A coluna `Ativo` não indica nada.** Está gravada como `'.'` nos 1.090
   vínculos de comissão. Quem determina se o membro está em exercício é
   `DataFim`: nula (ou futura) = vigente. É essa a regra por trás do campo
   `vigente` e do parâmetro `?vigentes=`;

3. **`Cargo` é FK, não texto.** A descrição ("Presidente de Comissão") vem do
   JOIN com a tabela `Cargo`. Os IDs em uso estão nomeados em
   `comissaoConstants.js`; um cargo novo continua funcionando (o nome vem do
   JOIN), apenas cai no fim da ordenação até ser acrescentado em `ORDEM_CARGO`;

4. **A tabela `Comissao` não guarda só comissões.** Das 167 linhas, 67 são
   estrutura administrativa do conselho e da CAAMS (câmaras seccionais, turmas
   do Tribunal de Ética, gabinetes, assessorias, contabilidade, protocolo) e 9
   são lixo de cadastro — 8 linhas idênticas de "COMISSÃO DESATIVADA" e uma
   "COMISSÃO TESTE". Sobram **89 comissões de verdade**, com 1.049 vínculos
   (1.043 vigentes).

   A coluna `TipoComissao` existe e serviria para separar isso, mas está **nula
   nas 167 linhas**. Restou o nome como critério, e ele é confiável: toda
   comissão começa com "COMISSÃO"/"COMISSAO" — o prefixo é comparado cortado em
   `COMISS` porque há registro gravado sem acento, e cortar antes do acento faz
   os dois casarem sem depender do collation (`SQL_Latin1_General_CP1_CI_AS`,
   *accent-sensitive*).

   É prefixo, não "contém": "COORDENADORIA DAS COMISSÕES" e "SECRETARIA DAS
   COMISSÕES" têm a palavra no nome mas são os setores que administram as
   comissões. O recorte está em `E_UMA_COMISSAO` (queries) e vale para **toda**
   consulta que toca `Comissao` — inclusive a busca por ID, que responde 404
   para uma estrutura administrativa, e a ficha de uma pessoa, que não mostra
   vínculos fora do recorte.

   **Única exceção:** `GET /api/comissoes/ativas` (`LISTAR_COMISSOES_ATIVAS`)
   usa o filtro definido pela área que consome o endpoint — nome *contendo*
   "COMISSÃO" e `CLI_Ativo = 'X'`. Foi uma decisão de negócio, não descuido:
   não "corrija" para `E_UMA_COMISSAO` sem alinhar com quem pediu;

5. **`Pessoa.RegistroConselho` não é único.** É varchar e se repete em 167
   números da base (em geral uma sociedade de advogados e um advogado com o
   mesmo número em séries diferentes). Por isso a busca por OAB devolve LISTA e
   quem decide qual cadastro usar é `resolverCadastroUnico`, no service: um só
   candidato vence; havendo vários, vence o único com vínculo de comissão; se
   mais de um tiver vínculo, a API devolve **409** com a lista, para o consumidor
   escolher pelo ID. Entre os membros de comissão de hoje não há repetição — mas
   a API não depende disso.

---

## Instalação

```bash
npm install
```

Requisitos: Node.js 18+ e acesso de rede ao SQL Server.

---

## Configuração

O projeto trabalha com **dois arquivos de ambiente**, criados à mão na raiz:

| Arquivo        | Quando é carregado        |
| -------------- | ------------------------- |
| `.env`         | padrão (homologação/dev)  |
| `.env.producao`| quando `APP_ENV=producao` |

Nenhum dos dois vai para o Git: eles guardam senha de banco, chaves de API e o
secret do JWT.

**A referência de variáveis é [`src/config/env.js`](src/config/env.js).** Todas
são lidas e validadas ali, com o padrão de cada uma e um comentário explicando
para que serve. **Nenhum outro arquivo do projeto lê `process.env`
diretamente.** Se faltar uma variável obrigatória, a API não sobe: falha no boot
em vez de dar erro obscuro em produção.

Obrigatórias (sem elas a API não sobe):

| Variável | Para quê |
| --- | --- |
| `DB_SERVER`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD` | Conexão com o SQL Server |
| `ALLOWED_API_KEYS` | Chaves aceitas no header `x-api-key`, separadas por vírgula |
| `JWT_SECRET` | Valida o JWT do frontend. **Idêntico** ao da api-register-login |

As demais (porta, pool, CORS, rate limit, logs) são opcionais e têm padrão em
`env.js`. Para gerar uma chave de API:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

---

## Execução

```bash
npm run dev      # nodemon, recarrega ao salvar
npm start        # node server.js
```

Verificação rápida:

```bash
curl http://localhost:5500/api/health
curl http://localhost:5500/api           # catálogo de endpoints
```

---

## Arquitetura

Fluxo de uma requisição:

```
requisição
   │
   ▼
server.js ──► src/app.js
   │            helmet ▸ cors ▸ json ▸ requestLogger ▸ rateLimit
   ▼
src/routes/         define a URL e encadeia os middlewares
   ▼
src/validators/     valida e sanitiza formato (express-validator)
   ▼
middlewares/validate  interrompe com 400 se algo falhou
   ▼
src/controllers/    lê a requisição, chama o service, devolve Response
   ▼
src/services/       REGRA DE NEGÓCIO + mapeamento dos dados
   ▼
src/services/*/queries/   SQL isolado, com parâmetros nomeados
   ▼
DatabaseService     pool, tipagem de parâmetros, transações
   ▼
SQL Server
```

Erros em qualquer ponto sobem pelo `asyncHandler` até o `errorHandler`, que
formata a resposta e registra o log.

**Regra de ouro de cada camada:**

| Camada     | Faz                                                | Não faz                                  |
| ---------- | -------------------------------------------------- | ---------------------------------------- |
| Route      | define URL, ordem dos middlewares                   | lógica                                   |
| Validator  | formato, tipo, tamanho, sanitização                 | consulta ao banco, regra de negócio      |
| Controller | traduz HTTP ⇄ service                               | SQL, regra, `try/catch`                  |
| Service    | regra de negócio, transações, mapeamento            | conhecer `req`/`res`                     |
| Queries    | SQL                                                 | lógica em JavaScript                     |

---

## Estrutura de pastas

```
api-comissoes/
├── server.js                    Boot, graceful shutdown, erros de processo
├── ecosystem.config.js          PM2
│
└── src/
    ├── app.js                   Montagem do Express (separado do listen)
    │
    ├── config/
    │   ├── env.js               Carrega e VALIDA as variáveis de ambiente
    │   ├── database.js          Config do SQL Server + instância singleton
    │   └── logger.js            Winston com rotação diária
    │
    ├── routes/
    │   ├── index.js             Registro dos módulos + catálogo GET /api
    │   ├── healthRoutes.js
    │   ├── comissaoRoutes.js
    │   └── pessoaRoutes.js
    │
    ├── controllers/
    │   ├── HealthController.js
    │   ├── ComissaoController.js
    │   └── PessoaController.js  Visão "por pessoa" do mesmo vínculo
    │
    ├── services/
    │   ├── base/
    │   │   ├── DatabaseService.js   Pool, query tipada, transações
    │   │   └── BaseService.js       Classe base (this.db + logs nomeados)
    │   ├── HealthService.js
    │   └── comissao/
    │       ├── ComissaoService.js      Regra + mapeamento das consultas
    │       ├── queries/comissaoQueries.js
    │       └── constants/comissaoConstants.js   IDs de cargo e hierarquia
    │
    ├── validators/
    │   ├── comissaoValidator.js
    │   └── pessoaValidator.js
    │
    ├── middlewares/
    │   ├── authMiddleware.js    API Key (rotas de negócio) + JWT (rota do front)
    │   ├── rateLimiter.js       Limitador global + fábrica
    │   ├── requestLogger.js     Uma linha por requisição
    │   ├── validate.js          Coletor do express-validator
    │   ├── notFound.js          404 no formato padrão
    │   └── errorHandler.js      Tratamento central (último middleware)
    │
    └── utils/
        ├── Response.js          Contrato único de resposta
        ├── AppError.js          Erros esperados de negócio
        ├── asyncHandler.js      Captura rejeições em rotas async
        ├── pagination.js        OFFSET/FETCH + meta + escape de LIKE
        └── constants.js         HTTP_STATUS, ERROR_CODES, PAGINACAO
```

---

## Criando um módulo novo

O módulo `comissao` é a referência viva do padrão do projeto. Para um domínio
novo, copie a estrutura dele — nesta ordem, sempre de baixo para cima:

| # | Arquivo | Responsabilidade |
|---|---|---|
| 1 | `src/services/<modulo>/constants/<modulo>Constants.js` | Códigos mágicos do legado, com nome e comentário |
| 2 | `src/services/<modulo>/queries/<modulo>Queries.js` | SQL com parâmetros nomeados, nunca concatenado |
| 3 | `src/services/<modulo>/<Modulo>Service.js` | Regra de negócio + mapeamento do recordset (singleton) |
| 4 | `src/controllers/<Modulo>Controller.js` | Camada fina: lê a requisição, chama o service, responde |
| 5 | `src/validators/<modulo>Validator.js` | Formato dos parâmetros (tipo, faixa, sanitização) |
| 6 | `src/routes/<modulo>Routes.js` | `[validator] -> validate -> asyncHandler(controller)` |
| 7 | `src/routes/index.js` | `router.use(...)` + entrada no objeto `ENDPOINTS` |

O passo 7 é o mais esquecido: o objeto `ENDPOINTS` alimenta o catálogo de
`GET /api` e o log de boot. Rota fora dele existe, mas ninguém descobre.

---

## Contrato de resposta

Toda resposta segue o mesmo formato, para que o frontend trate tudo de modo
genérico.

**Sucesso**

```json
{
  "success": true,
  "message": "Membros encontrados.",
  "data": [ ... ],
  "timestamp": "2026-09-01T12:00:00.000Z"
}
```

**Sucesso paginado** (`Response.paginado`)

```json
{
  "success": true,
  "message": "Registros encontrados.",
  "data": [ ... ],
  "meta": {
    "pagina": 1,
    "limite": 20,
    "total": 137,
    "totalPaginas": 7,
    "temProxima": true,
    "temAnterior": false
  },
  "timestamp": "2026-09-01T12:00:00.000Z"
}
```

**Erro**

```json
{
  "success": false,
  "message": "Comissão não encontrada.",
  "code": "NOT_FOUND",
  "timestamp": "2026-09-01T12:00:00.000Z"
}
```

O frontend deve reagir ao campo `code` (estável), nunca ao texto de `message`.

Métodos disponíveis em `Response`: `success`, `paginado`, `created`,
`noContent`, `error`, `badRequest`, `unauthorized`, `forbidden`, `notFound`,
`conflict`.

---

## Tratamento de erros

Controllers **não têm `try/catch`**. O `asyncHandler` encaminha qualquer
rejeição ao `errorHandler`.

- **Erro esperado** (regra de negócio): lance `AppError` no service.
  A mensagem chega ao cliente com o status e o `code` corretos.

  ```js
  throw AppError.naoEncontrado('Comissão não encontrada.');
  throw AppError.conflito('Este advogado já é membro desta comissão.');
  throw new AppError('Prazo de inscrição encerrado.', 422, 'PRAZO_ENCERRADO');
  ```

- **Erro inesperado** (bug, banco fora): deixe subir. O `errorHandler` registra
  o stack e devolve 500 com mensagem genérica, sem vazar nome de tabela,
  servidor ou credencial.

O `errorHandler` ainda traduz automaticamente erros conhecidos: JSON malformado
(400), payload grande demais (422), violação de chave única do SQL Server
(409), violação de FK (400) e timeout de conexão (503).

---

## Acesso ao banco

Use `this.db` dentro de um service (herdado de `BaseService`):

```js
// Lista de linhas
const linhas = await this.db.query(sql, { id: 1 });

// Primeira linha ou null
const linha = await this.db.queryOne(sql, { id: 1 });

// Resultado completo (rowsAffected, múltiplos recordsets)
const resultado = await this.db.execute(sql, { id: 1 });
```

Os parâmetros são **tipados automaticamente** a partir do tipo JavaScript
(`number` → Int/BigInt/Decimal, `boolean` → Bit, `string` → NVarChar, `Date` →
DateTime, `Buffer` → VarBinary). Isso evita o clássico
`Error converting data type nvarchar to bigint`.

**Nunca concatene valor vindo do cliente na string SQL** — use sempre
parâmetros nomeados (`@id`).

**Transações:**

```js
await this.db.transaction(async (exec) => {
  const r = await exec('SELECT NEXT VALUE FOR SEQ_Comissao AS nextId');
  const id = Number(r.recordset[0].nextId);

  await exec('INSERT INTO Comissao (ID, Nome) VALUES (@id, @nome)', { id, nome });

  return id;
});
```

Dentro do callback use **sempre `exec`**. Chamar `this.db.query` ali pega outra
conexão do pool: a operação fica fora da transação e ainda pode travar em
deadlock contra os locks dela.

Sobre **IDs**: o banco é compartilhado com o sistema legado. Gere IDs pela
`SEQUENCE` correspondente, nunca por `MAX(ID)+1` — isso deixa o contador parado
enquanto a tabela avança e faz o legado gravar IDs já usados.

---

## Autenticação

Duas formas:

| Forma   | Header                          | Para quem                       |
| ------- | ------------------------------- | ------------------------------- |
| API Key | `x-api-key: <chave>`            | Chamadas entre APIs internas    |
| JWT     | `Authorization: Bearer <token>` | Frontend, direto do navegador   |

O JWT é emitido pela **api-register-login** e assinado em HS256. O `JWT_SECRET`
desta API **deve ser idêntico** ao dela, senão todo token é rejeitado com 401.

`ALLOWED_API_KEYS` e `JWT_SECRET` são **obrigatórias**: sem qualquer uma das
duas a API não sobe.

**Quem usa o quê** (tudo montado em [`src/routes/index.js`](src/routes/index.js)):

| Rota | Middleware | Aceita |
| --- | --- | --- |
| `/api`, `/api/health` | nenhum | público |
| `/api/comissoes/ativas` | `autenticar` | JWT **ou** x-api-key |
| `/api/comissoes/*`, `/api/pessoas/*` | `autenticarApiKey` | só x-api-key |

A autenticação é aplicada no `router.use` do índice, não rota a rota, para que
uma rota nova já nasça protegida. `/comissoes/ativas` vive em um router à parte
(`rotasFrontend`, em `comissaoRoutes.js`) montado **antes** de `/comissoes`:
assim ela é atendida com `autenticar` e nunca passa pelo `autenticarApiKey`.

Para expor outra rota ao frontend, acrescente-a ao `rotasFrontend` (ou crie um
router equivalente) e monte com `autenticar`. Não troque o middleware do
`router.use('/comissoes', ...)`: isso abriria todas as rotas ao JWT.

Middlewares disponíveis:

```js
const { autenticar, autenticarApiKey, autenticarOpcional } = require('../middlewares/authMiddleware');

autenticarApiKey     // só x-api-key
autenticar           // JWT ou x-api-key (tenta o JWT primeiro)
autenticarOpcional   // preenche req.user se houver credencial, nunca bloqueia
```

Com JWT, o controller tem `req.user`, `req.userId` e `req.tipoAutenticacao`.

---

## Paginação

Toda listagem que pode crescer deve ser paginada.

No controller:

```js
const { extrairPaginacao } = require('../utils/pagination');
const paginacao = extrairPaginacao(req.query);   // { pagina, limite, offset }
```

No service, `OFFSET`/`FETCH` (exige `ORDER BY`) e `COUNT` com o mesmo `WHERE`:

```js
const [linhas, contagem] = await Promise.all([
  this.db.query(queries.LISTAR, { ...filtros, offset: paginacao.offset, limite: paginacao.limite }),
  this.db.queryOne(queries.CONTAR, filtros)
]);

return montarResultadoPaginado(linhas.map(l => this.mapear(l)), Number(contagem.total), paginacao);
```

Query string: `?page=2&limit=50`. O limite máximo é 100 (`PAGINACAO.LIMITE_MAXIMO`).

Ao buscar por texto, passe o termo por `escaparLike()` — sem isso um `?q=%`
provoca varredura de tabela inteira.

---

## Logs

```
logs/
├── application/2026-09-01-application.log   tudo
├── error/2026-09-01-error.log               só erros
└── exceptions/2026-09-01-exceptions.log     uncaughtException / unhandledRejection
```

Rotação diária, compactação em `.gz` e retenção de 30 dias (`LOG_MAX_FILES`).

Dentro de um service, use os métodos herdados — eles prefixam a mensagem com o
nome do service, o que acelera muito o rastreio em produção:

```js
this.logInfo('Membros listados', { comissaoId, total: linhas.length });
this.logWarn('Comissão sem membros', { comissaoId });
this.logError('Falha ao gravar membro', error, { comissaoId });
```

Nunca registre senha, token ou o CPF completo em log.

---

## Deploy

```bash
# no servidor
git pull
npm ci --omit=dev

# primeira vez
pm2 start ecosystem.config.js --env production
pm2 save

# atualizações
pm2 reload ecosystem.config.js --env production
```

O `--env` decide qual configuração sobe:

| Comando | `NODE_ENV` | Arquivo carregado |
| --- | --- | --- |
| `pm2 start ecosystem.config.js --env production` | `production` | `.env.producao` (via `APP_ENV=producao`) |
| `pm2 start ecosystem.config.js` (sem `--env`) | `development` | `.env` |

Em produção, **sempre** passe `--env production`. Sem ele a API sobe como
development, apontando para o banco de homologação do `.env`.

Roda com **1 instância em modo `fork`**. Com uma instância só, o `pm2 reload`
equivale a um restart: a API fica alguns segundos fora durante a atualização.

Se um dia passar para `cluster` com mais instâncias, qualquer estado em memória
(cache, contador, sessão) deixa de ser confiável, pois cada processo tem o seu.
Numeração sequencial precisa ser resolvida no banco, com `SEQUENCE` ou lock
(`WITH (UPDLOCK, HOLDLOCK)`).

---

## Convenções

- **Idioma**: código, comentários e mensagens em português; nomes de colunas
  mantêm o PascalCase do banco legado, mas a API sempre expõe camelCase.
- **Módulos**: CommonJS (`require`/`module.exports`).
- **Indentação**: 2 espaços.
- **Nomes de arquivo**: `PascalCase` para classes (`ComissaoService.js`),
  `camelCase` para os demais (`comissaoRoutes.js`, `comissaoQueries.js`).
- **Services e controllers** são exportados como **instância única**
  (`module.exports = new ComissaoService()`).
- **Comentários** explicam o *porquê*, não o *o quê*. Decisão não óbvia (hint de
  lock, workaround do legado, ordem que importa) merece comentário; getter
  trivial não.
- Ao adicionar uma variável de ambiente: declare em `src/config/env.js`, com
  padrão e um comentário dizendo para que serve. Se for obrigatória, inclua em
  `OBRIGATORIAS` **e** na tabela da seção [Configuração](#configuração).
