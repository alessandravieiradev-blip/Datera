# ETL MySQL → Google Sheets

Automação em TypeScript que lê dados de uma tabela ou view do MySQL e exporta para uma planilha do Google Sheets, com opções de tratamento dos dados antes da escrita.

## Instalação

```bash
npm install
```

## Configuração

O projeto usa três arquivos que não vão pro git. Copie os exemplos e preencha com dados reais:

```bash
cp .env.example .env
cp credentials.json.example credentials.json
cp config.json.example config.json
```

**`.env`**

| Variável | O que colocar |
|---|---|
| `DB_HOST` | Endereço do servidor MySQL |
| `DB_PORT` | Porta do MySQL (padrão `3306`) |
| `DB_USER` | Usuário de acesso ao banco |
| `DB_PASSWORD` | Senha do usuário (se tiver caractere especial, coloque entre aspas) |
| `DB_NAME` | Nome do banco |
| `DB_TABLE` | Nome da tabela ou view a ser lida |
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | Caminho pro arquivo de credenciais (`./credentials.json` por padrão) |
| `GOOGLE_SPREADSHEET_ID` | ID da planilha de destino — o trecho da URL entre `/d/` e `/edit` |

**`credentials.json`**

Substitua o conteúdo pela chave JSON de uma service account do Google Cloud. Depois de criar a service account, compartilhe a planilha manualmente com o e-mail dela, com permissão de Editor — sem isso a escrita falha por falta de permissão.

**`config.json`**

| Campo | O que colocar |
|---|---|
| `tableName`, `spreadsheetId`, `credentialsPath` | Mesmos valores do `.env` (servem de reserva caso o `.env` não defina) |
| `mode` | `"raw"`, `"dedupe"` ou `"merge"` |
| `dbHost`, `dbPort`, `dbUser`, `dbPassword`, `dbName` | Mesmos dados do `.env` |
| `dedupeColumn` | Só se `mode` for `"dedupe"` — coluna usada pra identificar duplicatas |
| `dedupeStrategy` | Opcional, só no modo `dedupe` — `"keep-first"` ou `"keep-last"` (padrão: `"keep-first"`) |

Campos do modo `merge` (todos opcionais, menos `mergeKeyColumn` e `mergeColumns`):

