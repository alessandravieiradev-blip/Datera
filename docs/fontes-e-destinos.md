<p align="center">
  <a href="../README.md"><img src="https://img.shields.io/badge/In%C3%ADcio-475569?style=for-the-badge" alt="Início"></a>
  <a href="gestores.md"><img src="https://img.shields.io/badge/Para%20gestores-2563EB?style=for-the-badge" alt="Guia para gestores"></a>
  <a href="devs.md"><img src="https://img.shields.io/badge/Para%20devs-16181D?style=for-the-badge" alt="Guia para devs"></a>
</p>

[Guia para devs](devs.md) › Fontes e destinos

# Fontes e destinos

O ETL lê de um lugar (`source`) e escreve em outro (`destination`). Hoje dá pra ler de MySQL, PostgreSQL, SQL Server, SQLite, Google Sheets, Excel, CSV, JSON, XML e Parquet e escrever no Google Sheets, no Excel, em CSV, em JSON, em XML, em Parquet e numa tabela nova de MySQL, PostgreSQL, SQL Server ou SQLite, misturando do jeito que quiser.

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

Pra quem usa o Datera como pacote do npm, Excel, Parquet, Google Sheets e os bancos de servidor precisam de um pacote a mais, que só é instalado se for usar. A lista está em [Comandos e API](api.md#só-o-que-você-usar).

Por dentro, tudo vira a mesma coisa: uma lista de linhas, e cada linha é um objeto `{ coluna: valor }`. Os filtros (fillEmpty, validation, merge...) só entendem isso, então nem sabem de onde o dado veio. Cada formato tem uma pecinha que converte do formato dela pra essa lista, ou o contrário. Descobri depois que isso tem nome, é o padrão Adapter, e é por causa dele que dá pra colocar formato novo sem mexer no resto.

## Fontes (`source`)

| `type`      | Campos                                                                                         | Observações                                                                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mysql`     | `host`, `port`, `user`, `password`, `database`, `table`, `ssl?`                                | Todos opcionais: o que faltar vem das variáveis do `.env` ou dos campos antigos (`dbHost`, `tableName`...)                                       |
| `postgres`  | `host`, `port`, `user`, `password`, `database`, `table`, `ssl?`                                | O que faltar pode vir das variáveis `DB_*` do `.env`. Porta padrão `5432`. Veja [Bancos de dados](#bancos-de-dados)                              |
| `sqlserver` | `host`, `port`, `user`, `password`, `database`, `table`, `encrypt?`, `trustServerCertificate?` | O que faltar pode vir das variáveis `DB_*` do `.env`. Porta padrão `1433`. Veja [Bancos de dados](#bancos-de-dados)                              |
| `sqlite`    | `path`, `table`                                                                                | Um arquivo `.db` ou `.sqlite`. Ele só lê, o arquivo nunca é alterado                                                                             |
| `csv`       | `path`, `delimiter?`, `encoding?`                                                              | Sem `delimiter` ele descobre sozinho (`,`, `;`, tab ou `\|`). `encoding` é `"utf-8"` (padrão) ou `"latin1"`                                      |
| `json`      | `path`, `recordsPath?`                                                                         | O arquivo tem que ser uma lista de objetos. Se a lista tá dentro de outras chaves, usa `recordsPath` tipo `"dados.alunos"`                       |
| `xml`       | `path`, `recordsPath?`                                                                         | Cada registro vira uma linha. O `recordsPath` começa pelo elemento principal, tipo `"escola.alunos.aluno"`. Veja [XML](#xml)                     |
| `parquet`   | `path`                                                                                         | Arquivo `.parquet`. Veja [Parquet](#parquet)                                                                                                     |
| `excel`     | `path`, `sheet?`, `allSheets?`, `sheetColumn?`                                                 | Arquivo `.xlsx`. Sem `sheet`, ele lê a primeira aba. Com `"allSheets": true`, lê todas. A primeira linha tem que ser o cabeçalho                 |
| `sheets`    | `spreadsheetId`, `sheet?`, `credentialsPath?`, `allSheets?`, `sheetColumn?`                    | Uma planilha do Google. Sem `sheet`, lê a primeira aba. Com `"allSheets": true`, lê todas. Sem `credentialsPath`, usa o mesmo das outras configs |
| `custom`    | `adapter`, `options?`                                                                          | Um adapter seu, carregado pelo `adapterModules`. Veja [E se o meu formato não tá aqui?](fontes-e-destinos.md#e-se-o-meu-formato-não-tá-aqui)     |

Com `"allSheets": true` no Excel ou no Google Sheets, ele lê todas as abas visíveis e junta tudo numa lista só, com uma coluna dizendo de qual aba veio cada linha. A coluna se chama `aba`, ou o nome que você colocar em `sheetColumn`:

```json
"source": { "type": "excel", "path": "./matriculas.xlsx", "allSheets": true, "sheetColumn": "mes" }
```

Dá pra usar essa coluna nas regras como qualquer outra, tipo pra saber em que mês cada aluno apareceu depois de um merge. Não dá pra usar `sheet` e `allSheets` juntos, e se a fonte e o destino forem a mesma planilha do Google, o destino precisa ser outra planilha (senão ele leria a aba do resultado também).

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

## Destinos (`destination`)

| `type`                           | Campos                                          | A aba de pendências vira                                                                                                        |
| -------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `sheets`                         | `spreadsheetId`, `credentialsPath`, `sheet?`    | outra aba na mesma planilha (a principal é a primeira aba, ou a que você colocar em `sheet`)                                    |
| `csv`                            | `path`, `delimiter?`, `bom?`, `escapeFormulas?` | outro arquivo do lado: `resultado.csv` → `resultado.pendencias.csv`                                                             |
| `json`                           | `path`                                          | outro arquivo do lado: `resultado.json` → `resultado.pendencias.json`                                                           |
| `xml`                            | `path`, `root?`, `record?`                      | outro arquivo do lado: `resultado.xml` → `resultado.pendencias.xml`                                                             |
| `parquet`                        | `path`                                          | outro arquivo do lado: `resultado.parquet` → `resultado.pendencias.parquet`                                                     |
| `excel`                          | `path`, `sheet?`                                | outra aba no mesmo arquivo (a principal se chama `Dados`, ou o nome que você colocar em `sheet`)                                |
| `mysql`, `postgres`, `sqlserver` | os mesmos da fonte, mais `pendingTable?`        | outra tabela no mesmo banco: `alunos` → `alunos_pendencias`. Veja [Bancos de dados como destino](#bancos-de-dados-como-destino) |
| `sqlite`                         | `path`, `table`, `pendingTable?`                | outra tabela no mesmo arquivo: `alunos` → `alunos_pendencias`                                                                   |
| `custom`                         | `adapter`, `options?`                           | o seu adapter recebe `{ name: "Pendências" }` no `write` e decide                                                               |

O CSV sai com vírgula. Se for abrir no Excel em português, coloca `"delimiter": ";"`. Toda célula de texto que o Excel leria como fórmula (começando com `=`, `+`, `-` ou `@`, e que não é só um número) sai com um `'` na frente, pra ninguém esconder uma fórmula nos dados. Se o arquivo não for pro Excel, dá pra desligar com `"escapeFormulas": false`. Ele também sai com um caractere invisível no começo (o `bom`, que já vem ligado) pro Excel mostrar os acentos certo. Se o arquivo for pra outro programa e ele reclamar desse caractere, coloca `"bom": false`. E se a pasta do arquivo não existir, ele cria.

Pra ler do Google Sheets, a planilha de origem também tem que estar compartilhada com o e-mail da service account (pode ser só como Leitor). Os números chegam como número e as datas chegam do jeito que aparecem na planilha.

A planilha de onde ele lê nunca é alterada, ele só escreve no destino. O jeito mais seguro é usar outra planilha pro destino e compartilhar a original só como Leitor, aí nem o Google deixa mexer nela.

Se quiser ler e escrever na mesma planilha, dá, mas precisa dizer as abas: `sheet` na fonte com a aba dos dados originais e `sheet` no destino com a aba do resultado. As duas (e a de pendências) têm que ter nomes diferentes. Se faltar alguma coisa ou algum nome bater, ele avisa e nem começa. O mesmo vale pra arquivo: a fonte e o destino não podem ser o mesmo arquivo. A exceção é o SQLite, que pode ler de uma tabela e gravar em outra do mesmo `.db`.

Sobre o Excel, umas coisas que acontecem por baixo:

- célula com fórmula vira o valor calculado, não a fórmula
- data vira texto no formato `2024-03-10` (ou com a hora junto, se tiver hora)
- texto com negrito, cor ou link vira texto normal
- linha totalmente vazia é pulada
- na saída o arquivo é recriado toda vez que roda, então não guarda coisa sua dentro dele. O cabeçalho sai em negrito e fixo, e a largura das colunas se ajusta sozinha
- o Excel não aceita alguns caracteres em nome de aba (tipo `/` e `:`) nem nome com mais de 31 letras, então ele arruma isso sozinho

## Bancos de dados

Além do MySQL, ele lê de PostgreSQL, SQL Server e SQLite. Os três funcionam do mesmo jeito: pegam a tabela inteira (ou uma view) e cada linha do banco vira uma linha do Datera.

```json
"source": {
    "type": "postgres",
    "host": "localhost",
    "user": "escola",
    "database": "musica",
    "table": "public.alunos"
}
```

Umas coisas que valem pros três:

- a senha pode ficar no `.env` como `DB_PASSWORD`, igual no MySQL. As outras `DB_*` também valem. O app de gestores já faz isso sozinho
- a tabela pode vir com o schema na frente, tipo `public.alunos` no PostgreSQL ou `dbo.alunos` no SQL Server
- o nome da tabela vai protegido na consulta, então não dá pra alguém colocar um comando SQL escondido nele
- data vira texto no formato `2024-03-10` (ou com a hora junto), verdadeiro/falso vira `true`/`false` e número muito grande vira texto pra não perder dígito
- como fonte, ele só faz `SELECT` e nunca altera o banco. Mesmo assim, o mais seguro é usar um usuário que só tem permissão de leitura

Do PostgreSQL e do SQL Server, o Datera usa os pacotes `pg` e `mssql`. Neste repositório eles já vêm no `npm install`. Pra quem usa o Datera como pacote, é `npm install pg` ou `npm install mssql`, só o do banco que for usar.

No PostgreSQL e no MySQL, se o servidor pedir conexão segura (os da nuvem normalmente pedem), coloca `"ssl": true`. Pra banco fora da sua rede, vale colocar sempre, senão a senha e os dados passam pela internet sem proteção.

No SQL Server a conexão já é criptografada por padrão. Se for um SQL Server na sua máquina ou na rede da empresa, é comum ele usar um certificado que ele mesmo gerou, e aí aparece um erro de certificado. Nesse caso, e só se você confia naquele servidor, coloca `"trustServerCertificate": true`.

O SQLite é um banco que mora num arquivo só, e o Node já sabe ler ele sem instalar nada (precisa do Node 22.13 ou mais novo). O arquivo é aberto só pra leitura. Se a tabela não existir, ele avisa quais existem:

```json
"source": { "type": "sqlite", "path": "./escola.db", "table": "alunos" }
```

## Bancos de dados como destino

Ele também grava o resultado numa tabela de banco, no MySQL, no PostgreSQL, no SQL Server ou num arquivo SQLite. Os campos são os mesmos da fonte, e `table` é o nome da tabela onde gravar:

```json
"destination": {
    "type": "postgres",
    "host": "localhost",
    "user": "escola",
    "database": "musica",
    "table": "alunos_organizados"
}
```

```json
"destination": { "type": "sqlite", "path": "./saida/escola.db", "table": "alunos_organizados" }
```

O jeito que ele grava:

- a tabela é criada pelo próprio Datera, e as colunas saem do resultado. Coluna só com número inteiro vira inteiro, com número quebrado vira decimal, e qualquer texto no meio faz ela virar texto
- as pendências vão pra outra tabela, com `_pendencias` no fim do nome (`alunos_organizados_pendencias`). Se quiser outro nome, coloca `"pendingTable": "revisar"`
- toda vez que roda, a tabela é apagada e criada de novo com o resultado novo, igual os arquivos
- tudo acontece numa transação: ou grava tudo, ou não grava nada. Se der erro no meio, a tabela de antes continua lá do jeito que estava. No MySQL, que não consegue desfazer um `CREATE TABLE`, ele grava numa tabela temporária e só no fim troca o nome dela pelo certo, o que dá o mesmo efeito
- se não tiver nenhuma linha (tipo quando não sobra pendência), ele não cria a tabela. Se ela já existia de antes, fica vazia

A parte que eu mais cuidei é não apagar nada de ninguém. Pra isso, ele anota numa tabela chamada `datera_tabelas` o nome de cada tabela que ele criou, e só apaga e recria tabela que está nessa lista. Se você colocar em `table` o nome de uma tabela que já existe e que não foi ele que criou, ele avisa e não mexe em nada. Ele também não deixa gravar na tabela de onde está lendo, nem usar o mesmo nome pro resultado e pras pendências.

A senha do banco de destino fica no `.env`, com as variáveis `DEST_DB_*` (`DEST_DB_HOST`, `DEST_DB_PORT`, `DEST_DB_USER`, `DEST_DB_PASSWORD`, `DEST_DB_NAME` e `DEST_DB_TABLE`). O `DEST_` é pra não misturar com as `DB_*` da fonte, porque dá pra ler de um banco e gravar em outro.

Se a fonte e o destino forem o mesmo banco, o que faltar no destino é copiado da fonte. Isso só acontece quando o destino não tem `host` ou tem o mesmo `host` e a mesma porta da fonte: se o servidor for outro, nada é copiado, pra senha da fonte nunca ir parar em outro endereço. Então, pra gravar no mesmo servidor e no mesmo banco de onde ele lê, basta o `type` e a `table`:

```json
"source": { "type": "mysql", "host": "localhost", "user": "escola", "database": "musica", "table": "alunos" },
"destination": { "type": "mysql", "table": "alunos_organizados" }
```

O usuário do banco de destino precisa de permissão pra criar e apagar tabela (`CREATE` e `DROP`), além de gravar. Uma ideia é criar um banco ou um schema só pros resultados do Datera e dar essa permissão só lá.

Nome de tabela e de coluna tem limite de tamanho: 63 no PostgreSQL, 64 no MySQL e 128 no SQL Server. Se passar, ele avisa antes de começar, em vez de cortar o nome no meio. Ele também avisa se tiver duas colunas que só mudam nas maiúsculas (`Email` e `email`), porque vários bancos acham que são a mesma.

## XML

Muito sistema antigo (e nota fiscal, e exportação de ERP) só sabe falar XML, então ele lê e escreve XML também. As regras são as mesmas do JSON, pra ficar fácil de adivinhar o resultado.

Esse arquivo, com `"recordsPath": "escola.alunos.aluno"`:

```xml
<escola>
  <alunos>
    <aluno matricula="2024-0042">
      <nome>Lia Martins</nome>
      <email>lia@email.com</email>
      <plano>Mensal</plano>
      <instrumentos>
        <instrumento>violão</instrumento>
        <instrumento>ukulele</instrumento>
      </instrumentos>
      <endereco><cidade>Pelotas</cidade></endereco>
    </aluno>
  </alunos>
</escola>
```

fica assim:

| matricula | nome        | email         | plano  | instrumentos.instrumento | endereco.cidade |
| --------- | ----------- | ------------- | ------ | ------------------------ | --------------- |
| 2024-0042 | Lia Martins | lia@email.com | Mensal | violão, ukulele          | Pelotas         |

O que acontece por baixo:

- cada `<aluno>` vira uma linha
- atributo vira coluna com o próprio nome (`matricula`)
- elemento dentro de elemento vira coluna com ponto (`endereco.cidade`), igual no JSON
- elemento repetido vira um valor só, separado por vírgula. Se quiser espalhar em colunas, o `distribute` do merge resolve
- elemento vazio (`<cidade/>`) vira vazio de verdade, então o `required` e o `fillEmpty` funcionam
- `&amp;`, `&lt;` e blocos `<![CDATA[...]]>` viram o texto normal
- sem `recordsPath`, ele usa os elementos que estão logo abaixo do principal (tipo `<alunos><aluno/><aluno/></alunos>`)

Se o XML estiver quebrado (uma tag que não fecha, um `&` solto), ele avisa com o número da linha.

Arquivo com `<!DOCTYPE>` ele não lê. É por ali que entram os golpes mais comuns com XML, que fazem o programa abrir outros arquivos do computador ou endereços da internet. Os arquivos de dados normais não usam isso, então se aparecer, dá pra apagar essa parte.

Na saída, `root` é o elemento de fora e `record` o de cada linha. Sem eles, fica `<registros>` e `<registro>`:

```json
"destination": {
    "type": "xml",
    "path": "./saida/resultado.xml",
    "root": "alunos",
    "record": "aluno"
}
```

```xml
<?xml version="1.0" encoding="UTF-8"?>
<alunos>
  <aluno>
    <matricula>2024-0042</matricula>
    <nome>Lia Martins</nome>
    <endereco.cidade>Pelotas</endereco.cidade>
  </aluno>
</alunos>
```

Cada coluna vira um elemento, e coluna vazia vira elemento vazio. Nome de coluna com espaço ou que começa com número não vale em XML, então ele troca o que não pode por `_`: `instrumento 1` vira `<instrumento_1>` e `1a aula` vira `<_1a_aula>`. Quando isso acontece, aparece um aviso no log. O arquivo sai em UTF-8, e o que ele escreve ele consegue ler de volta igualzinho.

## Parquet

Parquet é o formato que quem trabalha com dados em quantidade usa muito (pandas, Spark, DuckDB, BigQuery). Ele guarda por coluna, é comprimido e já diz o tipo de cada coluna, então o arquivo fica bem menor que um CSV e ninguém precisa adivinhar se `12` é texto ou número.

```json
"source": { "type": "parquet", "path": "./alunos.parquet" },
"destination": { "type": "parquet", "path": "./saida/resultado.parquet" }
```

Na leitura:

- número inteiro, decimal e texto chegam do jeito que são
- data vira texto no formato `2024-03-10` (ou com a hora junto) e verdadeiro/falso vira `true`/`false`
- coluna com grupo dentro vira coluna com ponto (`endereco.cidade`) e lista simples vira texto separado por vírgula, igual no JSON
- lê arquivo sem compressão e com as compressões mais comuns (snappy, gzip, zstd, brotli)

Na escrita, ele escolhe o tipo de cada coluna olhando os valores: se todos forem número inteiro, a coluna sai como inteiro; se tiver número com vírgula, sai como decimal; e se tiver qualquer texto no meio, a coluna inteira sai como texto. Célula vazia sai vazia (o `null` do Parquet). Se não tiver nenhuma linha pra gravar, ele apaga o arquivo antigo em vez de deixar um resultado velho lá.

Por baixo ele usa o `hyparquet`, que é todo em JavaScript e não precisa instalar nada no computador.

## E a config antiga?

Continua funcionando igual. Sem `source`, ele usa `dbHost`, `dbUser`, `tableName`... como MySQL, e sem `destination` usa `spreadsheetId` e `credentialsPath` como Google Sheets. O `.env` continua valendo mais que o `config.json` nos dois jeitos.

## E se o meu formato não tá aqui?

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

---

[← Configuração](configuracao.md) · [Exemplos →](exemplos.md)

<p align="center">
  <a href="../README.md"><img src="https://img.shields.io/badge/In%C3%ADcio-475569?style=for-the-badge" alt="Início"></a>
  <a href="gestores.md"><img src="https://img.shields.io/badge/Para%20gestores-2563EB?style=for-the-badge" alt="Guia para gestores"></a>
  <a href="devs.md"><img src="https://img.shields.io/badge/Para%20devs-16181D?style=for-the-badge" alt="Guia para devs"></a>
</p>
