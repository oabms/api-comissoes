# API Boilerplate — OAB/MS

Ponto de partida padrão para as APIs Node.js + SQL Server da OAB/MS.

Consolida os padrões já usados em `api-endereco`, `api-protocolo`,
`api-register-login`, `api-anexo-ged`, `api-portes` e `api-gerador-titulos`:
arquitetura em camadas, respostas padronizadas, tratamento central de erros,
logs com rotação, autenticação por JWT/API Key e deploy com PM2.

---

## Sumário

- [Como começar uma API nova](#como-começar-uma-api-nova)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Execução](#execução)
- [Arquitetura](#arquitetura)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Criando um módulo em 5 passos](#criando-um-módulo-em-5-passos)
- [Contrato de resposta](#contrato-de-resposta)
- [Tratamento de erros](#tratamento-de-erros)
- [Acesso ao banco](#acesso-ao-banco)
- [Autenticação](#autenticação)
- [Paginação](#paginação)
- [Logs](#logs)
- [Deploy](#deploy)
- [Convenções](#convenções)

---

## Como começar uma API nova

```bash
# 1. Copie a pasta
cp -r api-boilerplate api-comissoes
cd api-comissoes

# 2. Ajuste a identidade do projeto
#    - package.json    -> name, description, keywords
#    - ecosystem.config.js -> apps[0].name
#    - .env            -> API_NAME, PORT, credenciais do banco

# 3. Instale
npm install

# 4. Renomeie o módulo de exemplo para o seu domínio
#    (ver "Criando um módulo em 5 passos")

# 5. Rode
npm run dev
```

O módulo `exemplo` existe para ser copiado e depois **apagado**. Ele demonstra
listagem paginada com busca, detalhe por ID e criação transacional — que é
exatamente o formato de uma API de comissões (listar comissões, detalhar uma,
listar membros).

---

## Instalação

```bash
npm install
```

Requisitos: Node.js 18+ e acesso de rede ao SQL Server.

---

## Configuração

Copie `.env.example` para `.env` e preencha:

```bash
cp .env.example .env
```

O projeto trabalha com **dois arquivos de ambiente**:

| Arquivo        | Quando é carregado        |
| -------------- | ------------------------- |
| `.env`         | padrão (homologação/dev)  |
| `.env.producao`| quando `APP_ENV=producao` |

Nenhum dos dois vai para o Git — somente `.env.example`.

Todas as variáveis são lidas e validadas em [`src/config/env.js`](src/config/env.js).
**Nenhum outro arquivo do projeto lê `process.env` diretamente.** Se faltar uma
variável obrigatória, a API não sobe — falha no boot em vez de erro obscuro em
produção.

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
api-boilerplate/
├── server.js                    Boot, graceful shutdown, erros de processo
├── ecosystem.config.js          PM2
├── .env.example                 Modelo de configuração (versionado)
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
    │   └── exemploRoutes.js     ← modelo
    │
    ├── controllers/
    │   ├── HealthController.js
    │   └── ExemploController.js ← modelo
    │
    ├── services/
    │   ├── base/
    │   │   ├── DatabaseService.js   Pool, query tipada, transações
    │   │   └── BaseService.js       Classe base (this.db + logs nomeados)
    │   ├── HealthService.js
    │   └── exemplo/                 ← modelo de módulo
    │       ├── ExemploService.js
    │       ├── queries/exemploQueries.js
    │       └── constants/exemploConstants.js
    │
    ├── validators/
    │   └── exemploValidator.js  ← modelo
    │
    ├── middlewares/
    │   ├── authMiddleware.js    JWT + API Key
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

## Criando um módulo em 5 passos

Exemplo: módulo `comissao`.

**1. Queries** — `src/services/comissao/queries/comissaoQueries.js`

```js
module.exports = {
  LISTAR_MEMBROS: `
    SELECT m.ID, p.Nome, c.Descricao AS Comissao, m.Cargo
    FROM MembroComissao m
    INNER JOIN Pessoa p   ON m.Pessoa  = p.ID
    INNER JOIN Comissao c ON m.Comissao = c.ID
    WHERE m.Comissao = @comissaoId
    ORDER BY p.Nome
  `
};
```

**2. Service** — `src/services/comissao/ComissaoService.js`

```js
const BaseService = require('../base/BaseService');
const queries = require('./queries/comissaoQueries');
const AppError = require('../../utils/AppError');

class ComissaoService extends BaseService {
  constructor() {
    super('ComissaoService');
  }

  mapearMembro(linha) {
    return {
      id: Number(linha.ID),
      nome: linha.Nome,
      comissao: linha.Comissao,
      cargo: linha.Cargo
    };
  }

  async listarMembros(comissaoId) {
    const linhas = await this.db.query(queries.LISTAR_MEMBROS, {
      comissaoId: Number(comissaoId)
    });

    if (!linhas.length) {
      throw AppError.naoEncontrado('Comissão sem membros ou inexistente.');
    }

    return linhas.map(linha => this.mapearMembro(linha));
  }
}

module.exports = new ComissaoService();
```

**3. Controller** — `src/controllers/ComissaoController.js`

```js
const ComissaoService = require('../services/comissao/ComissaoService');
const Response = require('../utils/Response');

class ComissaoController {
  async listarMembros(req, res) {
    const membros = await ComissaoService.listarMembros(req.params.id);
    return Response.success(res, membros, 'Membros encontrados.');
  }
}

module.exports = new ComissaoController();
```

**4. Validator** — `src/validators/comissaoValidator.js`

```js
const { param } = require('express-validator');

class ComissaoValidator {
  listarMembros() {
    return [
      param('id')
        .isInt({ min: 1 })
        .withMessage('O ID da comissão deve ser um número inteiro positivo.')
        .toInt()
    ];
  }
}

module.exports = new ComissaoValidator();
```

**5. Rotas** — `src/routes/comissaoRoutes.js` e registro no índice

```js
const express = require('express');
const ComissaoController = require('../controllers/ComissaoController');
const ComissaoValidator = require('../validators/comissaoValidator');
const validate = require('../middlewares/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get(
  '/:id/membros',
  ComissaoValidator.listarMembros(),
  validate,
  asyncHandler(ComissaoController.listarMembros)
);

module.exports = router;
```

Em `src/routes/index.js`:

```js
const comissaoRoutes = require('./comissaoRoutes');
router.use('/comissoes', comissaoRoutes);
```

...e adicione a rota ao objeto `ENDPOINTS` do mesmo arquivo, que alimenta o
catálogo em `GET /api` e o log de boot.

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

Duas formas, aceitas nesta ordem:

| Forma   | Header                          | Para quem                       |
| ------- | ------------------------------- | ------------------------------- |
| JWT     | `Authorization: Bearer <token>` | Frontend / portal               |
| API Key | `x-api-key: <chave>`            | Chamadas entre APIs internas    |

O JWT é emitido pela **api-register-login** e assinado em HS256. O `JWT_SECRET`
desta API **deve ser idêntico** ao dela, senão todo token é rejeitado com 401.

Nas rotas:

```js
const { autenticar, autenticarOpcional } = require('../middlewares/authMiddleware');

router.post('/', autenticar, ...);          // exige credencial válida
router.get('/', autenticarOpcional, ...);   // preenche req.user se houver, nunca bloqueia
```

Dentro do controller ficam disponíveis `req.user`, `req.userId` e
`req.tipoAutenticacao`.

Se a API for **totalmente pública**, basta não usar o middleware — deixe
`JWT_SECRET` e `ALLOWED_API_KEYS` vazios.

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

# atualizações (sem downtime)
pm2 reload ecosystem.config.js --env production
```

`--env production` define `NODE_ENV=production` e `APP_ENV=producao`, fazendo a
API carregar o `.env.producao`.

Roda em **cluster com 2 instâncias**. Consequência prática: qualquer estado em
memória (cache, contador, sessão) deixa de ser confiável, pois cada processo tem
o seu. Numeração sequencial precisa ser resolvida no banco, com `SEQUENCE` ou
lock (`WITH (UPDLOCK, HOLDLOCK)`).

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
- Ao adicionar uma variável de ambiente: declare em `src/config/env.js` **e**
  documente em `.env.example`.