| Campo | O que faz |
|---|---|
| `mergeKeyColumn` | Coluna usada pra saber quais linhas são "a mesma coisa" e devem ser unificadas |
| `mergeColumns` | Lista de `{ column, strategy, separator?, byGroup?, unkeyed? }`. `strategy` é `"concat"`, `"overwrite"` ou `"extra-column"` |
| `mergeEmptyKeyLabel` | Rótulo das linhas com a chave vazia (padrão: `(sem <coluna>)`) |
| `mergeKeyNormalizer` | Nome do normalizador de chave (veja a seção [Normalizadores de chave](#normalizadores-de-chave)). Padrão: `trim` |
| `mergeRejectedKeyLabel` | Rótulo das linhas cuja chave o normalizador rejeitou (padrão: `(<coluna> inválido)`) |
| `normalizerModules` | Lista de caminhos de arquivos com normalizadores criados por você |

**Linhas sem chave (`unkeyed`).** Por padrão, cada linha sem chave vai pro fim da planilha, uma por linha, com o rótulo. Se uma coluna de `mergeColumns` tiver `"unkeyed": { "strategy": "collapse-column", "into": "Nome da coluna nova", "separator": " | " }`, o valor dela em todas as linhas sem chave é juntado numa coluna só, numa única linha. Ficam duas linhas no máximo: uma pras chaves vazias e outra pras rejeitadas, cada uma com seu rótulo. As outras colunas dessas linhas não vão junto.

Quando um valor existe tanto no `.env` quanto no `config.json`, o `.env` tem prioridade.

## Modos de execução

- **`raw`** — modo padrão, escreve os dados como vieram do banco, sem tratamento nenhum.
- **`dedupe`** — remove linhas duplicadas com base numa coluna configurável, mantendo a primeira ou a última ocorrência conforme `dedupeStrategy`.
- **`merge`** — unifica linhas que compartilham a mesma chave, combinando as colunas conforme `mergeColumns`.

## Normalizadores de chave

### Pra que serve

No modo `merge`, o projeto junta as linhas que têm a mesma chave. Só que dado de verdade é bagunçado. `Ana@Email.com` e `ana@email.com ` são a mesma pessoa, mas pro computador são textos diferentes, então a junção não acontece.

O **normalizador** resolve isso. Ele é uma função que roda em cada valor da coluna-chave antes de comparar, e devolve uma de três coisas:

| Devolve | Significa |
|---|---|
| `{ key: "abc" }` | "A chave limpa é `abc`". Linhas com a mesma `key` são unificadas |
| `{ key: "0042", group: "AB" }` | Igual ao de cima, mas com uma categoria. Linhas de categorias diferentes **nunca** se juntam, mesmo com `key` igual |
| `null` | "Esse valor não serve como chave" (rejeitada) |

Valor vazio (`null`, texto vazio ou só espaços) nunca chega no normalizador. Ele vai direto pro grupo de linhas sem chave.

Linhas rejeitadas (`null`) também viram "sem chave": cada uma fica isolada, nunca se junta com outra, e vai pro fim da planilha com o rótulo de `mergeRejectedKeyLabel`.

Importante: a chave normalizada só serve pra comparar. O valor que aparece na planilha continua sendo o da primeira linha do grupo, sem alteração.

### Como ativar um normalizador

No `config.json`, coloque o nome dele em `mergeKeyNormalizer`:

```json
{
  "mode": "merge",
  "mergeKeyColumn": "email",
  "mergeKeyNormalizer": "lowercase",
  "mergeColumns": [{ "column": "nome", "strategy": "concat" }]
}
```

Sem `mergeKeyNormalizer`, o projeto usa o `trim` (só tira espaços das pontas).

Exemplo do que acontece com esse config:

| email (banco) | nome (banco) | | email (planilha) | nome (planilha) |
|---|---|---|---|---|
| `Ana@Email.com` | Ana | | `Ana@Email.com` | Ana; Ana Paula |
| ` ana@email.com` | Ana Paula | | | |

### Normalizadores que já vêm prontos

| Nome | O que faz | Exemplo | Rejeita quando |
|---|---|---|---|
| `trim` | Tira espaços do começo e do fim. É o padrão | `" AB-1 "` vira `"AB-1"` | Nunca |
| `lowercase` | Faz o `trim` e deixa tudo minúsculo | `"Ana@Email.COM "` vira `"ana@email.com"` | Nunca |
| `digitsOnly` | Fica só com os números | `"(53) 99999-1234"` vira `"53999991234"` | Não sobra nenhum dígito |
| `alphanumeric` | Fica só com letras e números, tudo minúsculo | `"AB-0042 / rev"` vira `"ab0042rev"` | Não sobra nada |

Cada um deles serve pra situações como:

- `lowercase`: e-mails, usernames, qualquer texto que muda de maiúscula pra minúscula.
- `digitsOnly`: telefones e códigos numéricos escritos com pontos, traços e parênteses.
- `alphanumeric`: códigos de produto que aparecem como `AB-0042`, `ab 0042` e `AB0042`.

### Criando o seu próprio normalizador

Se nenhum dos prontos resolve o seu caso, você escreve um. É só uma função. Vamos fazer um passo a passo com um exemplo: códigos de produto no formato `letras + números`, que às vezes vêm com hífen, espaço ou minúsculas (`ab-0042`, `AB 0042`, `AB0042`). Queremos que `AB0042` e `CD0042` **não** sejam juntados, porque são produtos de linhas diferentes.

**Passo 1. Crie um arquivo.** Sugestão: `local/meusNormalizers.ts`. A pasta `local/` está no `.gitignore`, então o que você colocar lá fica só no seu computador e não vai pro GitHub.

**Passo 2. Escreva a função.**

```ts
import { KeyNormalizer } from "../src/filters/keyNormalizers";

const codigoProduto: KeyNormalizer = (raw) => {
    const limpo = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
    const partes = limpo.match(/^([A-Z]+)(\d+)$/);

    if (!partes) return null;

    return { key: partes[2] ?? "", group: partes[1] ?? "" };
};

export const normalizers = { codigoProduto };
```

O que cada parte faz:

- `raw` é o valor que veio do banco. Pode ser texto ou número, por isso o `String(raw)`.
- `toUpperCase().replace(...)` deixa tudo maiúsculo e tira tudo que não é letra ou número.
- `match(...)` separa as letras (`partes[1]`) dos números (`partes[2]`). Se o formato não bate, devolvemos `null` e a linha vai pro grupo de rejeitadas.
- `key` são os números e `group` são as letras. Assim `AB0042` e `CD0042` têm a mesma `key`, mas grupos diferentes, e não se juntam.
- O `?? ""` existe porque o `tsconfig` do projeto liga o `noUncheckedIndexedAccess`, e o TypeScript trata `partes[1]` como "pode ser `undefined`".
- A última linha é obrigatória: o arquivo precisa exportar um objeto chamado `normalizers`. O nome de cada propriedade é o nome que você vai usar no `config.json`. Você pode colocar vários normalizadores no mesmo arquivo.

**Passo 3. Avise o projeto que esse arquivo existe.** No `config.json`:

```json
{
  "normalizerModules": ["./local/meusNormalizers.ts"],
  "mergeKeyNormalizer": "codigoProduto"
}
```

O caminho é relativo à pasta de onde você roda o `npm start`. O arquivo pode ser `.ts` (funciona com `npm start`, que usa o `tsx`), `.js` ou `.cjs`. Se for `.js`/`.cjs`, exporte com `module.exports = { normalizers: { codigoProduto } }`.

**Passo 4. Teste.** Crie `local/meusNormalizers.test.ts`. O `npm test` também roda os testes dessa pasta.

```ts
import { describe, it, expect } from "vitest";
import { normalizers } from "./meusNormalizers";

describe("codigoProduto", () => {
    it("aceita formatos diferentes do mesmo código", () => {
        expect(normalizers.codigoProduto("ab-0042")).toEqual({ key: "0042", group: "AB" });
        expect(normalizers.codigoProduto("AB 0042")).toEqual({ key: "0042", group: "AB" });
    });

    it("rejeita o que não tem o formato esperado", () => {
        expect(normalizers.codigoProduto("sem codigo")).toBeNull();
    });
});
```

**Passo 5. Rode** com `npm start`. Se o nome em `mergeKeyNormalizer` não existir, o erro mostra a lista dos disponíveis.

### Ideias de uso

| Situação | Como resolver |
|---|---|
| E-mails com maiúscula/minúscula misturada | `lowercase` |
| Telefones escritos de jeitos diferentes | `digitsOnly`, ou um seu que também tire o `55` do começo |
| Códigos de produto com hífen ou espaço | `alphanumeric`, ou um seu com `group` pelas letras (como no exemplo acima) |
| Matrícula com prefixo da unidade (`SP-1234`, `RJ-1234`) | Um seu com `group` = prefixo e `key` = número, pra unidades diferentes nunca se juntarem |
| Dois formatos de ID na mesma coluna (ex: 8 dígitos e 12 dígitos) | Um seu que tire tudo que não é número e use o tamanho como `group` |
| Valor com texto grudado no fim (`12345abc`) | Um seu que pegue só a parte inicial com uma regex |
| Valores de "preenchimento" (`n/a`, `0000`, `-`) | Um seu que devolva `null` pra eles |

### Estratégia diferente por grupo

Quando o normalizador devolve um `group`, cada coluna do `mergeColumns` pode ter uma regra própria pra cada grupo, com o `byGroup`. Quem não tem regra usa a `strategy` normal da coluna.

Exemplo com o normalizador `codigoProduto` do guia acima (o `group` são as letras do código). Queremos que os produtos `AB` fiquem em `cor`, `cor_2`, `cor_3`, e que os produtos `CD` tenham todas as cores juntas numa coluna só:

```json
"mergeColumns": [
  {
    "column": "cor",
    "strategy": "extra-column",
    "byGroup": {
      "CD": { "strategy": "concat", "into": "Cores CD", "separator": " | " }
    }
  }
]
```

Como funciona:

- A chave de `byGroup` (`"CD"`) é o `group` que o normalizador devolve. Maiúscula e minúscula fazem diferença.
- `strategy` aceita as mesmas três da coluna: `concat`, `overwrite` e `extra-column`.
- `into` é opcional. Com ele, o valor vai pra uma coluna nova e a coluna original fica vazia nessas linhas. Sem ele, o valor continua na coluna original.
- `separator` é opcional e vale só pro `concat`.
- A regra também vale pra linhas que ficaram sozinhas no grupo, pra que todas as linhas do mesmo grupo fiquem no mesmo formato.

### Cuidados

- A função não deve alterar nada fora dela nem depender de coisas externas. Dado o mesmo valor, tem que devolver sempre o mesmo resultado.
- Na dúvida, devolva `null`. É melhor um valor esquisito ir pro fim da planilha, rotulado, do que ser unido com a pessoa errada.
- Dois normalizadores com o mesmo nome dão erro. Isso vale também pros nomes dos prontos.
- Se o `normalizerModules` apontar pra um arquivo que não existe, ou que não exporta `normalizers`, o erro diz qual arquivo é o problema.

## Rodando

```bash
npm start
```

Lê do banco, aplica o modo configurado e escreve na planilha.

Pra sobrescrever o modo sem editar o `config.json`:
```bash
npm start -- --mode dedupe
```

Pra usar um arquivo de config diferente:
```bash
npm start -- --config ./outro-config.json
```

## Testes

| Comando | O que faz |
|---|---|
| `npm test` | Testes unitários (Vitest), sem precisar de banco ou planilha reais |
| `npm run test:config` | Carrega e valida o `config.json` |
| `npm run test:connection` | Conecta no banco real e mostra as 3 primeiras linhas |
| `npm run test:sheet` | Escreve duas linhas de teste numa planilha real |

## Estrutura

```
src/
  cli.ts              # parsing de argumentos (--config, --mode)
  config.ts           # schema Zod + carregamento de config (JSON + .env)
  db.ts               # conexão MySQL, leitura paginada, retry com backoff
  env.ts              # helpers de variável de ambiente
  sheets.ts           # autenticação e escrita no Google Sheets
  index.ts            # entrypoint: liga leitura → filtro → escrita
  filters/
    types.ts          # interface Filter<T>
    dedupe.ts         # implementação do filtro de dedupe
    merge.ts          # implementação do filtro de merge
    mergeTypes.ts     # tipos de config do merge
    keyNormalizers.ts # registry de normalizadores de chave
    normalizers/      # normalizadores prontos e carregador de módulos externos
  tests/              # testes unitários (Vitest)
local/                # (ignorada pelo git) seus normalizadores e testes pessoais
scripts/              # scripts manuais de smoke test (banco, config, sheets)
```

## Ainda falta

- Validação de dados (ex: formato de campos) e separação de linhas válidas/inválidas em abas diferentes
- Pipeline de filtros configurável (hoje os modos são um switch fixo no `index.ts`)
- Build de produção (hoje roda tudo via `tsx`)
