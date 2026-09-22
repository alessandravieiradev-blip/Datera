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
| `mode` | `"raw"` ou `"dedupe"` |
| `dbHost`, `dbPort`, `dbUser`, `dbPassword`, `dbName` | Mesmos dados do `.env` |
| `dedupeColumn` | Só se `mode` for `"dedupe"` — coluna usada pra identificar duplicatas |
| `dedupeStrategy` | Opcional, só no modo `dedupe` — `"keep-first"` ou `"keep-last"` (padrão: `"keep-first"`) |

Quando um valor existe tanto no `.env` quanto no `config.json`, o `.env` tem prioridade.

## Modos de execução

- **`raw`** — modo padrão, escreve os dados como vieram do banco, sem tratamento nenhum.
- **`dedupe`** — remove linhas duplicadas com base numa coluna configurável, mantendo a primeira ou a última ocorrência conforme `dedupeStrategy`.

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
  tests/              # testes unitários (Vitest)
scripts/              # scripts manuais de smoke test (banco, config, sheets)
```

## Ainda falta

- Modo de merge de duplicatas (combinar dados em vez de só descartar)
- Validação de dados (ex: CPF) e separação de linhas válidas/inválidas em abas diferentes
- Pipeline de filtros configurável (hoje os modos são um switch fixo no `index.ts`)
- Build de produção (hoje roda tudo via `tsx`)
