# ETL MySQL → Google Sheets

Esse projeto lê dados de uma tabela do MySQL e joga numa planilha do Google Sheets. Tem uma opção de remover linhas duplicadas antes de escrever.

Ainda tá em desenvolvimento, então essa doc é pra você entender o que já dá pra rodar.

## Como instalar e rodar

```bash
npm install
cp .env.example .env
cp credentials.json.example credentials.json
```

Depois:
1. Preencha o `.env` com os dados de um banco MySQL de teste (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, etc) e, se for testar o Google Sheets, com o ID de uma planilha (`GOOGLE_SPREADSHEET_ID`).
2. Se for testar o Google Sheets, troque o conteúdo de `credentials.json` pela chave de uma service account real do Google.
3. Edite o `config.json` (nome da tabela, planilha, etc — não precisa se for só rodar os testes unitários).

Nenhum desses dois arquivos (`.env`, `credentials.json`) vai pro git, então pode preencher sem medo.

## O que já dá pra rodar

- **`npm test`** — roda os testes unitários. Não precisa de banco nem de planilha configurados, é o mais rápido de rodar e provavelmente o melhor lugar pra começar a olhar o código.
- **`npm run test:config`** — só carrega o `config.json` e mostra se ele é válido, sem mexer em banco ou planilha.
- **`npm run test:connection`** — conecta num banco MySQL de verdade (usa o `.env`) e imprime as 3 primeiras linhas da tabela.
- **`npm run test:sheet`** — escreve duas linhas de teste numa planilha do Google de verdade (usa `credentials.json` e `.env`).

Pra rodar `test:connection`/`test:sheet` de verdade, precisa de um banco e uma planilha reais configurados — o `npm test` não precisa de nada disso.

## O que ainda não fiz

- O fluxo completo (ler do banco → filtrar → escrever na planilha, rodando tudo junto) ainda não tá pronto/testado de ponta a ponta. Hoje só dá pra testar cada pedaço separado (conexão com banco, config, escrita na planilha, filtro de dedupe).

- Ainda não tem uma forma de unificar/mesclar linhas duplicadas em vez de só remover (hoje o dedupe só descarta a duplicata, não combina os dados das duas).
- Ainda não tem validação de dados (tipo checar se um CPF é válido) nem separação de linhas boas/ruins.
- O jeito de escolher o que fazer com os dados (`raw`, `dedupe`) ainda é meio hardcoded no código — a ideia é isso virar algo mais configurável/plugável no futuro, sem precisar mexer no código toda vez.
- Não tem build ainda (não gera uma versão "pronta pra produção"), roda tudo direto com `tsx`.
- A leitura do banco já é feita em lotes (pra não estourar memória com tabela grande), mas não testei ainda com um volume grande de verdade.

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
    dedupe.ts          # implementação do filtro de dedupe
  tests/               # testes unitários (vitest)
scripts/               # scripts manuais de smoke test (banco, config, sheets)
```
