# ETL MySQL → Google Sheets

> Automação em TypeScript que lê dados de uma tabela ou view do MySQL e exporta para uma planilha do Google Sheets, com suporte a diferentes modos de tratamento dos dados antes da escrita.

![status](https://img.shields.io/badge/status-em%20desenvolvimento-yellow)
![node](https://img.shields.io/badge/node-%3E%3D18-green)

---

## Funcionalidades

- Leitura paginada de tabelas/views do MySQL (com retry automático em caso de queda de conexão)
- Escrita em lote no Google Sheets
- Modo `dedupe`: remove linhas duplicadas com base numa coluna configurável
- Configuração via `.env` + `config.json`, com CLI pra sobrescrever na hora de rodar
- Testes unitários com Vitest

---

## Instalação

```bash
npm install
```

Isso instala todas as dependências listadas no `package.json` (incluindo `googleapis`, `commander`, `mysql2`, `zod`, entre outras).

---

## Configuração inicial

O projeto usa três arquivos de configuração que **não vão pro git** (por segurança) — você parte de um exemplo (`.example`) e cria sua própria cópia local:

```bash
cp .env.example .env
cp credentials.json.example credentials.json
cp config.json.example config.json
```

Depois de copiar, você precisa **preencher cada um** com dados reais. Segue o que cada campo espera:

### 1️⃣ `.env`

| Variável | O que colocar |
|---|---|
| `DB_HOST` | Endereço do servidor MySQL (ex: `localhost` ou um IP/domínio) |
| `DB_PORT` | Porta do MySQL (padrão `3306`, só muda se o seu servidor usar outra) |
| `DB_USER` | Usuário de acesso ao banco |
| `DB_PASSWORD` | Senha desse usuário — se tiver caractere especial (`#`, `@`, etc), coloque entre aspas |
| `DB_NAME` | Nome do banco de dados |
| `DB_TABLE` | Nome da tabela ou view que você quer ler |
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | Caminho pro arquivo de credenciais — deixe `./credentials.json`, já é o padrão |
| `GOOGLE_SPREADSHEET_ID` | O ID da planilha de destino — é o trecho da URL entre `/d/` e `/edit` (ex: em `docs.google.com/spreadsheets/d/1BxiMVs0.../edit`, o ID é `1BxiMVs0...`) |

### 2️⃣ `credentials.json`

Substitua todo o conteúdo pelo **arquivo JSON de chave da service account**, baixado do Google Cloud Console (IAM e administrador → Contas de serviço → Chaves → Adicionar chave → JSON).

> ⚠️ Depois de gerar a service account, **compartilhe a planilha manualmente** com o e-mail dela (algo como `nome@projeto.iam.gserviceaccount.com`), dando papel de **Editor** — sem isso, a escrita na planilha falha por falta de permissão.

### 3️⃣ `config.json`

| Campo | O que colocar |
|---|---|
| `tableName` | Mesmo nome que você colocou em `DB_TABLE` (serve de reserva caso o `.env` não defina) |
| `spreadsheetId` | Mesmo ID que você colocou em `GOOGLE_SPREADSHEET_ID` |
| `credentialsPath` | Geralmente `./credentials.json` |
| `mode` | `"raw"` (sem tratamento) ou `"dedupe"` (remove duplicatas) |
| `dbHost`, `dbPort`, `dbUser`, `dbPassword`, `dbName` | Mesmos dados do `.env` (servem de reserva) |
| `dedupeColumn` | *(só se `mode` for `"dedupe"`)* nome da coluna usada pra identificar duplicatas |
| `dedupeStrategy` | *(opcional, só no modo `dedupe`)* `"keep-first"` (mantém a primeira ocorrência) ou `"keep-last"` (mantém a última) — padrão é `"keep-first"` |

> Sempre que um valor existir tanto no `.env` quanto no `config.json`, o **`.env` tem prioridade**. O `config.json` funciona como reserva.

---

## Rodando o ETL

```bash
npm start
```

Roda o fluxo completo: lê do banco → aplica o modo configurado → escreve na planilha.

Pra sobrescrever o modo direto pelo terminal, sem editar o `config.json`:
```bash
npm start -- --mode dedupe
```

Pra usar um arquivo de config diferente do padrão:
```bash
npm start -- --config ./outro-config.json
```

---

## Testes

| Comando | O que faz |
|---|---|
| `npm test` | Roda os testes unitários (Vitest) — não precisa de banco nem planilha reais |
| `npm run test:config` | Carrega e valida o `config.json` |
| `npm run test:connection` | Conecta no banco MySQL real e mostra as 3 primeiras linhas |
| `npm run test:sheet` | Escreve duas linhas de teste numa planilha real |

---

## 📁 Estrutura do projeto

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

---

## Roteiro (o que ainda falta)

- [ ] Modo de unificação/merge de duplicatas (combinar dados em vez de só descartar)
- [ ] Validação de dados (ex: CPF) e separação de linhas válidas/inválidas em abas diferentes
- [ ] Pipeline de filtros configurável e plugável (hoje os modos são um `switch` fixo no `index.ts`)
- [ ] Build de produção (hoje roda tudo via `tsx`, sem gerar TS compilado)