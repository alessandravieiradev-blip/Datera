<p align="center">
  <a href="../README.md"><img src="https://img.shields.io/badge/In%C3%ADcio-475569?style=for-the-badge" alt="Início"></a>
  <a href="gestores.md"><img src="https://img.shields.io/badge/Para%20gestores-2563EB?style=for-the-badge" alt="Guia para gestores"></a>
  <a href="devs.md"><img src="https://img.shields.io/badge/Para%20devs-16181D?style=for-the-badge" alt="Guia para devs"></a>
</p>

[Guia para devs](devs.md) › Estrutura do projeto

# Estrutura do projeto

```text
src/
  cli.ts                  # os comandos do terminal e as opções de cada um
  env.ts                  # lê variável de ambiente
  main.ts                 # o que o npm start e o comando datera rodam: lê a config, chama o runEtl e mostra o resumo
  commands.ts             # o que cada comando do terminal faz (convert, dedupe, merge, columns...)
  api/                    # as funções pra usar no código: readRows, writeRows, convert, convertMany, joinFiles, splitFile, clean, dedupe, merge...
  index.ts                # o que dá pra importar de fora (runEtl, loadConfig, registrar adapter...)
  logger.ts               # pra onde vão as mensagens (console, silencioso ou memória)
  types.ts                # TableRow, o formato de linha que todo mundo usa
  pipeline/
    runEtl.ts             # lê da fonte, passa pelas etapas e grava no destino
    steps.ts              # monta a lista de etapas a partir da config
    modes.ts              # raw, dedupe e merge
    report.ts             # monta o resumo do final
    groups.ts             # organiza o resultado: uma aba, um arquivo ou uma tabela por valor, ou blocos com título
    types.ts              # Step e EtlReport
  config/
    index.ts              # o que o resto do projeto importa da config
    schema.ts             # o schema zod da config inteira
    ioSchema.ts           # source e destination
    prepareSchema.ts      # fillEmpty e combineColumns
    validationSchema.ts   # validation
    mergeSchema.ts        # mergeColumns, distribute, byGroup
    load.ts               # lê o json e junta com o .env
    check.ts              # confere a config e os arquivos que ela cita (o datera validate)
    messages.ts           # traduz os erros do schema pra frases em português
  io/
    types.ts              # interfaces Source e Sink
    factory.ts            # escolhe o adapter pela config
    servers.ts            # junta os dados de conexão dos bancos (config, .env e o que dá pra copiar da fonte)
    safety.ts             # não deixa gravar em cima do que ele lê (arquivo, aba ou tabela)
    header.ts             # monta o cabeçalho das saídas
    files.ts              # ler e escrever arquivo, nome do arquivo de pendências
    mysql/                # client.ts (conexão e leitura paginada), mysqlSource.ts e mysqlSink.ts
    postgres/             # postgresSource.ts e postgresSink.ts
    sqlserver/            # sqlServerSource.ts e sqlServerSink.ts
    sqlite/               # sqliteSource.ts e sqliteSink.ts (usam o SQLite que já vem no Node)
    sql/                  # o que os bancos dividem: converter os valores, proteger os nomes e o writer.ts, que grava a tabela numa transação e só mexe nas tabelas que o Datera criou
    multiSource.ts        # junta várias fontes numa só, com a coluna de origem
    tabs.ts               # junta as abas de uma planilha, com a coluna da aba
    optional.ts           # carrega os pacotes opcionais (Excel, Parquet, bancos) e explica o que instalar quando falta
    sheets/               # client.ts (leitura e escrita em abas), sheetsSource.ts e sheetsSink.ts
    csv/                  # csvFormat.ts (leitor e escritor), csvSource.ts, csvSink.ts
    json/                 # jsonSource.ts e jsonSink.ts
    xml/                  # xmlParse.ts (leitor de XML), xmlSource.ts e xmlSink.ts
    parquet/              # parquetLibrary.ts (usa o hyparquet), parquetSource.ts e parquetSink.ts
    excel/                # excelSource.ts, excelSink.ts, excelCell.ts (converte o valor da célula) e workbook.ts
    custom/               # registry.ts e loader.ts dos adapters que vêm de arquivo seu
  filters/
    types.ts              # interface Filter
    align.ts              # junta as colunas que são a mesma escrita de jeitos diferentes
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
  tests/                  # testes (Vitest), nas mesmas pastas do código: api/, config/, io/, filters/, normalizers/, pipeline/, scripts/ e desktop/
apps/desktop/             # o app com tela (Electron + React)
  scripts/                # dev.ts, build.ts e dist.ts (esbuild e instalador), usados pelos dois apps
  src/main/               # a parte que roda no Node: janela, arquivos, chama o runEtl
  src/preload/            # a ponte segura entre a tela e o Node
  src/renderer/           # as telas em React (pages/, components/, lib/, styles/)
  src/shared/api.ts       # os tipos que a tela e o Node usam pra conversar
apps/dev/                 # o Datera Dev, que reaproveita o núcleo do apps/desktop
  src/renderer/           # editor, paleta de comandos e saída
  IDENTIDADE.md           # a identidade visual da versão dev
e2e/                      # testes de tela dos dois apps (Playwright), com o window.datera de mentira e os dados da escola
docs/                     # os guias (gestores, devs e referência) e as imagens do README
examples/                 # CSV, XML e as configs de exemplo (npm run example)
local/                    # (ignorada pelo git) seus normalizadores e testes pessoais
scripts/                  # os de versão (release:prepare, conferência da tag e texto da release) e o test:sheet, que escreve numa planilha de verdade
CHANGELOG.md              # o que mudou em cada versão
config.json.example       # uma config pronta pra copiar, lendo o CSV de exemplo
playwright.config.ts      # a config dos testes de tela (temas claro e escuro)
vitest.config.ts          # a config dos testes unitários
dist/                     # o terminal compilado pelo npm run build (não vai pro git)
.github/workflows/        # ci.yml (type-check, testes, build e testes de tela a cada push) e release.yml (instaladores a cada tag)
.github/ISSUE_TEMPLATE/   # os modelos de issue (algo deu errado e ideia)
CONTRIBUTING.md           # como rodar, testar e mandar mudança
CODE_OF_CONDUCT.md        # código de conduta
SECURITY.md               # como avisar de falha de segurança
```

---

[← Normalizadores](normalizadores.md) · [Guia para devs →](devs.md)

<p align="center">
  <a href="../README.md"><img src="https://img.shields.io/badge/In%C3%ADcio-475569?style=for-the-badge" alt="Início"></a>
  <a href="gestores.md"><img src="https://img.shields.io/badge/Para%20gestores-2563EB?style=for-the-badge" alt="Guia para gestores"></a>
  <a href="devs.md"><img src="https://img.shields.io/badge/Para%20devs-16181D?style=for-the-badge" alt="Guia para devs"></a>
</p>
