<p align="center">
  <a href="../README.md"><img src="https://img.shields.io/badge/In%C3%ADcio-475569?style=for-the-badge" alt="Início"></a>
  <a href="gestores.md"><img src="https://img.shields.io/badge/Para%20gestores-2563EB?style=for-the-badge" alt="Guia para gestores"></a>
  <a href="devs.md"><img src="https://img.shields.io/badge/Para%20devs-16181D?style=for-the-badge" alt="Guia para devs"></a>
</p>

[Guia para devs](devs.md) › Estrutura do projeto

# Estrutura do projeto

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
  scripts/                # dev.ts, build.ts e dist.ts (esbuild e instalador), usados pelos dois apps
  src/main/               # a parte que roda no Node: janela, arquivos, chama o runEtl
  src/preload/            # a ponte segura entre a tela e o Node
  src/renderer/           # as telas em React (pages/, components/, lib/, styles/)
  src/shared/api.ts       # os tipos que a tela e o Node usam pra conversar
apps/dev/                 # o Datera Dev, que reaproveita o núcleo do apps/desktop
  src/renderer/           # editor, paleta de comandos e saída
  IDENTIDADE.md           # a identidade visual da versão dev
docs/                     # os guias (gestores, devs e referência) e as imagens do README
examples/                 # CSV e config de exemplo (npm run example)
local/                    # (ignorada pelo git) seus normalizadores e testes pessoais
scripts/                  # scripts pra testar na mão (banco, config, sheets)
.github/workflows/        # CI (type-check e testes a cada push)
```

---

[← Normalizadores](normalizadores.md) · [Guia para devs →](devs.md)

<p align="center">
  <a href="../README.md"><img src="https://img.shields.io/badge/In%C3%ADcio-475569?style=for-the-badge" alt="Início"></a>
  <a href="gestores.md"><img src="https://img.shields.io/badge/Para%20gestores-2563EB?style=for-the-badge" alt="Guia para gestores"></a>
  <a href="devs.md"><img src="https://img.shields.io/badge/Para%20devs-16181D?style=for-the-badge" alt="Guia para devs"></a>
</p>
