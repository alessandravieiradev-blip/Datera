<p align="center">
  <a href="../README.md"><img src="https://img.shields.io/badge/In%C3%ADcio-475569?style=for-the-badge" alt="Início"></a>
  <a href="gestores.md"><img src="https://img.shields.io/badge/Para%20gestores-2563EB?style=for-the-badge" alt="Guia para gestores"></a>
  <a href="devs.md"><img src="https://img.shields.io/badge/Para%20devs-16181D?style=for-the-badge" alt="Guia para devs"></a>
</p>

[Guia para devs](devs.md) › Comandos e API

# Comandos e API

O Datera não precisa de config pra tudo. Dá pra usar ele como uma caixa de ferramentas: converter um arquivo, tirar repetidos, juntar cadastros, olhar as colunas de uma planilha, tanto pelo terminal quanto de dentro do seu código.

Todos os exemplos usam a escola de música inventada dos outros guias.

## Sumário

- [Instalando](#instalando)
- [Formatos que ele reconhece pela extensão](#formatos-que-ele-reconhece-pela-extensão)
- [Terminal](#terminal)
- [No seu código](#no-seu-código)
- [Receitas](#receitas)
- [Cuidados](#cuidados)

## Instalando

O Datera está no [npm](https://www.npmjs.com/package/datera). Pra usar os comandos no terminal, de qualquer pasta:

```bash
npm install -g datera
datera --help
```

Pra usar as funções no seu código, dentro do seu projeto:

```bash
npm install datera
```

Funciona em TypeScript (os tipos já vêm junto) e em JavaScript, tanto com `import` quanto com `require`. Pra atualizar depois, é o mesmo comando com `@latest` no final, tipo `npm install -g datera@latest`.

Se você está mexendo no código do próprio Datera e quer testar o comando com as suas mudanças, o caminho está no [guia para devs](devs.md#o-comando-datera).

Precisa do Node 22.13 ou mais novo.

### Só o que você usar

Quem instala o Datera pelo npm leva só o básico. CSV, JSON, XML e SQLite já funcionam de cara, sem nada a mais. Os outros formatos precisam de um pacote extra, e você só instala o do formato que for usar:

| Pra usar      | Instale                                                        |
| ------------- | -------------------------------------------------------------- |
| Excel         | `npm install exceljs`                                          |
| Parquet       | `npm install hyparquet hyparquet-compressors hyparquet-writer` |
| Google Sheets | `npm install @googleapis/sheets`                               |
| MySQL         | `npm install mysql2`                                           |
| PostgreSQL    | `npm install pg`                                               |
| SQL Server    | `npm install mssql`                                            |

Se usou o comando instalado com `-g`, instale o extra com `-g` também (tipo `npm install -g exceljs`). E se esquecer, tudo bem: na hora que precisar, o Datera avisa qual pacote falta e o comando pra instalar.

Assim o projeto de quem usa fica menor e com menos pacotes de terceiros, o que também diminui o risco de uma dependência comprometida. Dentro deste repositório o `npm install` já instala tudo, porque os apps e os testes usam todos os formatos.

## Formatos que ele reconhece pela extensão

Quando você passa só o caminho de um arquivo (no terminal ou nas funções), o Datera descobre o formato sozinho:

| Extensão                     | Formato | Lê  | Grava | Opções que importam                                                              |
| ---------------------------- | ------- | --- | ----- | -------------------------------------------------------------------------------- |
| `.csv`, `.txt`               | CSV     | sim | sim   | `delimiter`, `encoding` (leitura), `bom`, `escapeFormulas`                       |
| `.tsv`                       | CSV     | sim | sim   | já usa tab como separador                                                        |
| `.json`                      | JSON    | sim | sim   | `recordsPath` (leitura)                                                          |
| `.xml`                       | XML     | sim | sim   | `recordsPath` (leitura), `root` e `record`                                       |
| `.xlsx`                      | Excel   | sim | sim   | `sheet`                                                                          |
| `.parquet`                   | Parquet | sim | sim   |                                                                                  |
| `.db`, `.sqlite`, `.sqlite3` | SQLite  | sim | sim   | `table` (obrigatório na leitura; na gravação o padrão é `dados`), `pendingTable` |

Banco de servidor (MySQL, PostgreSQL, SQL Server) e Google Sheets não têm extensão, então pra eles você passa a config completa da fonte ou do destino, igual a da [config](fontes-e-destinos.md).

## Terminal

Pra ver tudo a qualquer hora: `datera --help`, ou `datera help <comando>` pra um comando só.

### `datera run` e `datera validate`

Rodam uma config inteira, do jeito que já existia:

```bash
datera run ./escola/config.json
datera run ./escola/config.json --dry-run
datera run ./escola/config.json --mode dedupe
datera validate ./escola/config.json
```

O `run` também aceita trocar a entrada e a saída na hora, o que deixa a config virar um "arquivo de regras" reaproveitável:

```bash
datera run regras.json --input matriculas-marco.csv --output saida/marco.xlsx
```

Nesse caso a config nem precisa ter `source` e `destination`.

E se cada mês vem num arquivo, dá pra aplicar as mesmas regras em todos de uma vez. Cada arquivo ganha o seu resultado, com o mesmo nome, na pasta do `--out-dir`:

```bash
datera run regras.json --input "matriculas/*.xlsx" --out-dir limpos
datera run regras.json --input matriculas --out-dir limpos --to csv
```

O formato de cada resultado é o do destino da config. Se o destino não for um arquivo (ou se quiser outro formato), é só dizer com `--to`.

### `datera init`

Cria uma `config.json` pra começar:

```bash
datera init
datera init ./escola --from alunos.xlsx
```

Com `--from`, ela já sai lendo desse arquivo e gravando em `./saida/` no mesmo formato. Se já existir uma config na pasta, ele não mexe (a não ser com `--force`).

### `datera convert`

Converte de um formato pra outro, sem mexer nos dados:

```bash
datera convert alunos.csv alunos.xlsx
datera convert alunos.xlsx alunos.parquet --sheet Matrículas
datera convert alunos.xml alunos.json --records-path escola.alunos.aluno
datera convert escola.db alunos.csv --table alunos
datera convert alunos.json alunos.xml --root alunos --record aluno
```

Pra converter vários de uma vez, troque a saída por `--to` com o formato. Cada arquivo vira um novo com o mesmo nome, do lado dele ou na pasta do `--out-dir`:

```bash
datera convert "matriculas/*.xlsx" --to csv
datera convert matriculas --to parquet --out-dir convertidos
datera convert janeiro.xlsx fevereiro.xlsx --to json --out-dir saida
```

- o `*` vale no nome do arquivo (`matriculas/*.xlsx`, `matriculas/2026-*.csv`), não no nome da pasta
- passando uma pasta, ele pega todos os arquivos que ele conhece (CSV, JSON, XML, Excel, Parquet, SQLite) e pula o resto
- no PowerShell e no terminal do Mac e do Linux, coloca o padrão entre aspas, senão o terminal tenta resolver o `*` antes do Datera
- os formatos do `--to` são `csv`, `tsv`, `json`, `xml`, `xlsx`, `parquet` e `db`
- com `--all-sheets`, cada aba de cada Excel vira um arquivo: `matriculas.xlsx` com as abas Janeiro e Fevereiro vira `matriculas-Janeiro.csv` e `matriculas-Fevereiro.csv`. Caractere que o Windows não aceita em nome de arquivo vira `_`
- antes de começar, ele confere se dois arquivos não iam virar o mesmo (tipo `janeiro.csv` e `janeiro.xml` indo pra `janeiro.json`) e se nenhum ia gravar por cima de outra entrada. Se der erro no meio, ele diz em qual arquivo parou

### `datera dedupe`

Tira as linhas repetidas olhando uma coluna:

```bash
datera dedupe alunos.csv sem-repetidos.csv --by email
datera dedupe alunos.csv sem-repetidos.csv --by email --normalizer lowercase --keep last
```

Com `--normalizer lowercase`, `Lia@Email.com` e ` lia@email.com` contam como o mesmo e-mail. O `--keep` escolhe se fica a primeira (`first`, o padrão) ou a última (`last`) linha de cada grupo.

### `datera merge`

Junta as linhas com a mesma chave, sem perder informação:

```bash
datera merge alunos.csv alunos-juntos.xlsx --key matricula --normalizer digitsOnly
datera merge alunos.csv alunos-juntos.xlsx --key matricula --normalizer digitsOnly --overwrite plano --extra-column nome --separator ", "
```

Por padrão, quando duas linhas têm valores diferentes numa coluna, ele junta os dois no mesmo campo (`violão | piano`). Com `--overwrite`, vale o último valor. Com `--extra-column`, cada valor diferente vira uma coluna nova (`nome`, `nome_2`). As duas aceitam várias colunas separadas por vírgula.

Pra coisas mais finas (espalhar em colunas, regras por grupo, linhas sem chave), use uma config com o modo `merge`. Está tudo em [Configuração](configuracao.md).

### `datera columns`

Mostra um raio-x das colunas: quantas células estão preenchidas, quantas estão vazias, quantos valores diferentes, se é número ou texto, e alguns exemplos:

```bash
datera columns alunos.xlsx
```

```text
alunos.xlsx: 7 linhas.
│ coluna    │ preenchidas │ vazias │ diferentes │ tipo    │ exemplos                              │
│ matricula │ 6           │ 1      │ 5          │ texto   │ 2024-0042 · 20240042 · 2024-0051      │
│ plano     │ 7           │ 0      │ 5          │ texto   │ mensal · Mensal · anual               │
```

Ótimo pra ver, antes de montar as regras, onde estão os vazios e os valores escritos de jeitos diferentes.

### `datera preview`

Mostra as primeiras linhas de qualquer arquivo:

```bash
datera preview alunos.parquet
datera preview alunos.xlsx -n 30 --sheet Matrículas
```

### `datera normalizers` e `datera normalize`

Lista os normalizadores prontos e testa um valor:

```bash
datera normalizers
datera normalize digitsOnly "2024-0042"
```

```text
"2024-0042" → "20240042"
```

### Opções de leitura e escrita

Os comandos que leem arquivo (`convert`, `dedupe`, `merge`, `columns`, `preview`) aceitam:

| Opção                      | Pra quê                                                   |
| -------------------------- | --------------------------------------------------------- |
| `--table <tabela>`         | tabela do SQLite                                          |
| `--sheet <aba>`            | aba do Excel de entrada                                   |
| `--all-sheets`             | lê todas as abas do Excel, com uma coluna `aba`           |
| `--sheet-column <nome>`    | outro nome pra coluna da aba (com `--all-sheets`)         |
| `--align-columns`          | junta colunas que só mudam em maiúscula, acento ou espaço |
| `--rename "de=para"`       | diz que uma coluna é outra. Pode repetir                  |
| `--records-path <caminho>` | onde estão os registros no JSON ou XML                    |
| `--delimiter <separador>`  | separador do CSV de entrada (sem ele, descobre sozinho)   |
| `--encoding latin1`        | CSV antigo com acento estranho                            |

E os que gravam (`convert`, `dedupe`, `merge`):

| Opção                            | Pra quê                                    |
| -------------------------------- | ------------------------------------------ |
| `--output-table <tabela>`        | tabela do SQLite de saída (padrão `dados`) |
| `--output-sheet <aba>`           | nome da aba do Excel de saída              |
| `--output-delimiter <separador>` | separador do CSV de saída                  |
| `--root <nome>`                  | elemento de fora do XML de saída           |
| `--record <nome>`                | elemento de cada linha do XML              |

Se der erro, todos terminam com código 1, então dá pra encadear em script.

## No seu código

Tudo sai do mesmo lugar:

```ts
import { readRows, clean, writeRows } from "datera";
```

Com `require` é igual: `const { readRows, clean, writeRows } = require("datera")`. Dentro deste repositório, pra testar sem instalar, é `from "./src"`.

Uma linha é sempre um objeto `{ coluna: valor }`, onde o valor é texto, número ou `null`. O tipo se chama `TableRow`.

### Ler e gravar

```ts
const alunos = await readRows("./alunos.xlsx", { sheet: "Matrículas" });
const doBanco = await readRows({
    type: "postgres",
    host: "localhost",
    user: "escola",
    database: "musica",
    table: "public.alunos",
});

await writeRows(alunos, "./saida/alunos.parquet");
await writeRows(resultado, "./saida/resultado.xlsx", {
    pending: pendencias,
});
await writeRows(resultado, "./saida/escola.db", {
    table: "alunos_organizados",
    pending: pendencias,
});
await writeRows(resultado, {
    type: "postgres",
    host: "localhost",
    user: "escola",
    database: "musica",
    table: "alunos_organizados",
});
```

O `readRows` aceita um caminho (com as opções da tabela de formatos) ou a config completa de uma fonte. O `writeRows` aceita um caminho ou a config completa de um destino. Com `pending`, as pendências vão pra uma aba, um arquivo ou uma tabela do lado, igual no `run`. No banco, ele só apaga e recria tabela que ele mesmo criou, e grava tudo numa transação. Os detalhes estão em [Bancos de dados como destino](fontes-e-destinos.md#bancos-de-dados-como-destino).

### Converter

```ts
const linhas = await convert("./alunos.xml", "./alunos.csv", {
    read: { recordsPath: "escola.alunos.aluno" },
    write: { delimiter: ";" },
});
```

Devolve quantas linhas passaram.

Pra vários arquivos, o `convertMany` recebe um caminho, uma pasta, um padrão com `*` ou uma lista com qualquer um deles:

```ts
const feitos = await convertMany(["matriculas/*.xlsx", "extras"], {
    to: "csv",
    outDir: "convertidos",
    write: { delimiter: ";" },
});
```

Ele devolve uma lista com a entrada, a saída e quantas linhas cada arquivo teve, tipo `{ input: "matriculas/janeiro.xlsx", output: "convertidos/janeiro.csv", rows: 42 }`.

### Todas as abas de uma planilha

Quando cada mês (ou cada turma) está numa aba, dá pra ler todas de uma vez. As linhas viram uma lista só, e uma coluna `aba` diz de onde veio cada uma:

```bash
datera preview matriculas.xlsx --all-sheets
datera convert matriculas.xlsx todas.csv --all-sheets --sheet-column mes
datera convert matriculas.xlsx --all-sheets --to csv --out-dir por-mes
```

Com uma saída só, fica tudo junto com a coluna. Com `--to`, cada aba vira um arquivo, como se fossem arquivos separados. No código:

```ts
const tudo = await readRows("matriculas.xlsx", {
    allSheets: true,
    sheetColumn: "mes",
});
const porAba = await readSheets("matriculas.xlsx");
```

O `readSheets` devolve uma lista com o nome de cada aba e as linhas dela. Abas escondidas ficam de fora, porque normalmente guardam listas de apoio e não dados. Se alguma aba já tiver uma coluna com o mesmo nome da coluna da aba, ele avisa pra você escolher outro nome.

Se quiser só saber quais arquivos ele pegaria, sem converter nada, tem o `findFiles("matriculas/*.xlsx")`, e o `planOutputs(arquivos, "csv", "convertidos")` mostra o nome de saída de cada um.

### Limpar tudo de uma vez: `clean`

O `clean` roda o mesmo pipeline do `run`, só que direto na memória, sem fonte nem destino. Ele é síncrono.

```ts
import { clean, defineRules } from "datera";

const regras = defineRules({
    alignColumns: { rename: { "Email do aluno": "email" } },
    fillEmpty: [{ column: "cidade", default: "não informada" }],
    validation: {
        rules: [
            { column: "matricula", rule: "required", message: "sem matrícula" },
            {
                column: "email",
                rule: "pattern",
                pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$",
                message: "e-mail fora do formato",
            },
        ],
    },
    merge: {
        key: "matricula",
        normalizer: "digitsOnly",
        columns: [
            { column: "nome", strategy: "extra-column" },
            { column: "plano", strategy: "overwrite" },
            { column: "cidade", strategy: "concat", separator: " | " },
        ],
    },
});

const { rows, pending, pendingByReason, steps } = clean(alunos, regras);
```

As regras são as mesmas da config, com nomes mais curtos pro modo:

| Regra            | Igual a, na config                                                                 |
| ---------------- | ---------------------------------------------------------------------------------- |
| `fillEmpty`      | `fillEmpty`                                                                        |
| `combineColumns` | `combineColumns`                                                                   |
| `validation`     | `validation`                                                                       |
| `dedupe`         | `{ column, keep?, normalizer? }`, o modo `dedupe`                                  |
| `merge`          | `{ key, columns, normalizer?, emptyKeyLabel?, rejectedKeyLabel? }`, o modo `merge` |

`dedupe` e `merge` não podem ir juntos. Se nenhum dos dois vier, é o modo `raw`. O `defineRules` não faz nada além de dar autocompletar no editor.

O resultado traz:

| Campo             | O que é                                                     |
| ----------------- | ----------------------------------------------------------- |
| `rows`            | o resultado                                                 |
| `pending`         | as linhas com problema, com a coluna `Motivo`               |
| `pendingByReason` | `[{ reason, count }]`, do motivo mais comum pro menos comum |
| `steps`           | quantas linhas entraram e saíram de cada etapa              |
| `durationMs`      | quanto tempo levou                                          |

Pra acompanhar o progresso, passa `onStep`:

```ts
clean(alunos, regras, {
    onStep: (etapa) => console.log(`${etapa.name}: ${etapa.rowsOut} linhas`),
});
```

Se alguma regra estiver errada, ele lança um erro em português dizendo qual.

### Uma etapa só

Quando você só precisa de uma coisa:

```ts
import {
    alignColumns,
    fillEmpty,
    combineColumns,
    validate,
    dedupe,
    merge,
} from "datera";

const alinhados = alignColumns(alunos, {
    rename: { "Email do aluno": "email" },
});

const completos = fillEmpty(alunos, [
    { column: "cidade", fallbackColumns: ["bairro"], default: "não informada" },
]);

const comContato = combineColumns(alunos, [
    { into: "contato", columns: ["nome", "email"], separator: " - " },
]);

const { valid, pending } = validate(alunos, [
    {
        column: "plano",
        rule: "oneOf",
        values: ["mensal", "trimestral", "anual"],
        ignoreCase: true,
    },
]);

const semRepetidos = dedupe(alunos, "email", {
    normalizer: "lowercase",
    keep: "last",
});

const juntos = merge(alunos, "matricula", {
    normalizer: "digitsOnly",
    overwrite: ["plano"],
    extraColumn: ["nome"],
});
```

O `merge` sem `columns` junta todas as colunas com `concat` (separador `" | "`, ou o que vier em `separator`), menos as que você colocar em `overwrite` ou `extraColumn`. Se quiser as regras completas (`distribute`, `byGroup`, `unkeyed`), passa `columns` do mesmo jeito que o `mergeColumns` da config. O `mergeColumnsFor(linhas, chave, opções)` monta essa lista pra você partir dela.

### Olhar os dados

```ts
import {
    describeColumns,
    normalize,
    listNormalizers,
    detectFormat,
} from "datera";

describeColumns(alunos);
// [{ name: "matricula", filled: 6, empty: 1, distinct: 5, kind: "texto", examples: [...] }, ...]

normalize("digitsOnly", "2024-0042"); // "20240042"
listNormalizers(); // ["trim", "lowercase", "digitsOnly", "alphanumeric", ...]
detectFormat("alunos.parquet"); // "parquet"
```

### Rodar uma config pelo código

```ts
import { defineConfig, parseConfig, runEtl, formatReport } from "datera";

const config = parseConfig(
    defineConfig({
        source: { type: "csv", path: "./alunos.csv" },
        destination: { type: "excel", path: "./saida/alunos.xlsx" },
        mode: "dedupe",
        dedupeColumn: "email",
        dedupeKeyNormalizer: "lowercase",
    }),
);

const relatorio = await runEtl(config, {
    dryRun: true,
    onStep: (etapa) => console.log(etapa.name),
});
console.log(formatReport(relatorio).join("\n"));
```

O `defineConfig` dá autocompletar pra config inteira. O `parseConfig` confere, junta com o `.env` e devolve a config pronta. Pra ler de arquivo, é o `loadConfig("./config.json")`. As opções do `runEtl` estão no [guia para devs](devs.md#usando-dentro-de-outro-código).

### Normalizadores e formatos seus

```ts
import { registerKeyNormalizer, registerSourceAdapter } from "datera";

registerKeyNormalizer("semAcento", (valor) => ({
    key: String(valor).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(),
}));

dedupe(alunos, "nome", { normalizer: "semAcento" });
```

Normalizador registrado vale em tudo: `clean`, `dedupe`, `merge`, `normalize` e nas configs. Como criar um formato próprio está em [Fontes e destinos](fontes-e-destinos.md#e-se-o-meu-formato-não-tá-aqui).

## Receitas

**Juntar as planilhas de matrícula de cada mês num arquivo só, sem repetidos:**

```ts
const meses = ["janeiro", "fevereiro", "marco"];
const todas = (
    await Promise.all(meses.map((mes) => readRows(`./matriculas/${mes}.xlsx`)))
).flat();

await writeRows(
    dedupe(todas, "matricula", { normalizer: "digitsOnly", keep: "last" }),
    "./saida/matriculas.xlsx",
);
```

**Usar a mesma config de regras em vários arquivos, pelo terminal:**

```bash
for arquivo in matriculas/*.csv; do
  datera run regras.json --input "$arquivo" --output "saida/$(basename "$arquivo" .csv).xlsx"
done
```

**Ver rapidinho o que tem num banco SQLite de outro sistema:**

```bash
datera columns sistema-antigo.db --table alunos
datera convert sistema-antigo.db alunos.xlsx --table alunos
```

## Cuidados

- **A config decide pra onde os dados vão.** Uma config pode ler qualquer arquivo ou banco que você consegue abrir e gravar numa planilha do Google ou num banco de outra pessoa. Por isso nunca passe pro `runEtl`, pro `writeRows` ou pro `convert` uma config ou um destino montado a partir do que os usuários do seu sistema mandaram. No app de gestores, a primeira exportação de cada config mostra de onde ele lê e onde grava, e só continua se você confirmar.
- **Config de outra pessoa pode rodar código.** Os campos `normalizerModules` e `adapterModules` carregam arquivos JavaScript. No app de gestores ele pergunta antes, mas o `datera run` confia na config, do mesmo jeito que rodar um script. Só rode config que você sabe de onde veio. As regras do `clean` não aceitam esses campos, então dá pra montar regras a partir de dado de fora sem esse risco. Normalizador próprio no código é com `registerKeyNormalizer`.
- **A saída é apagada antes de gravar.** Por isso o Datera não deixa a entrada e a saída serem o mesmo arquivo, mesmo escrito de outro jeito (`./alunos.csv` e `pasta/../alunos.csv`, ou com maiúscula diferente no Windows). O Excel de saída é recriado inteiro, então não aponte pra uma planilha que tem outras abas suas.
- **CSV aberto no Excel.** Se os dados vieram de um formulário, alguém pode ter escrito algo começando com `=`, e o Excel trata isso como fórmula quando abre o CSV (dá até pra mandar dado pra um site, com `HYPERLINK`). Por isso o Datera coloca um `'` na frente de toda célula de texto que começa com `=`, `+`, `-` ou `@`, menos quando é só um número. Se o CSV for pra outro programa e não pro Excel, dá pra desligar com `"escapeFormulas": false` no destino (ou `escapeFormulas: false` no `writeRows`). No `.xlsx` e no Google Sheets isso nem é preciso, porque o Datera sempre grava como texto.
- **Senhas.** Use o `.env` (`DB_PASSWORD` e `DEST_DB_PASSWORD`) em vez de colocar a senha na config ou no código. A senha da fonte só é reaproveitada no destino quando os dois são o mesmo servidor, então uma config nunca manda a sua senha pra outro endereço.
- **Banco fora da sua rede.** Coloque `"ssl": true` no MySQL e no PostgreSQL, pra senha e dados irem criptografados. O SQL Server já criptografa sozinho. Só use `trustServerCertificate` num servidor que você conhece.
- **Banco como destino.** O Datera só apaga tabela que ele mesmo criou (a lista fica em `datera_tabelas`). Mesmo assim, o mais seguro é dar ao usuário do destino permissão só num banco ou schema separado pros resultados.
