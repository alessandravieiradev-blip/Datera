# Mudanças

Tudo que muda de uma versão pra outra do Datera fica aqui, da mais nova pra mais antiga. Vale pro pacote do npm, pro comando `datera` e pros dois apps, que saem sempre com o mesmo número.

Os números seguem o [versionamento semântico](https://semver.org/lang/pt-BR/):

- o último número sobe quando é só correção (`0.1.0` → `0.1.1`)
- o do meio sobe quando entra coisa nova sem quebrar o que já funcionava (`0.1.1` → `0.2.0`)
- o primeiro sobe quando alguma coisa deixa de funcionar do jeito antigo e precisa de ajuste de quem usa (`0.9.0` → `1.0.0`)

## [Não lançado]

### Adicionado

- converter vários arquivos de uma vez: `datera convert "matriculas/*.xlsx" --to csv --out-dir convertidos`, aceitando pasta, `*` no nome e lista de arquivos, e o `convertMany` na API (com `findFiles` e `planOutputs`)
- ler todas as abas de um Excel ou de uma planilha do Google de uma vez (`"allSheets": true`, `--all-sheets`), com uma coluna dizendo de qual aba veio cada linha. Com `--to`, cada aba vira um arquivo. Na API, o `readSheets` devolve aba por aba. No app, a opção **Ler todas as abas** no passo a passo, e no Datera Dev, os trechos na paleta
- `datera run regras.json --input "matriculas/*.xlsx" --out-dir limpos` aplica as mesmas regras em cada arquivo, cada um com o seu resultado

## [0.2.1] - 2026-09-30

### Corrigido

- no Windows, o app recusava arquivo de código numa subpasta que ainda não existia, quando a pasta da configuração tinha um nome curto do Windows (tipo `RUNNER~1`) ou passava por um atalho
- as actions do GitHub foram pra versões que rodam no Node 24

## [0.2.0] - 2026-09-29

### Adicionado

- este CHANGELOG, e o `npm run release:prepare -- <versão>`, que troca a versão nos três `package.json` e fecha a seção do CHANGELOG de uma vez
- a action da aba Releases agora usa a seção do CHANGELOG como texto da release, e não deixa publicar uma versão sem ela
- MySQL, PostgreSQL, SQL Server e SQLite como destino: o resultado vai pra uma tabela nova e as pendências pra outra (`_pendencias` no fim do nome, ou o `pendingTable`), tudo numa transação
- o Datera anota as tabelas que ele cria em `datera_tabelas` e nunca apaga uma tabela que não foi ele que criou, nem a tabela de onde ele lê
- variáveis `DEST_DB_*` no `.env` pro banco de destino. Se for o mesmo banco da fonte, o que faltar é copiado dela
- `--output-table` no `convert`, `dedupe` e `merge`, e as opções `table` e `pendingTable` no `writeRows` e no `convert`
- no app, banco de dados e arquivo SQLite aparecem como destino no passo a passo, com a opção de salvar no mesmo servidor da fonte, e o Datera Dev ganhou os trechos de destino dos quatro bancos
- testes de tela dos dois apps com Playwright (`npm run test:telas`), nos temas claro e escuro, rodando no CI com as fotos de cada tela

### Mudou

- os testes usam só os dados da escola de música inventada, sem "clientes" nem telefone
- o `config.json.example` virou uma config de verdade, que já roda lendo o CSV de exemplo

### Segurança

- o CSV desarma célula de texto que o Excel leria como fórmula (começando com `=`, `+`, `-` ou `@`), colocando um `'` na frente. Dá pra desligar com `escapeFormulas: false`
- no app, a primeira exportação de cada configuração mostra de onde ela lê e onde grava, e só continua se você confirmar
- a senha da fonte só é reaproveitada no destino quando os dois são o mesmo servidor
- `ssl` no MySQL, pra conexão criptografada
- os instaladores desligam os recursos do Electron que deixariam usar o app como um Node.js escondido
- nome de tabela ou coluna com caractere invisível é recusado antes de gravar no banco

### Removido

- os scripts `test:config` e `test:connection`, que faziam o mesmo que o `datera validate` e o `--dry-run`

## [0.1.0] - 2026-09-29

Primeira versão publicada no npm e na aba Releases.

### Adicionado

- lê de MySQL, PostgreSQL, SQL Server, SQLite, Google Sheets, Excel, CSV, JSON, XML e Parquet, e escreve no Google Sheets, Excel, CSV, JSON, XML e Parquet
- modos `raw`, `dedupe` e `merge`, com normalizadores (`trim`, `lowercase`, `digitsOnly`, `alphanumeric`) e os seus próprios
- preparação (`fillEmpty`, `combineColumns`, `distribute`) e validação com a lista de pendências e o motivo de cada linha
- app Datera, pra quem não programa, com passo a passo, regras em frases, prévia, histórico e tema escuro
- app Datera Dev, com editor da config, erros marcados na linha, paleta de comandos e teste de normalizador
- instaladores pra Windows gerados sozinhos a cada tag de versão
- comando `datera` com `run`, `validate`, `init`, `convert`, `dedupe`, `merge`, `columns`, `preview`, `normalizers` e `normalize`
- funções pra usar no código: `readRows`, `writeRows`, `convert`, `clean`, `fillEmpty`, `combineColumns`, `validate`, `dedupe`, `merge`, `describeColumns`, `defineConfig` e `onStep` pra acompanhar o progresso
- `dedupeKeyNormalizer`, pra comparar repetidos depois de passar por um normalizador
- os pacotes de Excel, Parquet, Google Sheets e dos bancos são opcionais: só instala quem for usar

### Segurança

- arquivos de código citados na config só rodam depois de confirmados no app
- a senha do banco fica no `.env`, e o app só lê do `.env` as variáveis que conhece
- as telas não navegam pra fora do app nem abrem janelas novas
- o leitor de XML recusa `<!DOCTYPE>`
- entrada e saída nunca podem ser o mesmo arquivo, mesmo escrito de outro jeito
