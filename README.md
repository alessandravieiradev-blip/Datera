<p align="center">
  <img src="docs/assets/datera-icon.png" alt="Ícone do Datera" width="128">
</p>

<h1 align="center">Datera</h1>

<p align="center">Ferramenta pra limpar e juntar dados bagunçados de planilha, banco e arquivo.</p>

<p align="center">
  <a href="https://github.com/alessandravieiradev-blip/datera/actions/workflows/ci.yml"><img src="https://github.com/alessandravieiradev-blip/datera/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
</p>

O Datera é um ETL que eu fiz em TypeScript. Ele lê dados de um MySQL, do Google Sheets, de uma planilha do Excel, de um CSV ou de um JSON, arruma o que dá e escreve tudo no Google Sheets, no Excel, num CSV ou num JSON.

Ele começou bem simples, era só pra copiar uma tabela do MySQL pra uma planilha. Só que aí eu fui vendo que dado de verdade vem uma bagunça: a mesma pessoa cadastrada duas vezes, e-mail com maiúscula num lugar e minúscula no outro, campo vazio, informação espalhada em várias colunas. Então fui colocando coisa nova até conseguir resolver quase tudo mexendo só no `config.json`.

Hoje ele consegue:

- tirar linhas repetidas (`dedupe`) ou juntar as linhas da mesma pessoa sem perder nada (`merge`)
- escolher o que acontece com cada coluna na hora de juntar
- usar normalizadores pra `Lia@Email.com` e ` lia@email.com` contarem como a mesma pessoa (tem uns prontos e dá pra criar o seu)
- ter regras diferentes dependendo do tipo da chave (tipo tratar artista solo de um jeito e banda de outro)
- decidir o que fazer com as linhas que não têm chave, sem elas sumirem nem se misturarem
- preencher células vazias e juntar colunas antes de tudo
- espalhar valores em várias colunas sem jogar nenhum fora
- separar as linhas com problema numa aba de pendências, com o motivo escrito do lado
- ler e escrever em formatos diferentes (MySQL, Excel, CSV, JSON, Google Sheets) sem mudar nada das regras

