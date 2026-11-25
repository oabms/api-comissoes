# API Comissões — OAB/MS

Consulta a composição das comissões da OAB/MS. É uma API **só de leitura**: ela
não cria, não altera e não apaga nada.

Responde a duas perguntas:

- **Quem são os membros de uma comissão?** — com o cargo de cada um e desde
  quando está lá;
- **De quais comissões um advogado participa?** — com o cargo, a data de
  entrada e, se já saiu, a data de saída.

A API trabalha **só com comissões** — as 89 do tipo "COMISSÃO DA MULHER
ADVOGADA", "COMISSÃO DE DIREITO PENAL". Estruturas administrativas do conselho
e da CAAMS (câmaras seccionais, turmas do Tribunal de Ética, gabinetes,
assessorias, secretarias) ficam de fora, mesmo estando na mesma tabela do
sistema antigo. Ver [o que entra e o que não entra](#o-que-entra-e-o-que-não-entra).

> Documentação técnica do projeto (instalação, arquitetura, deploy):
> [DESENVOLVIMENTO.md](DESENVOLVIMENTO.md).

---

## Sumário

- [Começando](#começando)
- [Os endpoints](#os-endpoints)
  - [Listar comissões](#listar-comissões)
  - [Comissões ativas (lista simples)](#comissões-ativas-lista-simples)
  - [Detalhe de uma comissão](#detalhe-de-uma-comissão)
  - [Membros de uma comissão](#membros-de-uma-comissão)
  - [Comissões de um advogado](#comissões-de-um-advogado)
- [Como são as respostas](#como-são-as-respostas)
- [Erros](#erros)
- [Coisas que é bom saber](#coisas-que-é-bom-saber)
- [Perguntas frequentes](#perguntas-frequentes)

---

## Começando

Todos os endpoints de dados são `GET` e **exigem autenticação**. Há duas
formas, e cada endpoint diz qual aceita:

| Forma | Header | Para quem | Onde vale |
| --- | --- | --- | --- |
| Chave de API | `x-api-key: <chave>` | Sistemas e APIs internas (servidor para servidor) | Todos os endpoints |
| Token JWT | `Authorization: Bearer <token>` | Frontend, direto do navegador | Só `GET /api/comissoes/ativas` |

- **Chave de API:** peça à TI. Ela **nunca** deve ir para o código do frontend,
  porque qualquer pessoa a veria pelo navegador.
- **Token JWT:** é o mesmo token que o usuário recebe ao fazer login na
  `api-register-login`. O front só repassa esse token no header.

```bash
# homologação, servidor para servidor
curl -H "x-api-key: SUA_CHAVE" "http://172.29.7.14:47159/api/comissoes?q=jovem"

# frontend (token do usuário logado)
curl -H "Authorization: Bearer SEU_TOKEN" "http://172.29.7.14:47159/api/comissoes/ativas"
```

Sem credencial, ou com credencial inválida, a resposta é `401` (ver
[Erros](#erros)). Para encurtar, os outros exemplos deste documento omitem o
header.

| Ambiente | Endereço base |
| --- | --- |
| Homologação | `http://172.29.7.14:47159/api` |
| Produção | `http://<servidor-de-producao>:5500/api` |

Confirme com a TI os endereços dos dois ambientes antes de publicar.

Duas URLs ajudam a se situar, e são as únicas que não pedem autenticação:

- `GET /api` — lista todos os endpoints disponíveis;
- `GET /api/health` — diz se a API e o banco estão no ar.

---

## Os endpoints

| O que você quer | Chame |
| --- | --- |
| Achar uma comissão pelo nome | `GET /api/comissoes?q=penal` |
| Montar um seletor com todas as comissões ativas | `GET /api/comissoes/ativas` |
| Ver os dados de uma comissão | `GET /api/comissoes/103` |
| Ver quem compõe uma comissão | `GET /api/comissoes/103/membros` |
| Ver as comissões de um advogado (pelo nº da OAB) | `GET /api/pessoas/oab/22531/comissoes` |
| Ver as comissões de um advogado (pelo ID do cadastro) | `GET /api/pessoas/54164/comissoes` |

---

### Listar comissões

```
GET /api/comissoes
```

Use para descobrir o **ID** de uma comissão — é ele que os outros endpoints
pedem.

| Parâmetro | Padrão | Para que serve |
| --- | --- | --- |
| `q` | — | Busca pelo nome. Basta um pedaço: `q=penal` acha "COMISSÃO DE DIREITO PENAL MILITAR". Mínimo de 3 letras |
| `page` | `1` | Página desejada |
| `limit` | `20` | Quantos itens por página (máximo 100) |

```bash
curl "http://172.29.7.14:47159/api/comissoes?q=penal&limit=3"
```

```json
{
  "success": true,
  "message": "Comissões encontradas.",
  "data": [
    {
      "id": 162,
      "descricao": "COMISSÃO DE DIREITO PENAL MILITAR",
      "sigla": "CDPM",
      "inicioVigencia": null,
      "fimVigencia": null,
      "totalMembrosVigentes": 1
    }
  ],
  "meta": {
    "pagina": 1,
    "limite": 3,
    "total": 3,
    "totalPaginas": 1,
    "temProxima": false,
    "temAnterior": false
  }
}
```

`sigla`, `inicioVigencia` e `fimVigencia` costumam vir `null` — o cadastro
antigo não preencheu esses campos para a maioria das comissões. Conte sempre com
`descricao`, que está sempre preenchida.

---

### Comissões ativas (lista simples)

```
GET /api/comissoes/ativas
```

Todas as comissões **ativas** de uma vez, só com `id`, `descricao` e `sigla`,
em ordem alfabética. Não tem paginação nem parâmetros. Feita para preencher um
seletor (combo) no frontend.

É o **único endpoint que aceita o token JWT** do usuário logado, além da chave
de API, então o frontend pode chamá-lo direto do navegador.

```bash
curl -H "Authorization: Bearer SEU_TOKEN" "http://172.29.7.14:47159/api/comissoes/ativas"
```

```js
// no frontend
const resposta = await fetch(`${API_COMISSOES}/comissoes/ativas`, {
  headers: { Authorization: `Bearer ${token}` }
});
const { data } = await resposta.json();   // [{ id, descricao, sigla }, ...]
```

**O que entra:** registros com "COMISSÃO" em qualquer parte do nome **e**
marcados como ativos no cadastro. Esse critério é diferente do usado pelos
outros endpoints (ver [o que entra e o que não entra](#o-que-entra-e-o-que-não-entra)):

- uma comissão cadastrada sem acento ("COMISSAO ...") não aparece aqui;
- um `id` desta lista pode, em casos raros, responder `404` em
  `/api/comissoes/{id}`.

```json
{
  "success": true,
  "message": "Comissões ativas encontradas.",
  "data": [
    { "id": 162, "descricao": "COMISSÃO DE DIREITO PENAL MILITAR", "sigla": "CDPM" }
  ]
}
```

---

### Detalhe de uma comissão

```
GET /api/comissoes/{id}
```

Os mesmos campos da listagem, para uma comissão só.

```bash
curl "http://172.29.7.14:47159/api/comissoes/103"
```

---

### Membros de uma comissão

```
GET /api/comissoes/{id}/membros
```

**Por padrão devolve só quem está em exercício hoje.** Para ver também quem já
saiu, passe `vigentes=false`.

| Parâmetro | Padrão | Para que serve |
| --- | --- | --- |
| `vigentes` | `true` | `false` inclui também os membros que já saíram |
| `cargo` | — | Filtra por um cargo (ex.: `54` = presidente — [tabela abaixo](#os-cargos)) |
| `q` | — | Busca pelo nome da pessoa. Mínimo de 3 letras |
| `page` | `1` | Página desejada |
| `limit` | `20` | Quantos por página (máximo 100) |

A lista já vem **na ordem da mesa diretora**: presidente, vice-presidente,
secretário-geral, secretário-geral adjunto e, por último, os membros — cada
faixa em ordem alfabética. Não precisa reordenar do seu lado.

```bash
curl "http://172.29.7.14:47159/api/comissoes/103/membros"
```

```json
{
  "success": true,
  "message": "Membros encontrados.",
  "data": [
    {
      "id": 2916,
      "pessoa": {
        "id": 59962,
        "nome": "KARINA LOPES KOSCHINSKI CANHETE",
        "registroConselho": "21688"
      },
      "cargo": {
        "id": 54,
        "descricao": "Presidente de Comissão"
      },
      "cargoComplemento": "Presidente de Comissão COMISSÃO DA JOVEM ADVOCACIA",
      "dataInicio": "2022-01-14T00:00:00.000Z",
      "dataFim": null,
      "vigente": true
    }
  ],
  "meta": {
    "pagina": 1,
    "limite": 20,
    "total": 98,
    "totalPaginas": 5,
    "temProxima": true,
    "temAnterior": false
  }
}
```

Leitura dos campos:

| Campo | O que é |
| --- | --- |
| `id` | Identificador da **participação**, não da pessoa. A mesma pessoa em duas comissões tem dois `id` diferentes |
| `pessoa.id` | ID do cadastro da pessoa |
| `pessoa.registroConselho` | Número da inscrição na OAB. Pode vir `null` para quem não é advogado inscrito |
| `cargo.descricao` | Cargo na comissão: "Presidente de Comissão", "Membro de Comissão"… |
| `cargoComplemento` | Texto livre do cadastro antigo, normalmente cargo + nome da comissão. Útil para conferência, não para exibir |
| `dataInicio` | Quando entrou. **Sempre preenchida** |
| `dataFim` | Quando saiu. `null` = ainda está na comissão |
| `vigente` | `true` se está em exercício. É `dataFim` já interpretada para você |

---

### Comissões de um advogado

Duas formas de dizer de quem você está falando — a resposta é idêntica.

```
GET /api/pessoas/oab/{numero-da-oab}/comissoes     ← use esta
GET /api/pessoas/{id}/comissoes
```

Prefira a primeira: o número da OAB é o que você costuma ter em mãos. Zeros à
esquerda são aceitos (`/oab/022531` e `/oab/22531` dão no mesmo).

| Parâmetro | Padrão | Para que serve |
| --- | --- | --- |
| `vigentes` | `false` | `true` devolve só as comissões em que a pessoa está hoje |

Aqui o padrão é o **contrário** do endpoint de membros: devolve o histórico
completo, porque a pergunta costuma ser "por onde essa pessoa passou". As
comissões atuais vêm primeiro, depois as encerradas, da mais recente para a mais
antiga.

Esta resposta **não é paginada** — ninguém participa de comissões o bastante
para isso (o recordista da base tem 6).

```bash
curl "http://172.29.7.14:47159/api/pessoas/oab/22531/comissoes"
```

```json
{
  "success": true,
  "message": "Comissões da pessoa encontradas.",
  "data": {
    "pessoa": {
      "id": 54164,
      "nome": "ORLEY SILVA LOUREIRO",
      "registroConselho": "22531"
    },
    "comissoes": [
      {
        "id": 2797,
        "comissao": {
          "id": 5,
          "descricao": "COMISSÃO DE ASSUNTOS TRIBUTÁRIOS",
          "sigla": "CATRI"
        },
        "cargo": {
          "id": 32,
          "descricao": "Membro de Comissão"
        },
        "cargoComplemento": "Membro de Comissão COMISSÃO DE ASSUNTOS TRIBUTÁRIOS",
        "dataInicio": "2022-03-10T00:00:00.000Z",
        "dataFim": null,
        "vigente": true
      }
    ]
  }
}
```

Uma pessoa que existe no cadastro mas nunca participou de comissão devolve
`200` com `"comissoes": []` — e não um erro.

---

## Como são as respostas

Toda resposta é JSON e tem sempre o mesmo esqueleto, então dá para tratar tudo
de um jeito só.

**Deu certo:**

```json
{
  "success": true,
  "message": "Comissões encontradas.",
  "data": "...",
  "timestamp": "2026-09-02T20:16:53.907Z"
}
```

**Deu errado:**

```json
{
  "success": false,
  "message": "Comissão não encontrada.",
  "code": "NOT_FOUND",
  "timestamp": "2026-09-02T20:16:53.907Z"
}
```

Cheque `success` — ou o status HTTP — antes de ler `data`.

**Listas paginadas** trazem um bloco `meta` a mais:

```json
"meta": {
  "pagina": 1,
  "limite": 20,
  "total": 98,
  "totalPaginas": 5,
  "temProxima": true,
  "temAnterior": false
}
```

`temProxima` evita conta na sua ponta: enquanto for `true`, peça a próxima
página com `?page=2`, `?page=3`…

---

## Erros

| Status | `code` | O que houve | O que fazer |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Parâmetro fora do formato (letra onde se espera número, `limit` acima de 100, busca com menos de 3 letras) | Veja a lista `errors` da resposta: ela diz o campo e o motivo |
| `401` | `NO_TOKEN` | A requisição não trouxe credencial | Envie `x-api-key` (ou o `Bearer`, em `/comissoes/ativas`) |
| `401` | `INVALID_API_KEY` | A chave de API não é aceita | Confira a chave com a TI |
| `401` | `INVALID_TOKEN` | O token JWT é inválido | Faça login de novo para obter outro token |
| `401` | `EXPIRED_TOKEN` | O token JWT expirou | Faça login de novo para obter outro token |
| `404` | `NOT_FOUND` | A comissão ou a pessoa não existe | Confira o ID ou o número da OAB |
| `409` | `CONFLICT` | O número da OAB está em mais de um cadastro (raro, ver abaixo) | Use o `pessoas` da resposta para escolher e repita por ID |
| `429` | `TOO_MANY_REQUESTS` | Excedeu 300 requisições em 15 minutos, pelo mesmo IP | Espere e reduza o ritmo |
| `503` | — | Banco de dados indisponível | Tente de novo; se persistir, avise a TI |

O `400` detalha o que reprovou:

```json
{
  "success": false,
  "message": "Erro de validação.",
  "code": "VALIDATION_ERROR",
  "errors": [
    {
      "campo": "limit",
      "valor": "500",
      "mensagem": "O limite deve estar entre 1 e 100.",
      "local": "query"
    }
  ]
}
```

Trate pelo campo `code`, nunca pelo texto de `message` — o texto pode ser
reescrito, o `code` não muda.

---

## Coisas que é bom saber

### O que entra e o que não entra

O sistema antigo guarda, na mesma tabela, as comissões e a estrutura
administrativa do conselho e da CAAMS. Esta API mostra **só as comissões**:

| Entra (89 registros) | Não entra |
| --- | --- |
| COMISSÃO DA MULHER ADVOGADA | 1ª CÂMARA SECCIONAL |
| COMISSÃO DA ADVOCACIA CRIMINAL | ASSESSORIA ADMINISTRATIVA CAAMS |
| COMISSÃO ESPECIAL DE ENERGIA | GABINETE DO DIRETOR SECRETÁRIO GERAL |
| COMISSÃO TEMPORÁRIA DE ACESSIBILIDADE | TRIBUNAL DE ÉTICA E DISCIPLINA |
| COMISSÃO PERMANENTE DE ENSINO JURÍDICO | CORRESPONDENTE BANCÁRIO, PROTOCOLO, CONTABILIDADE… |

O critério é o nome começar com "COMISSÃO". Ficam de fora também os registros
zerados que o sistema antigo deixa para trás — 8 linhas chamadas "COMISSÃO
DESATIVADA" e uma "COMISSÃO TESTE", nenhuma com membro.

Isso vale para todos os endpoints, não só para a busca. A exceção é
`/api/comissoes/ativas`, que tem critério próprio
([ver](#comissões-ativas-lista-simples)). Nos demais:

- um ID que não seja de comissão responde `404`, como se não existisse;
- na ficha de uma pessoa, aparecem apenas as comissões — quem também tem
  cadeira em um gabinete ou câmara não vê esse vínculo aqui.

### Vigência e os padrões de cada endpoint

**Quem está "vigente".** Um membro é considerado em exercício quando não tem
data de saída (`dataFim: null`) ou quando a data de saída ainda está no futuro.
O campo `vigente` já entrega isso resolvido.

**Os padrões são diferentes nos dois lados**, de propósito:

| Endpoint | Padrão | Por quê |
| --- | --- | --- |
| `/comissoes/{id}/membros` | só os **atuais** | A pergunta normal é "quem está na comissão hoje" |
| `/pessoas/.../comissoes` | **histórico completo** | A pergunta normal é "por onde essa pessoa passou" |

Em qualquer um dos dois, `?vigentes=true` ou `?vigentes=false` manda no
resultado.

### Os cargos

O `cargo.descricao` vem pronto na resposta; a tabela abaixo serve para quando
você quiser **filtrar** por cargo com `?cargo=`.

| ID | Cargo |
| --- | --- |
| `54` | Presidente de Comissão |
| `55` | Vice-Presidente de Comissão |
| `56` | Secretário(a) Geral de Comissão |
| `57` | Secretário(a) Geral Adjunto de Comissão |
| `38` | Conselheiro(a) Estadual |
| `33` | Vice-presidente de Seccional |
| `72` | Relator - Pleno |
| `32` | Membro de Comissão |
| `59` | Membro |

Um cargo novo pode aparecer com o tempo: a API continua devolvendo o nome dele
normalmente, então não trave sua tela nessa lista.

---

## Perguntas frequentes

**Busquei por "câmara", "gabinete" ou "assessoria" e não veio nada. Sumiu?**
Não: essas são estruturas administrativas do conselho, e a API só trabalha com
comissões. Se você precisa da composição de uma delas, fale com a TI — é outra
consulta, fora do escopo desta API.

**Uma comissão que eu conheço não aparece na listagem. Por quê?**
Confira o nome no sistema: entram os registros cujo nome começa com "COMISSÃO".
Se o nome estiver cadastrado de outro jeito, a comissão fica de fora — avise a
TI para corrigir o cadastro.

**Como acho o ID de uma comissão?**
Busque pelo nome: `GET /api/comissoes?q=tributário`. O `id` do resultado é o que
os outros endpoints pedem.

**Preciso do ID interno da pessoa?**
Não. Use `GET /api/pessoas/oab/{numero}/comissoes` com o número da OAB.

**Por que uma comissão diz `totalMembrosVigentes: 0`?**
Ela existe no cadastro, mas ninguém está vinculado a ela no momento. Chamar
`/membros` com `vigentes=false` mostra se já houve alguém.

**A comissão existe, mas `/membros` veio vazio. É erro?**
Não. Comissão inexistente devolve `404`; lista vazia com `200` quer dizer
"existe e está sem membros" — e as duas coisas são distinguíveis de propósito.

**Recebi `409` consultando por OAB. O que é isso?**
O cadastro antigo tem alguns números de inscrição repetidos em pessoas
diferentes (normalmente uma sociedade de advogados e um advogado). Quando os
dois participam de comissões, a API não adivinha qual você quer: ela devolve a
lista em `pessoas` para você escolher e repetir a consulta por
`/api/pessoas/{id}/comissoes`. Na base de hoje isso não acontece com nenhum
membro de comissão.

**Por que `registroConselho` vem `null` para alguns membros?**
Nem todo membro é advogado inscrito — há convidados e representantes de outras
instituições. Hoje, 799 dos 817 membros têm o número preenchido (98%).

**As datas vêm em que fuso?**
Em UTC, no formato ISO (`2022-03-10T00:00:00.000Z`). No cadastro só a data
importa; a hora é sempre zero.

**Posso usar a chave de API no frontend?**
Não. Tudo o que vai para o navegador fica visível para qualquer usuário, e com
a chave dá para consultar todos os endpoints. No frontend, use o token JWT do
usuário logado em `/api/comissoes/ativas`. Se precisar de outro dado, peça a
consulta ao seu backend, que guarda a chave.

**Tem limite de uso?**
300 requisições a cada 15 minutos por IP. Passando disso vem `429` — os
cabeçalhos `RateLimit-*` da resposta dizem quanto ainda resta.
