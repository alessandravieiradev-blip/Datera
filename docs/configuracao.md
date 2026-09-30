<p align="center">
  <a href="../README.md"><img src="https://img.shields.io/badge/In%C3%ADcio-475569?style=for-the-badge" alt="Início"></a>
  <a href="gestores.md"><img src="https://img.shields.io/badge/Para%20gestores-2563EB?style=for-the-badge" alt="Guia para gestores"></a>
  <a href="devs.md"><img src="https://img.shields.io/badge/Para%20devs-16181D?style=for-the-badge" alt="Guia para devs"></a>
</p>

[Guia para devs](devs.md) › Configuração

# Configuração

Se você instalou pelo npm, o jeito mais rápido de começar é `datera init`, que cria uma `config.json` na pasta (com `--from alunos.xlsx`, ela já sai lendo desse arquivo).

No repositório, o projeto usa três arquivos que não vão pro git. É só copiar os exemplos e colocar os seus dados (se você não for usar banco nem Google Sheets, o `config.json` já resolve):

```bash
cp .env.example .env
cp credentials.json.example credentials.json
cp config.json.example config.json
```

O `.env`:

| Variável                                                                                            | O que colocar                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DB_HOST`                                                                                           | Endereço do servidor do banco (MySQL, PostgreSQL ou SQL Server)                                                                                                |
| `DB_PORT`                                                                                           | Porta do banco (padrão `3306`, `5432` ou `1433`)                                                                                                               |
| `DB_USER`                                                                                           | Usuário de acesso ao banco                                                                                                                                     |
| `DB_PASSWORD`                                                                                       | Senha do usuário (se tiver caractere especial, coloque entre aspas)                                                                                            |
| `DB_NAME`                                                                                           | Nome do banco                                                                                                                                                  |
| `DB_TABLE`                                                                                          | Nome da tabela ou view a ser lida                                                                                                                              |
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH`                                                                   | Caminho pro arquivo de credenciais (`./credentials.json` por padrão)                                                                                           |
| `GOOGLE_SPREADSHEET_ID`                                                                             | ID da planilha de destino, o trecho da URL entre `/d/` e `/edit`                                                                                               |
| `DEST_DB_HOST`, `DEST_DB_PORT`, `DEST_DB_USER`, `DEST_DB_PASSWORD`, `DEST_DB_NAME`, `DEST_DB_TABLE` | Os mesmos dados, mas do banco onde gravar, quando o destino é um banco. Veja [Bancos de dados como destino](fontes-e-destinos.md#bancos-de-dados-como-destino) |

O `credentials.json`:

Aqui vai a chave JSON de uma service account do Google Cloud. Depois de criar a service account, lembra de compartilhar a planilha com o e-mail dela como Editor, senão a escrita dá erro de permissão.

E o `config.json`:

| Campo                                                | O que colocar                                                                                                                                            |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source`                                             | De onde ler: um banco, uma planilha ou um arquivo. Veja [Fontes e destinos](fontes-e-destinos.md)                                                        |
| `destination`                                        | Onde escrever: uma planilha, um arquivo ou uma tabela de banco. Veja [Fontes e destinos](fontes-e-destinos.md)                                           |
| `tableName`, `spreadsheetId`, `credentialsPath`      | Mesmos valores do `.env` (servem de reserva caso o `.env` não defina)                                                                                    |
| `mode`                                               | `"raw"`, `"dedupe"` ou `"merge"`                                                                                                                         |
| `dbHost`, `dbPort`, `dbUser`, `dbPassword`, `dbName` | Mesmos dados do `.env`                                                                                                                                   |
| `dedupeColumn`                                       | Só se `mode` for `"dedupe"`. Coluna usada pra identificar duplicatas                                                                                     |
| `dedupeStrategy`                                     | Opcional, só no modo `dedupe`. `"keep-first"` ou `"keep-last"` (padrão: `"keep-first"`)                                                                  |
| `dedupeKeyNormalizer`                                | Opcional, só no modo `dedupe`. Normalizador aplicado antes de comparar, tipo `"lowercase"` pra `Lia@Email.com` e `lia@email.com` contarem como repetidos |

Os campos do modo `merge` (só o `mergeKeyColumn` e o `mergeColumns` são obrigatórios):

| Campo                   | O que faz                                                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `mergeKeyColumn`        | Coluna usada pra saber quais linhas são "a mesma coisa" e devem ser unificadas                                                           |
| `mergeColumns`          | Lista de `{ column, strategy, separator?, distribute?, byGroup?, unkeyed? }`. `strategy` é `"concat"`, `"overwrite"` ou `"extra-column"` |
| `mergeEmptyKeyLabel`    | Rótulo das linhas com a chave vazia (padrão: `(sem <coluna>)`)                                                                           |
| `mergeKeyNormalizer`    | Nome do normalizador de chave (veja a seção [Normalizadores de chave](normalizadores.md)). Padrão: `trim`                                |
| `mergeRejectedKeyLabel` | Rótulo das linhas cuja chave o normalizador rejeitou (padrão: `(<coluna> inválido)`)                                                     |
| `normalizerModules`     | Lista de caminhos de arquivos com normalizadores criados por você                                                                        |
| `adapterModules`        | Lista de caminhos de arquivos com fontes e destinos criados por você                                                                     |

Sobre as linhas sem chave (`unkeyed`): por padrão cada linha sem chave vai pro fim da planilha, uma por linha, com o rótulo. Se uma coluna do `mergeColumns` tiver `"unkeyed": { "strategy": "collapse-column", "into": "Nome da coluna nova", "separator": " | " }`, os valores dela nessas linhas são juntados numa coluna só, numa linha só. Aí ficam no máximo duas linhas, uma pras chaves vazias e outra pras rejeitadas. As outras colunas dessas linhas não vão junto.

Os campos de preparação são opcionais e funcionam em qualquer modo:

| Campo            | O que faz                                                                                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `alignColumns`   | `true` ou `{ auto?, rename? }`. Junta as colunas que são a mesma escrita de jeitos diferentes. Veja [Alinhar colunas](preparacao-e-pendencias.md#alinhar-colunas-aligncolumns)               |
| `fillEmpty`      | Lista de `{ column, fallbackColumns?, default? }`. Preenche célula vazia com outra coluna ou com um valor padrão. Veja [Preparando os dados](preparacao-e-pendencias.md#preparando-os-dados) |
| `combineColumns` | Lista de `{ into, columns, separator?, keepSources? }`. Junta várias colunas da mesma linha numa só. Veja [Preparando os dados](preparacao-e-pendencias.md#preparando-os-dados)              |
| `validation`     | `{ rules, pendingSheet?, reasonColumn? }`. Manda as linhas com problema pra uma aba separada. Veja [Separar as pendências](preparacao-e-pendencias.md#separar-as-pendências-validation)      |

Se o mesmo valor estiver no `.env` e no `config.json`, vale o do `.env`.

## Como os dados passam pelo ETL

```text
fonte: banco, planilha ou arquivo
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
destino: planilha ou arquivo
```

### Modos

O `raw` é o padrão e só escreve os dados do jeito que vieram.
O `dedupe` tira as linhas repetidas olhando uma coluna e fica com a primeira ou com a última (`dedupeStrategy`). A linha que sai vai embora inteira. Com `dedupeKeyNormalizer`, ele compara depois de passar o valor por um normalizador, os mesmos do merge.
O `merge` junta as linhas com a mesma chave numa só, e cada coluna do `mergeColumns` diz como os valores vão ser juntados.

### Estratégias do merge

| `strategy`     | O que faz                                                                           | Com `cor` = azul, verde, azul fica |
| -------------- | ----------------------------------------------------------------------------------- | ---------------------------------- |
| `concat`       | Junta os valores diferentes numa célula, separados pelo `separator` (padrão `"; "`) | `azul; verde`                      |
| `overwrite`    | Fica com o último valor preenchido                                                  | `azul`                             |
| `extra-column` | O primeiro fica na coluna e os outros vão pra `<coluna>_2`, `<coluna>_3`...         | `azul`, `verde`, `azul`            |

O `concat` também aceita o `distribute`, que espalha os valores em colunas ([tem exemplo](exemplos.md#8-um-valor-em-cada-coluna-distribute)). Nas três, célula vazia é ignorada.

---

[← Guia para devs](devs.md) · [Fontes e destinos →](fontes-e-destinos.md)

<p align="center">
  <a href="../README.md"><img src="https://img.shields.io/badge/In%C3%ADcio-475569?style=for-the-badge" alt="Início"></a>
  <a href="gestores.md"><img src="https://img.shields.io/badge/Para%20gestores-2563EB?style=for-the-badge" alt="Guia para gestores"></a>
  <a href="devs.md"><img src="https://img.shields.io/badge/Para%20devs-16181D?style=for-the-badge" alt="Guia para devs"></a>
</p>