Se quiser ver ele rodando antes de ler tudo, tem o [teste em 1 minuto](#teste-em-1-minuto) logo aqui embaixo, ou dá pra ir direto nos [exemplos](#exemplos-do-mais-simples-ao-mais-completo).

## Teste em 1 minuto

Pra testar não precisa de banco nem de conta no Google. Deixei um CSV de exemplo na pasta `examples/`, com alunos de uma escola de música inventada (tem cadastro repetido, e-mail errado e um plano que não existe):

```bash
npm install
npm run example
```

Ele lê o `examples/alunos.csv` e gera dois arquivos em `examples/saida/`. O `resultado.csv` fica com os cadastros já juntados:

| matricula | nome        | nome_2 | email            | instrumento 1 | instrumento 2 | plano  | cidade        | outros instrumentos |
| --------- | ----------- | ------ | ---------------- | ------------- | ------------- | ------ | ------------- | ------------------- |
| 2024-0042 | Lia Martins | Lia M. | `lia@email.com`  | violão        | ukulele       | Mensal | Pelotas       | piano               |
| 2024-0051 | Theo Souza  |        | `theo@email.com` | bateria       |               | anual  | Rio Grande    |                     |
| 2024-0077 | Duda Alves  |        | `duda@email.com` | voz           | violino       | mensal | não informada |                     |

E o `resultado.pendencias.csv` fica com o que precisa de alguém dar uma olhada:

| Motivo                        | matricula | nome       | email            | instrumento 1 | instrumento 2 | plano      | cidade  |
| ----------------------------- | --------- | ---------- | ---------------- | ------------- | ------------- | ---------- | ------- |
| e-mail fora do formato        | 2024-0060 | Nina Rocha | nina.email.com   | piano         |               | trimestral | Pelotas |
| sem matrícula                 |           | Caio Lima  | `caio@email.com` | voz           |               | mensal     | Canguçu |
| plano com valor não permitido | 2024-0077 | Duda Alves | `duda@email.com` | flauta        | voz           | semanal    | Pelotas |

Quem faz tudo isso é a `examples/config.csv.json`. Vale abrir ela do lado dos arquivos. Dá pra ver que `2024-0042` e `20240042` viraram a mesma aluna por causa do normalizador `digitsOnly`, que os instrumentos foram espalhados em colunas pelo `distribute` e que a cidade vazia virou `não informada` por causa do `fillEmpty`.

Se você prefere ver em Excel, roda `npm run example:excel`. Ele faz a mesma coisa mas gera um `examples/saida/resultado.xlsx`, com os alunos numa aba e as pendências em outra.

## Sumário

- [Teste em 1 minuto](#teste-em-1-minuto)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Como os dados passam pelo ETL](#como-os-dados-passam-pelo-etl)
- [Fontes e destinos](#fontes-e-destinos)
- [Exemplos, do mais simples ao mais completo](#exemplos-do-mais-simples-ao-mais-completo)
- [Preparando os dados](#preparando-os-dados)
- [Distribuir valores em várias colunas](#distribuir-valores-em-várias-colunas-distribute)
- [Separar as pendências](#separar-as-pendências-validation)
- [Normalizadores de chave](#normalizadores-de-chave)
- [Rodando](#rodando)
- [O app pro desktop](#o-app-pro-desktop)
- [Usando dentro de outro código](#usando-dentro-de-outro-código)
- [Testes](#testes)
- [Estrutura](#estrutura)

## Instalação

```bash
npm install
```

## Configuração

O projeto usa três arquivos que não vão pro git. É só copiar os exemplos e colocar os seus dados (se você for usar só CSV ou JSON, o `config.json` já resolve):

```bash
cp .env.example .env
cp credentials.json.example credentials.json
cp config.json.example config.json
```

O `.env`:

| Variável                          | O que colocar                                                        |
| --------------------------------- | -------------------------------------------------------------------- |
| `DB_HOST`                         | Endereço do servidor MySQL                                           |
| `DB_PORT`                         | Porta do MySQL (padrão `3306`)                                       |
| `DB_USER`                         | Usuário de acesso ao banco                                           |
| `DB_PASSWORD`                     | Senha do usuário (se tiver caractere especial, coloque entre aspas)  |
| `DB_NAME`                         | Nome do banco                                                        |
| `DB_TABLE`                        | Nome da tabela ou view a ser lida                                    |
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | Caminho pro arquivo de credenciais (`./credentials.json` por padrão) |
| `GOOGLE_SPREADSHEET_ID`           | ID da planilha de destino, o trecho da URL entre `/d/` e `/edit`     |

O `credentials.json`:

Aqui vai a chave JSON de uma service account do Google Cloud. Depois de criar a service account, lembra de compartilhar a planilha com o e-mail dela como Editor, senão a escrita dá erro de permissão.

E o `config.json`:

| Campo                                                | O que colocar                                                                           |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `source`                                             | De onde ler: MySQL, CSV ou JSON. Veja [Fontes e destinos](#fontes-e-destinos)           |
| `destination`                                        | Onde escrever: Google Sheets, CSV ou JSON. Veja [Fontes e destinos](#fontes-e-destinos) |
| `tableName`, `spreadsheetId`, `credentialsPath`      | Mesmos valores do `.env` (servem de reserva caso o `.env` não defina)                   |
| `mode`                                               | `"raw"`, `"dedupe"` ou `"merge"`                                                        |
| `dbHost`, `dbPort`, `dbUser`, `dbPassword`, `dbName` | Mesmos dados do `.env`                                                                  |
| `dedupeColumn`                                       | Só se `mode` for `"dedupe"`. Coluna usada pra identificar duplicatas                    |
| `dedupeStrategy`                                     | Opcional, só no modo `dedupe`. `"keep-first"` ou `"keep-last"` (padrão: `"keep-first"`) |

Os campos do modo `merge` (só o `mergeKeyColumn` e o `mergeColumns` são obrigatórios):

| Campo                   | O que faz                                                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `mergeKeyColumn`        | Coluna usada pra saber quais linhas são "a mesma coisa" e devem ser unificadas                                                           |
| `mergeColumns`          | Lista de `{ column, strategy, separator?, distribute?, byGroup?, unkeyed? }`. `strategy` é `"concat"`, `"overwrite"` ou `"extra-column"` |
| `mergeEmptyKeyLabel`    | Rótulo das linhas com a chave vazia (padrão: `(sem <coluna>)`)                                                                           |
| `mergeKeyNormalizer`    | Nome do normalizador de chave (veja a seção [Normalizadores de chave](#normalizadores-de-chave)). Padrão: `trim`                         |
| `mergeRejectedKeyLabel` | Rótulo das linhas cuja chave o normalizador rejeitou (padrão: `(<coluna> inválido)`)                                                     |
| `normalizerModules`     | Lista de caminhos de arquivos com normalizadores criados por você                                                                        |
| `adapterModules`        | Lista de caminhos de arquivos com fontes e destinos criados por você                                                                     |

Sobre as linhas sem chave (`unkeyed`): por padrão cada linha sem chave vai pro fim da planilha, uma por linha, com o rótulo. Se uma coluna do `mergeColumns` tiver `"unkeyed": { "strategy": "collapse-column", "into": "Nome da coluna nova", "separator": " | " }`, os valores dela nessas linhas são juntados numa coluna só, numa linha só. Aí ficam no máximo duas linhas, uma pras chaves vazias e outra pras rejeitadas. As outras colunas dessas linhas não vão junto.

Os campos de preparação são opcionais e funcionam em qualquer modo:

| Campo            | O que faz                                                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `fillEmpty`      | Lista de `{ column, fallbackColumns?, default? }`. Preenche célula vazia com outra coluna ou com um valor padrão. Veja [Preparando os dados](#preparando-os-dados) |
| `combineColumns` | Lista de `{ into, columns, separator?, keepSources? }`. Junta várias colunas da mesma linha numa só. Veja [Preparando os dados](#preparando-os-dados)              |
| `validation`     | `{ rules, pendingSheet?, reasonColumn? }`. Manda as linhas com problema pra uma aba separada. Veja [Separar as pendências](#separar-as-pendências-validation)      |

Se o mesmo valor estiver no `.env` e no `config.json`, vale o do `.env`.

## Como os dados passam pelo ETL

```text
fonte: MySQL, CSV ou JSON
   │
   ├─ fillEmpty        preenche células vazias          (opcional)
   ├─ combineColumns   junta colunas da mesma linha      (opcional)
   ├─ validation       separa as linhas com problema     (opcional) ──► aba ou arquivo de pendências
   │
   ├─ modo (só com as linhas válidas)
   │    raw     escreve do jeito que veio
   │    dedupe  tira as linhas repetidas por uma coluna
   │    merge   junta as linhas com a mesma chave
   │
   ▼
destino: Google Sheets (primeira aba), CSV ou JSON
```

### Modos

O `raw` é o padrão e só escreve os dados do jeito que vieram.
O `dedupe` tira as linhas repetidas olhando uma coluna e fica com a primeira ou com a última (`dedupeStrategy`). A linha que sai vai embora inteira.
O `merge` junta as linhas com a mesma chave numa só, e cada coluna do `mergeColumns` diz como os valores vão ser juntados.

### Estratégias do merge

| `strategy`     | O que faz                                                                           | Com `cor` = azul, verde, azul fica |
| -------------- | ----------------------------------------------------------------------------------- | ---------------------------------- |
| `concat`       | Junta os valores diferentes numa célula, separados pelo `separator` (padrão `"; "`) | `azul; verde`                      |
| `overwrite`    | Fica com o último valor preenchido                                                  | `azul`                             |
| `extra-column` | O primeiro fica na coluna e os outros vão pra `<coluna>_2`, `<coluna>_3`...         | `azul`, `verde`, `azul`            |

O `concat` também aceita o `distribute`, que espalha os valores em colunas (tem exemplo mais pra frente). Nas três, célula vazia é ignorada.

## Fontes e destinos

O ETL lê de um lugar (`source`) e escreve em outro (`destination`). Por enquanto dá pra ler de MySQL, Google Sheets, Excel, CSV e JSON e escrever no Google Sheets, no Excel, em CSV e em JSON, misturando do jeito que quiser.

```json
{
    "source": { "type": "csv", "path": "./dados/alunos.csv" },
    "destination": {
        "type": "sheets",
        "spreadsheetId": "...",
        "credentialsPath": "./credentials.json"
    }
}
```

Por dentro, tudo vira a mesma coisa: uma lista de linhas, e cada linha é um objeto `{ coluna: valor }`. Os filtros (fillEmpty, validation, merge...) só entendem isso, então nem sabem de onde o dado veio. Cada formato tem uma pecinha que converte do formato dela pra essa lista, ou o contrário. Descobri depois que isso tem nome, é o padrão Adapter, e é por causa dele que dá pra colocar formato novo sem mexer no resto.

### Fontes (`source`)

| `type`   | Campos                                                  | Observações                                                                                                                |
| -------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `mysql`  | `host`, `port`, `user`, `password`, `database`, `table` | Todos opcionais: o que faltar vem das variáveis do `.env` ou dos campos antigos (`dbHost`, `tableName`...)                 |
| `csv`    | `path`, `delimiter?`, `encoding?`                       | Sem `delimiter` ele descobre sozinho (`,`, `;`, tab ou `\|`). `encoding` é `"utf-8"` (padrão) ou `"latin1"`                |
| `json`   | `path`, `recordsPath?`                                  | O arquivo tem que ser uma lista de objetos. Se a lista tá dentro de outras chaves, usa `recordsPath` tipo `"dados.alunos"` |
| `excel`  | `path`, `sheet?`                                        | Arquivo `.xlsx`. Sem `sheet`, ele lê a primeira aba. A primeira linha tem que ser o cabeçalho                              |
| `sheets` | `spreadsheetId`, `sheet?`, `credentialsPath?`           | Uma planilha do Google. Sem `sheet`, lê a primeira aba. Sem `credentialsPath`, usa o mesmo das outras configs              |
| `custom` | `adapter`, `options?`                                   | Um adapter seu, carregado pelo `adapterModules`. Veja [E se o meu formato não tá aqui?](#e-se-o-meu-formato-não-tá-aqui)   |

Umas coisas que eu aprendi apanhando:

- o Excel em português salva CSV com `;` e não com `,`, por isso ele descobre o separador sozinho
- CSV exportado de sistema antigo às vezes vem em `latin1`. Se os acentos aparecerem tipo `JoÃ£o`, coloca `"encoding": "latin1"`
- no CSV, célula vazia vira vazio de verdade (igual o `null` do banco), então o `required` e o `fillEmpty` funcionam do mesmo jeito
- no JSON, objeto dentro de objeto vira coluna com ponto e lista simples vira texto separado por vírgula

Um exemplo com JSON, usando `"recordsPath": "dados.alunos"`. Esse arquivo:

```json
{
    "dados": {
        "alunos": [
            {
                "nome": "Lia",
                "matricula": 42,
                "endereco": {
                    "cidade": "Pelotas",
                    "bairro": "Centro"
                },
                "instrumentos": ["violão", "ukulele"]
            },
            {
                "nome": "Theo",
                "matricula": 51,
                "endereco": {
                    "cidade": "Rio Grande",
                    "bairro": null
                },
                "instrumentos": ["bateria"]
            }
        ]
    }
}
```

fica assim:

| nome | matricula | endereco.cidade | endereco.bairro | instrumentos    |
| ---- | --------- | --------------- | --------------- | --------------- |
| Lia  | 42        | Pelotas         | Centro          | violão, ukulele |
| Theo | 51        | Rio Grande      |                 | bateria         |

### Destinos (`destination`)

| `type`   | Campos                                       | A aba de pendências vira                                                                         |
| -------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `sheets` | `spreadsheetId`, `credentialsPath`, `sheet?` | outra aba na mesma planilha (a principal é a primeira aba, ou a que você colocar em `sheet`)     |
| `csv`    | `path`, `delimiter?`, `bom?`                 | outro arquivo do lado: `resultado.csv` → `resultado.pendencias.csv`                              |
| `json`   | `path`                                       | outro arquivo do lado: `resultado.json` → `resultado.pendencias.json`                            |
| `excel`  | `path`, `sheet?`                             | outra aba no mesmo arquivo (a principal se chama `Dados`, ou o nome que você colocar em `sheet`) |
| `custom` | `adapter`, `options?`                        | o seu adapter recebe `{ name: "Pendências" }` no `write` e decide                                |

O CSV sai com vírgula. Se for abrir no Excel em português, coloca `"delimiter": ";"`. Ele também sai com um caractere invisível no começo (o `bom`, que já vem ligado) pro Excel mostrar os acentos certo. Se o arquivo for pra outro programa e ele reclamar desse caractere, coloca `"bom": false`. E se a pasta do arquivo não existir, ele cria.

Pra ler do Google Sheets, a planilha de origem também tem que estar compartilhada com o e-mail da service account (pode ser só como Leitor). Os números chegam como número e as datas chegam do jeito que aparecem na planilha.

A planilha de onde ele lê nunca é alterada, ele só escreve no destino. O jeito mais seguro é usar outra planilha pro destino e compartilhar a original só como Leitor, aí nem o Google deixa mexer nela.

Se quiser ler e escrever na mesma planilha, dá, mas precisa dizer as abas: `sheet` na fonte com a aba dos dados originais e `sheet` no destino com a aba do resultado. As duas (e a de pendências) têm que ter nomes diferentes. Se faltar alguma coisa ou algum nome bater, ele avisa e nem começa. O mesmo vale pra arquivo: a fonte e o destino não podem ser o mesmo arquivo.

Sobre o Excel, umas coisas que acontecem por baixo:

- célula com fórmula vira o valor calculado, não a fórmula
- data vira texto no formato `2024-03-10` (ou com a hora junto, se tiver hora)
- texto com negrito, cor ou link vira texto normal
- linha totalmente vazia é pulada
- na saída o arquivo é recriado toda vez que roda, então não guarda coisa sua dentro dele. O cabeçalho sai em negrito e fixo, e a largura das colunas se ajusta sozinha
- o Excel não aceita alguns caracteres em nome de aba (tipo `/` e `:`) nem nome com mais de 31 letras, então ele arruma isso sozinho

### E a config antiga?

Continua funcionando igual. Sem `source`, ele usa `dbHost`, `dbUser`, `tableName`... como MySQL, e sem `destination` usa `spreadsheetId` e `credentialsPath` como Google Sheets. O `.env` continua valendo mais que o `config.json` nos dois jeitos.

### E se o meu formato não tá aqui?

Dá pra escrever o seu próprio adapter sem mexer no código do projeto, do mesmo jeitinho que os normalizadores. Por exemplo, uma fonte que lê um `.txt` com um valor por linha. Cria um arquivo, tipo `local/meusAdapters.cjs`:

```js
const fs = require("fs");

const linhasDeTexto = (options) => ({
    read: async () =>
        fs
            .readFileSync(options.path, "utf8")
            .split(/\r?\n/)
            .map((linha) => linha.trim())
            .filter((linha) => linha !== "")
            .map((linha) => ({ [options.column ?? "valor"]: linha })),
});

module.exports = { sources: { linhasDeTexto } };
```

E na config:

```json
{
    "adapterModules": ["./local/meusAdapters.cjs"],
    "source": {
        "type": "custom",
        "adapter": "linhasDeTexto",
        "options": { "path": "./alunos.txt", "column": "nome" }
    }
}
```

O que precisa saber:

- o arquivo exporta `sources` (fontes), `sinks` (destinos) ou os dois. O nome de cada um é o que vai no `adapter` da config
- cada um é uma função que recebe o `options` da config e devolve um objeto. Fonte tem que ter `read()`, que devolve a lista de linhas. Destino tem que ter `write(rows, { name })`, e o `name` vem preenchido quando é a saída de pendências
- pode ser `.ts` (funciona com `npm start`), `.js` ou `.cjs`
- se o nome não existir, ou se a função não devolver o objeto certo, ele avisa antes de começar
- a função também recebe um segundo parâmetro com o `logger`. Se quiser mostrar alguma mensagem do mesmo jeito que o resto do ETL, é só usar `context.logger.info("...")`

## Exemplos, do mais simples ao mais completo

Todos os exemplos usam uma escola de música e um festival que eu inventei. Em cada um só aparece a parte do `config.json` que importa, o resto (banco, planilha) fica igual ao seu.

As tabelas de saída eu não escrevi na mão, elas saíram rodando o ETL com essas configs. Então é isso mesmo que vai aparecer.

### 1. Só copiar (`raw`)

O mais simples de todos, nada é mexido.

```json
{ "mode": "raw" }
```

| id  | nome | email            |
| --- | ---- | ---------------- |
| 1   | Lia  | `lia@email.com`  |
| 2   | Theo | `theo@email.com` |
| 3   | Lia  | `lia@email.com`  |

A Lia aparece duas vezes. Os próximos exemplos resolvem isso de jeitos diferentes.

### 2. Tirar as repetidas (`dedupe`)

Aqui ele olha a coluna `email` e deixa uma linha só pra cada valor. Com `keep-last` fica a última.

```json
{
    "mode": "dedupe",
    "dedupeColumn": "email",
    "dedupeStrategy": "keep-last"
}
```

Entrada:

| id  | nome        | email            | turma   |
| --- | ----------- | ---------------- | ------- |
| 1   | Lia         | `lia@email.com`  | segunda |
| 2   | Theo        | `theo@email.com` | quarta  |
| 3   | Lia Martins | `lia@email.com`  | sexta   |

Saída:

| id  | nome        | email            | turma  |
| --- | ----------- | ---------------- | ------ |
| 2   | Theo        | `theo@email.com` | quarta |
| 3   | Lia Martins | `lia@email.com`  | sexta  |

A primeira linha da Lia saiu e ficou só a 3. Como é `keep-last`, a linha que fica vai pra posição da última, por isso o Theo subiu (com `keep-first`, que é o padrão, a ordem não muda). E repara que a turma de segunda sumiu junto, porque o `dedupe` joga a linha inteira fora. Se isso for um problema, o `merge` do próximo exemplo resolve.

### 3. Juntar sem perder nada (`merge`)

Aqui as linhas com a mesma chave viram uma só e você escolhe o que acontece com cada coluna.

```json
{
    "mode": "merge",
    "mergeKeyColumn": "email",
    "mergeColumns": [
        { "column": "oficina", "strategy": "concat", "separator": ", " },
        { "column": "plano", "strategy": "overwrite" },
        { "column": "instrumento", "strategy": "extra-column" }
    ]
}
```

Entrada:

| email            | oficina | plano      | instrumento |
| ---------------- | ------- | ---------- | ----------- |
| `lia@email.com`  | Violão  | mensal     | violão      |
| `lia@email.com`  | Canto   | trimestral | voz         |
| `lia@email.com`  | Violão  |            |             |
| `theo@email.com` | Bateria | mensal     | bateria     |

Saída:

| email            | oficina       | plano      | instrumento | instrumento_2 |
| ---------------- | ------------- | ---------- | ----------- | ------------- |
| `lia@email.com`  | Violão, Canto | trimestral | violão      | voz           |
| `theo@email.com` | Bateria       | mensal     | bateria     |               |

O `concat` juntou as oficinas numa célula e o "Violão" repetido apareceu uma vez só. O `overwrite` ficou com o último plano preenchido (a terceira linha não tinha plano, então ficou o "trimestral"). E o `extra-column` criou a `instrumento_2`, se tivesse um terceiro ia pra `instrumento_3`. As colunas que não estão no `mergeColumns` ficam com o valor da primeira linha.

### 4. Mesma chave escrita diferente (normalizador pronto)

Esses três e-mails são da mesma pessoa, mas sem normalizador o ETL acha que são três pessoas diferentes.

```json
{
    "mode": "merge",
    "mergeKeyColumn": "email",
    "mergeKeyNormalizer": "lowercase",
    "mergeColumns": [
        { "column": "oficina", "strategy": "concat", "separator": ", " }
    ]
}
```

Entrada:

| email            | oficina |
| ---------------- | ------- |
| `Lia@Email.com`  | Violão  |
| ` lia@email.com` | Canto   |
| `LIA@EMAIL.COM ` | Ukulele |

Saída:

| email           | oficina                |
| --------------- | ---------------------- |
| `Lia@Email.com` | Violão, Canto, Ukulele |

O `lowercase` tira os espaços e deixa tudo minúsculo só na hora de comparar, na planilha o e-mail continua como veio na primeira linha. Tem outros prontos e dá pra criar o seu, explico em [Normalizadores de chave](#normalizadores-de-chave).

### 5. Linhas sem chave (jeito padrão)

E quando a chave tá vazia ou não serve? Nesse exemplo a chave é a matrícula, e o `digitsOnly` deixa só os números dela.

```json
{
    "mode": "merge",
    "mergeKeyColumn": "matricula",
    "mergeKeyNormalizer": "digitsOnly",
    "mergeEmptyKeyLabel": "sem matrícula",
    "mergeRejectedKeyLabel": "matrícula inválida",
    "mergeColumns": [
        { "column": "nome", "strategy": "extra-column" },
        { "column": "oficina", "strategy": "concat", "separator": " | " }
    ]
}
```

Entrada:

| matricula | nome        | oficina |
| --------- | ----------- | ------- |
| 2024-0042 | Lia         | Violão  |
| 20240042  | Lia Martins | Canto   |
|           | Nina        | Piano   |
|           | Caio        | Bateria |
| pendente  | Duda        | Flauta  |

Saída:

| matricula          | nome | nome_2      | oficina         |
| ------------------ | ---- | ----------- | --------------- |
| 2024-0042          | Lia  | Lia Martins | Violão \| Canto |
| sem matrícula      | Nina |             | Piano           |
| sem matrícula      | Caio |             | Bateria         |
| matrícula inválida | Duda |             | Flauta          |

`2024-0042` e `20240042` viraram a mesma chave e a Lia foi juntada. A Nina e o Caio não têm matrícula, e eles nunca são juntados entre si (podem ser pessoas diferentes), então vão pro fim, um por linha, com o rótulo `sem matrícula`. Já o `pendente` da Duda não tem nenhum número, o `digitsOnly` rejeitou e ela foi pro fim com `matrícula inválida`.

### 6. Linhas sem chave resumidas (`unkeyed`)

É a mesma entrada do exemplo 5, só que agora quem não tem chave fica resumido numa linha.

```json
"mergeColumns": [
  {
    "column": "nome",
    "strategy": "extra-column",
    "unkeyed": { "strategy": "collapse-column", "into": "Nomes sem matrícula", "separator": " | " }
  },
  {
    "column": "oficina",
    "strategy": "concat",
    "separator": " | ",
    "unkeyed": { "strategy": "collapse-column", "into": "Oficinas sem matrícula", "separator": " | " }
  }
]
```

Saída:

| matricula          | nome | nome_2      | oficina         | Nomes sem matrícula | Oficinas sem matrícula |
| ------------------ | ---- | ----------- | --------------- | ------------------- | ---------------------- |
| 2024-0042          | Lia  | Lia Martins | Violão \| Canto |                     |                        |
| sem matrícula      |      |             |                 | Nina \| Caio        | Piano \| Bateria       |
| matrícula inválida |      |             |                 | Duda                | Flauta                 |

Agora sobram no máximo duas linhas no fim, uma pra quem veio sem chave e outra pra quem teve a chave rejeitada. Só as colunas com `unkeyed` aparecem nelas.

### 7. Arrumar antes de tudo (`fillEmpty` e `combineColumns`)

Essas duas rodam antes do modo, então funcionam até no `raw`. Aqui o exemplo é a agenda das aulas.

```json
{
    "mode": "raw",
    "fillEmpty": [
        { "column": "hora", "default": "19:00" },
        {
            "column": "sala",
            "fallbackColumns": ["sala_reserva"],
            "default": "a definir"
        }
    ],
    "combineColumns": [{ "into": "quando", "columns": ["data", "hora"] }]
}
```

Entrada:

| aula    | data  | hora  | sala   | sala_reserva |
| ------- | ----- | ----- | ------ | ------------ |
| Violão  | 10/03 | 18:00 | Sala 1 | Sala 2       |
| Canto   | 12/03 |       |        | Sala 3       |
| Bateria |       | 20:00 |        |              |

Saída:

| aula    | quando      | sala      | sala_reserva |
| ------- | ----------- | --------- | ------------ |
| Violão  | 10/03 18:00 | Sala 1    | Sala 2       |
| Canto   | 12/03 19:00 | Sala 3    | Sala 3       |
| Bateria |             | a definir |              |

A aula de Canto estava sem hora, ganhou o `19:00` do `default` e aí deu pra montar o `quando`. A sala vazia dela puxou a `sala_reserva`, já a Bateria não tinha nem reserva e ficou `a definir`. A Bateria também está sem data, então o `quando` dela ficou vazio em vez de sair só `20:00` pela metade. E as colunas `data` e `hora` sumiram, o `quando` entrou no lugar delas.

### 8. Um valor em cada coluna (`distribute`)

Em vez de juntar tudo numa célula, o `distribute` coloca cada valor numa coluna. E com o `sources` várias colunas entram na mesma lista.

```json
{
    "mode": "merge",
    "mergeKeyColumn": "email",
    "mergeColumns": [
        {
            "column": "instrumento 1",
            "strategy": "concat",
            "separator": " | ",
            "distribute": {
                "columns": ["instrumento 1", "instrumento 2"],
                "sources": ["instrumento 2"],
                "overflowInto": "outros instrumentos"
            }
        }
    ]
}
```

Entrada:

| email            | instrumento 1 | instrumento 2 |
| ---------------- | ------------- | ------------- |
| `lia@email.com`  | violão        | ukulele       |
| `lia@email.com`  | violão        | piano         |
| `lia@email.com`  | voz           |               |
| `theo@email.com` |               | bateria       |

Saída:

| email            | instrumento 1 | instrumento 2 | outros instrumentos |
| ---------------- | ------------- | ------------- | ------------------- |
| `lia@email.com`  | violão        | ukulele       | piano \| voz        |
| `theo@email.com` | bateria       |               |                     |

A Lia tinha 5 instrumentos nas duas colunas, um repetido. Sobraram 4 diferentes: 2 foram pras colunas e 2 pro `outros instrumentos`, nenhum se perdeu. O Theo só tinha coisa no `instrumento 2` e subiu pro `instrumento 1`, porque ele sempre preenche da esquerda pra direita.

Se não tiver `overflowInto`, ele cria a coluna da sobra sozinho:

```json
{
    "column": "cor",
    "strategy": "concat",
    "distribute": { "columns": ["cor_principal"] }
}
```

Entrada:

| produto            | cor    |
| ------------------ | ------ |
| Camiseta da escola | preta  |
| Camiseta da escola | branca |
| Camiseta da escola | vinho  |

Saída:

| produto            | cor_principal | cor_overflow  |
| ------------------ | ------------- | ------------- |
| Camiseta da escola | preta         | branca; vinho |

### 9. Regra diferente pra cada tipo de chave (`byGroup`)

Esse usa o normalizador `codigoProduto` do guia [Criando o seu próprio normalizador](#criando-o-seu-próprio-normalizador), que separa as letras do código como `group`. Os produtos `AB` ficam com uma cor por coluna e os `CD` ficam com as cores juntas numa coluna só deles.

```json
{
    "mode": "merge",
    "mergeKeyColumn": "codigo",
    "normalizerModules": ["./local/meusNormalizers.ts"],
    "mergeKeyNormalizer": "codigoProduto",
    "mergeColumns": [
        {
            "column": "cor",
            "strategy": "extra-column",
            "byGroup": {
                "CD": {
                    "strategy": "concat",
                    "into": "Cores CD",
                    "separator": " | "
                }
            }
        }
    ]
}
```

Entrada:

| codigo  | cor    |
| ------- | ------ |
| ab-0042 | azul   |
| AB 0042 | verde  |
| CD0042  | preto  |
| cd-0042 | branco |
| XYZ     | roxo   |

Saída:

| codigo            | cor  | cor_2 | Cores CD        |
| ----------------- | ---- | ----- | --------------- |
| ab-0042           | azul | verde |                 |
| CD0042            |      |       | preto \| branco |
| (codigo inválido) | roxo |       |                 |

`ab-0042` e `AB 0042` são o mesmo produto e viraram uma linha só, com `cor` e `cor_2`. O `CD0042` tem os mesmos números mas é de outro grupo, então nunca junta com o `AB`, e as cores dele foram pra `Cores CD`. O `XYZ` não tem o formato certo, foi rejeitado e foi pro fim com o rótulo padrão.

### 10. Tudo junto: inscrições de um festival

Esse é o exemplo que eu mais gosto. Um festival recebe inscrição de artista solo e de banda na mesma planilha. Artista solo se inscreve com e-mail (e às vezes se inscreve duas vezes), banda se inscreve com uma tag tipo `#nomedabanda` e cada integrante manda a sua. Tem gente que não disse o palco, e tem inscrição sem identificação ou com uma que não vale.

Primeiro um normalizador que sabe separar solo de banda (em `local/inscrito.ts`):

```ts
import { KeyNormalizer } from "../src/normalizers/registry";

const inscrito: KeyNormalizer = (raw) => {
    const texto = String(raw).trim().toLowerCase();

    if (texto.includes("@")) return { key: texto, group: "solo" };
    if (texto.startsWith("#"))
        return { key: texto.replace(/[^a-z0-9]/g, ""), group: "banda" };

    return null;
};

export const normalizers = { inscrito };
```

Depois a config:

```json
{
    "mode": "merge",
    "mergeKeyColumn": "Identificação",
    "normalizerModules": ["./local/inscrito.ts"],
    "mergeKeyNormalizer": "inscrito",
    "mergeEmptyKeyLabel": "sem identificação",
    "mergeRejectedKeyLabel": "identificação inválida",
    "fillEmpty": [
        {
            "column": "Palco",
            "fallbackColumns": ["Palco preferido"],
            "default": "a definir"
        }
    ],
    "mergeColumns": [
        { "column": "Inscrição", "strategy": "concat", "separator": " | " },
        {
            "column": "Nome",
            "strategy": "extra-column",
            "byGroup": {
                "banda": {
                    "strategy": "concat",
                    "into": "Integrantes",
                    "separator": " | "
                }
            },
            "unkeyed": {
                "strategy": "collapse-column",
                "into": "Nomes sem identificação",
                "separator": " | "
            }
        },
        {
            "column": "Estilo 1",
            "strategy": "concat",
            "separator": " | ",
            "distribute": {
                "columns": ["Estilo 1", "Estilo 2"],
                "sources": ["Estilo 2"],
                "overflowInto": "Outros estilos"
            }
        },
        { "column": "Palco", "strategy": "concat", "separator": " | " },
        { "column": "Confirmado", "strategy": "overwrite" }
    ]
}
```

Entrada:

| Inscrição | Nome        | Identificação    | Estilo 1 | Estilo 2 | Palco   | Palco preferido | Confirmado |
| --------- | ----------- | ---------------- | -------- | -------- | ------- | --------------- | ---------- |
| 1         | Lia Martins | `lia@email.com`  | MPB      | Folk     | Palco A |                 | sim        |
| 2         | Lia M.      | ` LIA@email.com` | Folk     | Indie    |         | Palco A         | não        |
| 3         | Rafa        | #Os Vagalumes    | Rock     |          |         | Palco B         | sim        |
| 4         | Duda        | #osvagalumes     | Rock     | Punk     | Palco B |                 | sim        |
| 5         | Theo        | `theo@email.com` | Jazz     |          |         |                 | sim        |
| 6         | Nina        |                  | Samba    |          | Palco A |                 | sim        |
| 7         | Caio        | caio             | Rap      |          |         |                 | não        |

Saída:

| Inscrição | Nome        | Nome_2 | Identificação          | Estilo 1 | Estilo 2 | Palco     | Palco preferido | Confirmado | Outros estilos | Integrantes  | Nomes sem identificação |
| --------- | ----------- | ------ | ---------------------- | -------- | -------- | --------- | --------------- | ---------- | -------------- | ------------ | ----------------------- |
| 1 \| 2    | Lia Martins | Lia M. | `lia@email.com`        | MPB      | Folk     | Palco A   |                 | não        | Indie          |              |                         |
| 3 \| 4    |             |        | #Os Vagalumes          | Rock     | Punk     | Palco B   | Palco B         | sim        |                | Rafa \| Duda |                         |
| 5         | Theo        |        | `theo@email.com`       | Jazz     |          | a definir |                 | sim        |                |              |                         |
|           |             |        | sem identificação      |          |          |           |                 |            |                |              | Nina                    |
|           |             |        | identificação inválida |          |          |           |                 |            |                |              | Caio                    |

Explicando por partes:

1. O `fillEmpty` deu o `Palco preferido` pra quem estava sem palco, e quem não tinha nenhum dos dois ficou com `a definir` (foi o caso do Theo)
2. O normalizador fez `lia@email.com` e ` LIA@email.com` virarem a mesma chave no grupo `solo`, e `#Os Vagalumes` e `#osvagalumes` a mesma no grupo `banda`. O `caio` não é e-mail nem tag, então foi rejeitado
3. Na `Inscrição` os números das inscrições juntadas ficaram lado a lado (`1 | 2`), pra dar pra achar as originais
4. No `Nome`, artista solo ficou com um nome por coluna (`Nome`, `Nome_2`) e banda teve os integrantes juntados em `Integrantes` pelo `byGroup`
5. Os estilos da Lia (MPB, Folk, Folk, Indie) viraram três diferentes, dois foram pras colunas e o outro pro `Outros estilos`
6. O `Confirmado` usa `overwrite`, então se a inscrição mais nova diz "não", fica "não"
7. A Nina (sem identificação) e o Caio (identificação inválida) foram pro fim, cada um com seu rótulo

## Preparando os dados

Antes do modo rodar dá pra arrumar as linhas com duas etapas opcionais, primeiro o `fillEmpty` e depois o `combineColumns`. As duas aparecem juntas no [exemplo 7](#7-arrumar-antes-de-tudo-fillempty-e-combinecolumns).

### Preencher vazios (`fillEmpty`)

Serve pra quando uma coluna vem vazia e dá pra usar o valor de outra no lugar, ou um texto padrão.

```json
"fillEmpty": [
  { "column": "hora", "default": "19:00" },
  { "column": "sala", "fallbackColumns": ["sala_reserva", "sala_antiga"], "default": "a definir" }
]
```

Se a célula já tem valor, nada muda. Se está vazia, ele procura nas `fallbackColumns` na ordem e usa a primeira que tiver alguma coisa. Se nenhuma tiver, usa o `default`, e sem `default` a célula fica como veio. Conta como vazio `null`, texto vazio ou só espaço.

Uma coisa que pode parecer estranha: as regras sempre olham a linha do jeito que veio do banco. Então se uma regra usa como reserva uma coluna que outra regra preencheu, ela vê o valor original. Fiz assim de propósito, pra ordem das regras não mudar o resultado.

### Juntar colunas (`combineColumns`)

Serve pra transformar várias colunas da mesma linha numa só.

```json
"combineColumns": [
  { "into": "nome completo", "columns": ["nome", "sobrenome"], "separator": " " }
]
```

Entrada:

| nome | sobrenome |
| ---- | --------- |
| Lia  | Martins   |
| Theo |           |

Saída:

| nome completo |
| ------------- |
| Lia Martins   |
|               |

Os valores são juntados na ordem de `columns`, com o `separator` (se não tiver, é um espaço). Se alguma coluna estiver vazia o resultado fica vazio, pra não sair valor pela metade, por isso o Theo ficou sem. Dá pra usar o `fillEmpty` antes se quiser evitar isso.

As colunas de origem somem da planilha, a não ser que tenha `"keepSources": true`, e a coluna nova aparece no lugar da primeira de origem em vez de ir lá pro fim.

## Distribuir valores em várias colunas (`distribute`)

No `merge`, o `concat` normalmente junta tudo numa célula (`"violão; piano; voz"`). Com o `distribute`, cada valor vai pra uma coluna. O [exemplo 8](#8-um-valor-em-cada-coluna-distribute) mostra ele funcionando.

| Campo          | O que faz                                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------- |
| `columns`      | As colunas de destino, em ordem. Cada valor diferente vai pra uma                                                     |
| `sources`      | Opcional. Outras colunas que entram na mesma lista junto com a `column`                                               |
| `overflowInto` | Opcional. Coluna pro que sobrar quando tem mais valor que coluna. Sem ele, o ETL cria uma `<column>_overflow` sozinho |

Valor repetido aparece uma vez só, e nenhum valor é jogado fora: o que não cabe vai pro overflow, separado pelo `separator`. As colunas de `column` e `sources` que não são destino somem da planilha, e coluna de destino que não recebe nada fica vazia (ela não guarda valor velho de outra linha). Isso vale até pra linha que ficou sozinha no grupo, pra planilha sair com as mesmas colunas em todas as linhas.

Ele só funciona com `strategy: "concat"`. Dá pra usar dentro do `byGroup`, mas não junto com o `into`, porque quem decide as colunas aí é o `distribute`. Se configurar errado, a validação da config avisa antes de rodar.

## Separar as pendências (`validation`)

Tem coisa que não dá pra consertar sozinho, tipo um e-mail escrito errado ou um campo obrigatório vazio. Pra isso tem o `validation`: você diz as regras e as linhas que não passam vão pra uma aba separada, com o motivo escrito do lado. Aí fica fácil alguém olhar e corrigir no sistema.

```json
"validation": {
  "pendingSheet": "Pendências",
  "reasonColumn": "Motivo",
  "rules": [
    { "column": "nome", "rule": "required" },
    { "column": "email", "rule": "pattern", "pattern": "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", "message": "e-mail fora do formato" },
    { "column": "plano", "rule": "oneOf", "values": ["mensal", "trimestral", "anual"], "ignoreCase": true },
    { "column": "matricula", "rule": "normalizer", "normalizer": "digitsOnly", "message": "matrícula sem número" }
  ]
}
```

Entrada:

| matricula | nome | email            | plano      |
| --------- | ---- | ---------------- | ---------- |
| 2024-0042 | Lia  | `lia@email.com`  | Mensal     |
| 2024-0051 | Theo | theo.email.com   | anual      |
| pendente  |      | `nina@email.com` | semanal    |
| 2024-0060 | Caio |                  | trimestral |

Na primeira aba (só essas seguem pro modo):

| matricula | nome | email           | plano      |
| --------- | ---- | --------------- | ---------- |
| 2024-0042 | Lia  | `lia@email.com` | Mensal     |
| 2024-0060 | Caio |                 | trimestral |

Na aba `Pendências`:

| Motivo                                                          | matricula | nome | email            | plano   |
| --------------------------------------------------------------- | --------- | ---- | ---------------- | ------- |
| e-mail fora do formato                                          | 2024-0051 | Theo | theo.email.com   | anual   |
| nome vazio; plano com valor não permitido; matrícula sem número | pendente  |      | `nina@email.com` | semanal |

As regras que existem:

| `rule`       | Passa quando                         | Campos extras                                                                                                     |
| ------------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `required`   | a célula não tá vazia                | nenhum                                                                                                            |
| `pattern`    | o valor bate com a expressão regular | `pattern` e `flags` (opcional, tipo `"i"` pra ignorar maiúscula)                                                  |
| `oneOf`      | o valor tá na lista                  | `values` e `ignoreCase` (opcional)                                                                                |
| `normalizer` | o normalizador não devolve `null`    | `normalizer`: o nome de um normalizador, pronto ou seu (veja [Normalizadores de chave](#normalizadores-de-chave)) |

Toda regra aceita um `message` pra trocar o texto do motivo, senão ele sai tipo `nome vazio` ou `plano com valor não permitido`. E se a linha falha em mais de uma regra, os motivos aparecem juntos separados por `; `.

Só o `required` reclama de célula vazia, as outras deixam passar. Foi por isso que o Caio passou mesmo sem e-mail. Se o campo for obrigatório e também tiver um formato, coloca as duas regras na mesma coluna.

O `normalizer` é bom pra reaproveitar o normalizador do merge. Se ele rejeitar a chave, a linha vai inteira pras pendências em vez de ir pro fim da planilha só com o rótulo.

A validação roda depois do `fillEmpty` e do `combineColumns`, então o que o `fillEmpty` preencheu já conta.

O `pendingSheet` (padrão `Pendências`) é o nome da aba, e se ela não existir ele cria. O `reasonColumn` (padrão `Motivo`) é o nome da coluna do motivo, que fica sempre na primeira coluna. Se não tiver nenhuma pendência a aba fica vazia, ela é limpa do mesmo jeito pra não sobrar pendência antiga.

E se o `pattern` tiver uma regex inválida ou o `normalizer` não existir, ele avisa antes de ler o banco.

## Normalizadores de chave

### Pra que serve

No modo `merge` ele junta as linhas que têm a mesma chave. Só que `Ana@Email.com` e `ana@email.com ` são a mesma pessoa e pro computador são textos diferentes, então a junção não acontece.

O normalizador resolve isso. Ele é uma função que roda em cada valor da coluna-chave antes de comparar, e devolve uma de três coisas:

| Devolve                        | Significa                                                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `{ key: "abc" }`               | "A chave limpa é `abc`". Linhas com a mesma `key` são unificadas                                                |
| `{ key: "0042", group: "AB" }` | Igual ao de cima, mas com uma categoria. Linhas de categorias diferentes nunca se juntam, mesmo com `key` igual |
| `null`                         | "Esse valor não serve como chave" (rejeitada)                                                                   |

Valor vazio (`null`, texto vazio ou só espaço) nem chega no normalizador, vai direto pro grupo das linhas sem chave.

As rejeitadas (`null`) também viram "sem chave": ficam sozinhas, nunca se juntam com outra e vão pro fim da planilha com o rótulo do `mergeRejectedKeyLabel`.

A chave normalizada só serve pra comparar. O valor que aparece na planilha continua sendo o da primeira linha do grupo.

### Como ativar um normalizador

No `config.json`, é só colocar o nome dele em `mergeKeyNormalizer`:

```json
{
    "mode": "merge",
    "mergeKeyColumn": "email",
    "mergeKeyNormalizer": "lowercase",
    "mergeColumns": [{ "column": "nome", "strategy": "concat" }]
}
```

Sem `mergeKeyNormalizer`, ele usa o `trim` (que só tira os espaços das pontas).

O que acontece com essa config:

| email (banco)    | nome (banco) |     | email (planilha) | nome (planilha) |
| ---------------- | ------------ | --- | ---------------- | --------------- |
| `Ana@Email.com`  | Ana          |     | `Ana@Email.com`  | Ana; Ana Paula  |
| ` ana@email.com` | Ana Paula    |     |                  |                 |

### Normalizadores que já vêm prontos

| Nome           | O que faz                                    | Exemplo                                   | Rejeita quando          |
| -------------- | -------------------------------------------- | ----------------------------------------- | ----------------------- |
| `trim`         | Tira espaços do começo e do fim. É o padrão  | `" AB-1 "` vira `"AB-1"`                  | Nunca                   |
| `lowercase`    | Faz o `trim` e deixa tudo minúsculo          | `"Ana@Email.COM "` vira `"ana@email.com"` | Nunca                   |
| `digitsOnly`   | Fica só com os números                       | `"(53) 99999-1234"` vira `"53999991234"`  | Não sobra nenhum dígito |
| `alphanumeric` | Fica só com letras e números, tudo minúsculo | `"AB-0042 / rev"` vira `"ab0042rev"`      | Não sobra nada          |

Onde cada um costuma servir:

- `lowercase`: e-mail, username, qualquer texto que muda de maiúscula pra minúscula
- `digitsOnly`: telefone e código numérico escrito com ponto, traço e parêntese
- `alphanumeric`: código de produto que aparece como `AB-0042`, `ab 0042` e `AB0042`

### Criando o seu próprio normalizador

Se nenhum dos prontos serve, dá pra escrever o seu, é só uma função. Vou mostrar com um exemplo: código de produto no formato letras + números, que às vezes vem com hífen, espaço ou minúscula (`ab-0042`, `AB 0042`, `AB0042`). A ideia é que `AB0042` e `CD0042` não sejam juntados, porque são de linhas diferentes.

Primeiro cria um arquivo, eu uso o `local/meusNormalizers.ts`. A pasta `local/` está no `.gitignore`, então o que você coloca lá não vai pro GitHub.

Depois escreve a função:

```ts
import { KeyNormalizer } from "../src/normalizers/registry";

const codigoProduto: KeyNormalizer = (raw) => {
    const limpo = String(raw)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
    const partes = limpo.match(/^([A-Z]+)(\d+)$/);

    if (!partes) return null;

    return { key: partes[2] ?? "", group: partes[1] ?? "" };
};

export const normalizers = { codigoProduto };
```

Explicando cada parte:

- `raw` é o valor que veio do banco. Pode ser texto ou número, por isso tem o `String(raw)`
- o `toUpperCase().replace(...)` deixa tudo maiúsculo e tira o que não é letra nem número
- o `match(...)` separa as letras (`partes[1]`) dos números (`partes[2]`). Se o formato não bate, ele devolve `null` e a linha vai pras rejeitadas
- `key` são os números e `group` são as letras. Assim `AB0042` e `CD0042` têm a mesma `key` mas grupos diferentes, e não se juntam
- o `?? ""` está ali porque o `tsconfig` do projeto liga o `noUncheckedIndexedAccess`, e aí o TypeScript acha que `partes[1]` pode ser `undefined`
- a última linha é obrigatória: o arquivo tem que exportar um objeto chamado `normalizers`. O nome de cada propriedade é o nome que você usa no `config.json`, e dá pra colocar vários no mesmo arquivo

Aí avisa o projeto que esse arquivo existe, no `config.json`:

```json
{
    "normalizerModules": ["./local/meusNormalizers.ts"],
    "mergeKeyNormalizer": "codigoProduto"
}
```

O caminho é a partir da pasta onde você roda o `npm start`. O arquivo pode ser `.ts` (funciona porque o `npm start` usa o `tsx`), `.js` ou `.cjs`. Se for `.js` ou `.cjs`, exporta com `module.exports = { normalizers: { codigoProduto } }`.

Vale testar também. Cria um `local/meusNormalizers.test.ts`, o `npm test` roda os testes dessa pasta junto:

```ts
import { describe, it, expect } from "vitest";
import { normalizers } from "./meusNormalizers";

describe("codigoProduto", () => {
    it("aceita formatos diferentes do mesmo código", () => {
        expect(normalizers.codigoProduto("ab-0042")).toEqual({
            key: "0042",
            group: "AB",
        });
        expect(normalizers.codigoProduto("AB 0042")).toEqual({
            key: "0042",
            group: "AB",
        });
    });

    it("rejeita o que não tem o formato esperado", () => {
        expect(normalizers.codigoProduto("sem codigo")).toBeNull();
    });
});
```

Depois é só rodar com `npm start`. Se o nome no `mergeKeyNormalizer` não existir, o erro mostra a lista dos que existem.

### Ideias de uso

| Situação                                                         | Como resolver                                                                            |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| E-mails com maiúscula/minúscula misturada                        | `lowercase`                                                                              |
| Telefones escritos de jeitos diferentes                          | `digitsOnly`, ou um seu que também tire o `55` do começo                                 |
| Códigos de produto com hífen ou espaço                           | `alphanumeric`, ou um seu com `group` pelas letras (como no exemplo acima)               |
| Matrícula com prefixo da unidade (`SP-1234`, `RJ-1234`)          | Um seu com `group` = prefixo e `key` = número, pra unidades diferentes nunca se juntarem |
| Dois formatos de ID na mesma coluna (ex: 8 dígitos e 12 dígitos) | Um seu que tire tudo que não é número e use o tamanho como `group`                       |
| Valor com texto grudado no fim (`12345abc`)                      | Um seu que pegue só a parte inicial com uma regex                                        |
| Valores de "preenchimento" (`n/a`, `0000`, `-`)                  | Um seu que devolva `null` pra eles                                                       |

### Estratégia diferente por grupo

Quando o normalizador devolve um `group`, cada coluna do `mergeColumns` pode ter uma regra própria pra cada grupo usando o `byGroup`. O grupo que não tem regra usa a `strategy` normal da coluna.

Usando o `codigoProduto` de cima (o `group` são as letras do código), dá pra deixar os produtos `AB` com `cor`, `cor_2`, `cor_3` e os `CD` com todas as cores juntas numa coluna só:

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

A chave do `byGroup` (`"CD"`) é o `group` que o normalizador devolve, e maiúscula faz diferença. O `strategy` aceita as mesmas três da coluna. O `into` é opcional: com ele o valor vai pra uma coluna nova e a original fica vazia nessas linhas, sem ele continua na original. O `separator` também é opcional e só vale pro `concat`.

A regra vale até pras linhas que ficaram sozinhas no grupo, pra todo mundo do mesmo grupo ficar no mesmo formato.

### Cuidados

- a função não pode mexer em nada fora dela nem depender de coisa de fora. Pro mesmo valor tem que devolver sempre o mesmo resultado
- na dúvida, devolve `null`. É melhor um valor esquisito ir pro fim da planilha com rótulo do que juntar com a pessoa errada
- dois normalizadores com o mesmo nome dão erro, e isso vale pros nomes dos prontos também
- se o `normalizerModules` apontar pra um arquivo que não existe, ou que não exporta `normalizers`, o erro diz qual é o arquivo

## Rodando

```bash
npm start
```

Ele lê da fonte, aplica o que está na config e escreve no destino.

Pra trocar o modo sem mexer no `config.json`:

```bash
npm start -- --mode dedupe
```

Pra usar outro arquivo de config:

```bash
npm start -- --config ./outro-config.json
```

Os caminhos que estão dentro da config (arquivos, credenciais, normalizadores) contam a partir da pasta onde a config está. Por isso a `examples/config.csv.json` usa só `./alunos.csv`.

Se você quer ver o que vai sair antes de mexer na planilha de verdade, usa o `--dry-run`. Ele faz tudo igualzinho, só que não grava nada, e no fim mostra as primeiras linhas do resultado numa tabelinha:

```bash
npm start -- --dry-run
```

Com o exemplo dá pra testar assim: `npm run example -- --dry-run`.

No final de toda execução aparece um resumo com quantas linhas entraram e saíram de cada etapa. Esse é o do exemplo:

```text
Resumo da execução
  Modo: merge
  Linhas lidas: 7
  fillEmpty: de 7 para 7 (0 ms)
  validation: de 7 para 4, 3 pendências (1 ms)
  merge: de 4 para 3 (0 ms)
  Linhas no resultado: 3
  Pendências: 3
  Tempo total: 5 ms
```

Isso ajuda bastante quando o resultado vem estranho, porque dá pra ver em qual etapa as linhas sumiram.

Se der erro, ele mostra a mensagem e termina com código 1. Então dá pra colocar num script ou num agendador sem ele fingir que deu tudo certo.

Uma coisa importante: toda vez que roda, ele limpa a aba antes de escrever (a primeira aba e a de pendências, se tiver `validation`). Assim não sobra linha velha. Então não deixa anotação sua nessas abas, usa outra aba.

## O app pro desktop

Também tem um aplicativo com tela, pra quem não quer mexer no terminal nem em JSON. Ele fica em `apps/desktop` e é feito com Electron e React. Pra abrir:

```bash
npm install
npm run desktop
```

Na primeira vez ele pergunta de onde vêm os dados e onde salvar o resultado, num passo a passo, e cria a configuração pra você. Se você já tem uma, é só escolher o arquivo.

O que dá pra fazer nele:

- na tela de Regras, montar frases tipo "Quando `email` estiver com e-mail inválido, mandar para Pendências" e escolher o que fazer com os cadastros repetidos
- em Exportar, ver uma prévia (não grava nada) e depois exportar de verdade, com confirmação
- no Início, ver os números e gráficos da última exportação e como as pendências foram mudando
- no Histórico, ver todas as vezes que rodou

Ele usa o mesmo motor do terminal por baixo, então a config que você faz num serve no outro. As regras mais avançadas (normalizador, regex própria, merge com estratégia por coluna) ainda só dão pra configurar no arquivo, e o app mostra elas como "regra avançada" sem estragar nada.

## Usando dentro de outro código

Também dá pra chamar o Datera de dentro de outro projeto, sem ser pelo terminal. É o mesmo código que o `npm start` usa por baixo:

```ts
import { formatReport, loadConfig, runEtl } from "./src";

async function rodar() {
    const config = loadConfig("./config.json");
    const report = await runEtl(config, { dryRun: true });

    console.log(formatReport(report).join("\n"));
    console.log(report.preview);
}

rodar();
```

O `runEtl` devolve um relatório com as mesmas informações do resumo (`rowsRead`, `rowsOut`, `pendingRows`, `steps` e `durationMs`). No dry-run ele também traz as primeiras linhas do resultado em `preview`.

As opções que ele aceita:

| Opção            | O que faz                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `mode`           | troca o modo, igual o `--mode`                                                                                                       |
| `dryRun`         | faz tudo mas não grava nada                                                                                                          |
| `logger`         | pra onde vão as mensagens. O padrão é o console, o `silentLogger` não mostra nada e dá pra passar o seu com `info`, `warn` e `error` |
| `source`, `sink` | uma fonte e um destino prontos, no lugar dos que viriam da config. Eu uso isso nos testes pra ler e escrever na memória              |
| `previewSize`    | quantas linhas vêm no `preview` (o padrão é 5)                                                                                       |

Se alguma coisa der errado ele lança o erro, então vale colocar num `try/catch`.

## Testes

| Comando                   | O que faz                                                          |
| ------------------------- | ------------------------------------------------------------------ |
| `npm run example`         | Roda o exemplo com CSV, sem precisar de banco nem Google           |
| `npm run example:excel`   | O mesmo exemplo, mas gerando um arquivo do Excel                   |
| `npm test`                | Testes unitários (Vitest), sem precisar de banco ou planilha reais |
| `npm run test:config`     | Carrega e valida o `config.json`                                   |
| `npm run test:connection` | Conecta no banco real e mostra as 3 primeiras linhas               |
| `npm run test:sheet`      | Escreve duas linhas de teste numa planilha real                    |

## Estrutura

```text
src/
  cli.ts                  # argumentos da linha de comando (--config, --mode, --dry-run)
  env.ts                  # ajuda pra ler variável de ambiente
  main.ts                 # o que o npm start roda: lê a config, chama o runEtl e mostra o resumo
  index.ts                # o que dá pra importar de fora (runEtl, loadConfig, registrar adapter...)
  logger.ts               # pra onde vão as mensagens (console, silencioso ou memória)
  types.ts                # TableRow, o formato de linha que todo mundo usa
  pipeline/
    runEtl.ts             # lê da fonte, passa pelas etapas e grava no destino
    steps.ts              # monta a lista de etapas a partir da config
    modes.ts              # raw, dedupe e merge
    report.ts             # monta o resumo do final
    types.ts              # Step e EtlReport
  config/
    index.ts              # o que o resto do projeto importa da config
    schema.ts             # o schema zod da config inteira
    ioSchema.ts           # source e destination
    prepareSchema.ts      # fillEmpty e combineColumns
    validationSchema.ts   # validation
    mergeSchema.ts        # mergeColumns, distribute, byGroup
    load.ts               # lê o json e junta com o .env
  io/
    types.ts              # interfaces Source e Sink
    factory.ts            # escolhe o adapter pela config
    header.ts             # monta o cabeçalho das saídas
    files.ts              # ler e escrever arquivo, nome do arquivo de pendências
    mysql/                # client.ts (conexão e leitura paginada) e mysqlSource.ts
    sheets/               # client.ts (leitura e escrita em abas), sheetsSource.ts e sheetsSink.ts
    csv/                  # csvFormat.ts (leitor e escritor), csvSource.ts, csvSink.ts
    json/                 # jsonSource.ts e jsonSink.ts
    excel/                # excelSource.ts, excelSink.ts, excelCell.ts (converte o valor da célula) e workbook.ts
    custom/               # registry.ts e loader.ts dos adapters que vêm de arquivo seu
  filters/
    types.ts              # interface Filter
    fillEmpty.ts          # preenche célula vazia
    combine.ts            # junta colunas da mesma linha
    validate.ts           # separa as linhas com problema
    dedupe.ts             # tira linhas repetidas
    merge.ts              # junta as linhas com a mesma chave
    mergeStrategies.ts    # concat, overwrite, extra-column e distribute
    mergeUnkeyed.ts       # o que fazer com as linhas sem chave
    *Types.ts             # os tipos de cada filtro
  normalizers/
    registry.ts           # onde os normalizadores ficam registrados
    builtin.ts            # os prontos (trim, lowercase, digitsOnly, alphanumeric)
    loader.ts             # carrega normalizador de arquivo seu
  tests/                  # testes (Vitest), nas mesmas pastas do código: io/, filters/, normalizers/, pipeline/
apps/desktop/             # o app com tela (Electron + React)
  scripts/                # dev.ts e build.ts, que compilam com esbuild
  src/main/               # a parte que roda no Node: janela, arquivos, chama o runEtl
  src/preload/            # a ponte segura entre a tela e o Node
  src/renderer/           # as telas em React (pages/, components/, lib/, styles/)
  src/shared/api.ts       # os tipos que a tela e o Node usam pra conversar
examples/                 # CSV e config de exemplo (npm run example)
local/                    # (ignorada pelo git) seus normalizadores e testes pessoais
scripts/                  # scripts pra testar na mão (banco, config, sheets)
.github/workflows/        # CI (type-check e testes a cada push)
```

## Ainda falta

- instalador .exe do app (hoje ele abre pelo `npm run desktop`)
- build de produção (hoje roda tudo pelo `tsx`)
