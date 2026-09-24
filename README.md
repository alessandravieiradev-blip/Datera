# ETL MySQL → Google Sheets

Automação em TypeScript que lê uma tabela ou view do MySQL, trata os dados e escreve numa planilha do Google Sheets.

A ideia começou simples (copiar uma tabela pra planilha), mas dado de verdade vem bagunçado: cliente repetido, documento escrito de três jeitos, DDD faltando, telefone espalhado em várias colunas. Então o projeto foi ganhando ferramentas pra resolver isso só mexendo no `config.json`, sem precisar escrever código:

- **Tirar duplicadas** (`dedupe`) ou **juntar linhas da mesma pessoa sem perder nada** (`merge`)
- **Escolher o que acontece com cada coluna** no merge: juntar numa célula, ficar com o último valor ou abrir colunas novas
- **Normalizadores de chave**, pra `Ana@Email.com` e ` ana@email.com` serem a mesma pessoa (tem prontos e dá pra criar o seu)
- **Regras diferentes por tipo de chave**, tipo tratar CPF de um jeito e CNPJ de outro
- **Tratamento das linhas sem chave**, que nunca somem nem se misturam com outras
- **Preencher vazios e juntar colunas** antes de tudo
- **Distribuir valores em várias colunas**, sem nunca descartar nenhum

Se quiser ver o que dá pra fazer antes de configurar, pula direto pros [Exemplos](#exemplos-do-mais-simples-ao-mais-completo).

## Sumário

- [Instalação](#instalação)
- [Configuração](#configuração)
- [Como os dados passam pelo ETL](#como-os-dados-passam-pelo-etl)
- [Exemplos, do mais simples ao mais completo](#exemplos-do-mais-simples-ao-mais-completo)
- [Preparando os dados](#preparando-os-dados)
- [Distribuir valores em várias colunas](#distribuir-valores-em-várias-colunas-distribute)
- [Normalizadores de chave](#normalizadores-de-chave)
- [Rodando](#rodando)
- [Testes](#testes)
- [Estrutura](#estrutura)

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

**`credentials.json`**

Substitua o conteúdo pela chave JSON de uma service account do Google Cloud. Depois de criar a service account, compartilhe a planilha manualmente com o e-mail dela, com permissão de Editor. Sem isso a escrita falha por falta de permissão.

**`config.json`**

| Campo                                                | O que colocar                                                                           |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `tableName`, `spreadsheetId`, `credentialsPath`      | Mesmos valores do `.env` (servem de reserva caso o `.env` não defina)                   |
| `mode`                                               | `"raw"`, `"dedupe"` ou `"merge"`                                                        |
| `dbHost`, `dbPort`, `dbUser`, `dbPassword`, `dbName` | Mesmos dados do `.env`                                                                  |
| `dedupeColumn`                                       | Só se `mode` for `"dedupe"`. Coluna usada pra identificar duplicatas                    |
| `dedupeStrategy`                                     | Opcional, só no modo `dedupe`. `"keep-first"` ou `"keep-last"` (padrão: `"keep-first"`) |

Campos do modo `merge` (todos opcionais, menos `mergeKeyColumn` e `mergeColumns`):

| Campo                   | O que faz                                                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `mergeKeyColumn`        | Coluna usada pra saber quais linhas são "a mesma coisa" e devem ser unificadas                                                           |
| `mergeColumns`          | Lista de `{ column, strategy, separator?, distribute?, byGroup?, unkeyed? }`. `strategy` é `"concat"`, `"overwrite"` ou `"extra-column"` |
| `mergeEmptyKeyLabel`    | Rótulo das linhas com a chave vazia (padrão: `(sem <coluna>)`)                                                                           |
| `mergeKeyNormalizer`    | Nome do normalizador de chave (veja a seção [Normalizadores de chave](#normalizadores-de-chave)). Padrão: `trim`                         |
| `mergeRejectedKeyLabel` | Rótulo das linhas cuja chave o normalizador rejeitou (padrão: `(<coluna> inválido)`)                                                     |
| `normalizerModules`     | Lista de caminhos de arquivos com normalizadores criados por você                                                                        |

**Linhas sem chave (`unkeyed`).** Por padrão, cada linha sem chave vai pro fim da planilha, uma por linha, com o rótulo. Se uma coluna de `mergeColumns` tiver `"unkeyed": { "strategy": "collapse-column", "into": "Nome da coluna nova", "separator": " | " }`, o valor dela em todas as linhas sem chave é juntado numa coluna só, numa única linha. Ficam duas linhas no máximo: uma pras chaves vazias e outra pras rejeitadas, cada uma com seu rótulo. As outras colunas dessas linhas não vão junto.

Campos de preparação (opcionais, valem pra qualquer modo):

| Campo            | O que faz                                                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `fillEmpty`      | Lista de `{ column, fallbackColumns?, default? }`. Preenche célula vazia com outra coluna ou com um valor padrão. Veja [Preparando os dados](#preparando-os-dados) |
| `combineColumns` | Lista de `{ into, columns, separator?, keepSources? }`. Junta várias colunas da mesma linha numa só. Veja [Preparando os dados](#preparando-os-dados)              |

Quando um valor existe tanto no `.env` quanto no `config.json`, o `.env` tem prioridade.

## Como os dados passam pelo ETL

```text
banco (tabela ou view)
   │
   ├─ fillEmpty        preenche células vazias               (opcional)
   ├─ combineColumns   junta colunas da mesma linha           (opcional)
   │
   ├─ modo
   │    raw     escreve do jeito que tá
   │    dedupe  tira linhas repetidas por uma coluna
   │    merge   junta linhas com a mesma chave, coluna por coluna
   │
   ▼
planilha do Google Sheets
```

### Modos

- **`raw`**: modo padrão, escreve os dados como vieram do banco, sem tratamento nenhum.
- **`dedupe`**: remove linhas duplicadas com base numa coluna, mantendo a primeira ou a última ocorrência conforme `dedupeStrategy`. A linha descartada some inteira.
- **`merge`**: junta as linhas que têm a mesma chave numa linha só, e cada coluna do `mergeColumns` diz como os valores se juntam.

### Estratégias do merge

| `strategy`     | O que faz                                                                  | Exemplo com `cor` = azul, verde, azul |
| -------------- | -------------------------------------------------------------------------- | ------------------------------------- |
| `concat`       | Junta os valores diferentes numa célula, com o `separator` (padrão `"; "`) | `azul; verde`                         |
| `overwrite`    | Fica com o último valor preenchido                                         | `azul`                                |
| `extra-column` | Primeiro valor na coluna, os outros em `<coluna>_2`, `<coluna>_3`...       | `azul`, `verde`, `azul`               |

O `concat` também aceita `distribute` pra espalhar os valores em colunas. Em todas as estratégias célula vazia é ignorada.

## Exemplos, do mais simples ao mais completo

Todos os exemplos abaixo mostram só a parte do `config.json` que importa pro exemplo (os dados do banco e da planilha ficam iguais ao que você já configurou). As tabelas de saída são exatamente o que o ETL escreve na planilha.

### 1. Copiar a tabela do jeito que tá (`raw`)

O mais simples de todos. Nada é tratado, o que vem do banco vai pra planilha.

```json
{ "mode": "raw" }
```

| id  | nome  | email             |
| --- | ----- | ----------------- |
| 1   | Ana   | `ana@email.com`   |
| 2   | Bruno | `bruno@email.com` |
| 3   | Ana   | `ana@email.com`   |

Repara que a Ana aparece duas vezes. Os próximos exemplos resolvem isso.

### 2. Tirar linhas repetidas (`dedupe`)

Aqui o ETL olha a coluna `email` e deixa só uma linha pra cada valor. Com `keep-last`, fica a última que apareceu.

```json
{
    "mode": "dedupe",
    "dedupeColumn": "email",
    "dedupeStrategy": "keep-last"
}
```

Entrada:

| id  | nome      | email             | cidade       |
| --- | --------- | ----------------- | ------------ |
| 1   | Ana       | `ana@email.com`   | Pelotas      |
| 2   | Bruno     | `bruno@email.com` | Rio Grande   |
| 3   | Ana Souza | `ana@email.com`   | Porto Alegre |

Saída:

| id  | nome      | email             | cidade       |
| --- | --------- | ----------------- | ------------ |
| 2   | Bruno     | `bruno@email.com` | Rio Grande   |
| 3   | Ana Souza | `ana@email.com`   | Porto Alegre |

O que aconteceu:

- A linha 1 da Ana foi descartada, ficou só a 3.
- Com `keep-last` a linha que ficou vai pra posição da última ocorrência, por isso o Bruno subiu. Com `keep-first` (o padrão) a ordem original se mantém.
- O `dedupe` descarta a linha inteira. Se você não quer perder nada, o próximo exemplo é pra você.

### 3. Juntar linhas sem perder informação (`merge`)

O `merge` junta todas as linhas com a mesma chave numa linha só, e você escolhe o que acontece com cada coluna.

```json
{
    "mode": "merge",
    "mergeKeyColumn": "email",
    "mergeColumns": [
        { "column": "produto", "strategy": "concat", "separator": ", " },
        { "column": "status", "strategy": "overwrite" },
        { "column": "telefone", "strategy": "extra-column" }
    ]
}
```

Entrada:

| email             | produto | status   | telefone   |
| ----------------- | ------- | -------- | ---------- |
| `ana@email.com`   | Anel    | pendente | 99999-0001 |
| `ana@email.com`   | Colar   | pago     | 98888-0002 |
| `ana@email.com`   | Anel    |          |            |
| `bruno@email.com` | Brinco  | pago     | 97777-0003 |

Saída:

| email             | produto     | status | telefone   | telefone_2 |
| ----------------- | ----------- | ------ | ---------- | ---------- |
| `ana@email.com`   | Anel, Colar | pago   | 99999-0001 | 98888-0002 |
| `bruno@email.com` | Brinco      | pago   | 97777-0003 |            |

O que aconteceu:

- `concat` juntou os produtos numa célula só. O "Anel" repetido aparece uma vez.
- `overwrite` ficou com o último valor preenchido. A linha 3 tinha `status` vazio, então valeu o "pago" da linha 2.
- `extra-column` criou `telefone_2` pro segundo telefone. Se tivesse um terceiro, ia pra `telefone_3`, e assim vai.
- Célula vazia é ignorada nas três estratégias.
- Colunas que não estão no `mergeColumns` ficam com o valor da primeira linha do grupo.

### 4. Chave escrita de jeitos diferentes (normalizador pronto)

Dado de verdade é bagunçado. Esses três e-mails são da mesma pessoa, mas sem normalizador o ETL acha que são três pessoas diferentes.

```json
{
    "mode": "merge",
    "mergeKeyColumn": "email",
    "mergeKeyNormalizer": "lowercase",
    "mergeColumns": [
        { "column": "produto", "strategy": "concat", "separator": ", " }
    ]
}
```

Entrada:

| email            | produto  |
| ---------------- | -------- |
| `Ana@Email.com`  | Anel     |
| ` ana@email.com` | Colar    |
| `ANA@EMAIL.COM ` | Pulseira |

Saída:

| email           | produto               |
| --------------- | --------------------- |
| `Ana@Email.com` | Anel, Colar, Pulseira |

O `lowercase` tira os espaços e deixa tudo minúsculo só pra comparar. Na planilha o e-mail continua como veio na primeira linha. Tem outros prontos, e dá pra criar o seu, veja [Normalizadores de chave](#normalizadores-de-chave).

### 5. Linhas sem chave (padrão)

E quando a chave tá vazia ou não é válida? Aqui a chave é um CPF, limpo com o `digitsOnly`.

```json
{
    "mode": "merge",
    "mergeKeyColumn": "cpf",
    "mergeKeyNormalizer": "digitsOnly",
    "mergeEmptyKeyLabel": "sem CPF",
    "mergeRejectedKeyLabel": "CPF inválido",
    "mergeColumns": [
        { "column": "nome", "strategy": "extra-column" },
        { "column": "telefone", "strategy": "concat", "separator": " | " }
    ]
}
```

Entrada:

| cpf            | nome      | telefone   |
| -------------- | --------- | ---------- |
| 111.444.777-35 | Ana       | 99999-0001 |
| 11144477735    | Ana Paula | 98888-0002 |
|                | Carla     | 96666-0004 |
|                | Diego     | 95555-0005 |
| n/a            | Elisa     | 94444-0006 |

Saída:

| cpf            | nome  | nome_2    | telefone                 |
| -------------- | ----- | --------- | ------------------------ |
| 111.444.777-35 | Ana   | Ana Paula | 99999-0001 \| 98888-0002 |
| sem CPF        | Carla |           | 96666-0004               |
| sem CPF        | Diego |           | 95555-0005               |
| CPF inválido   | Elisa |           | 94444-0006               |

O que aconteceu:

- `111.444.777-35` e `11144477735` viraram a mesma chave, então a Ana foi unificada.
- Carla e Diego não têm CPF. Eles nunca se juntam entre si (seriam pessoas diferentes), vão pro fim da planilha, um por linha, com o rótulo `sem CPF`.
- O `n/a` da Elisa não tem nenhum número, então o `digitsOnly` rejeitou. Ela vai pro fim também, com o rótulo `CPF inválido`.

### 6. Linhas sem chave numa linha só (`unkeyed`)

Mesma entrada do exemplo 5, mas agora as linhas sem chave são resumidas.

```json
"mergeColumns": [
  {
    "column": "nome",
    "strategy": "extra-column",
    "unkeyed": { "strategy": "collapse-column", "into": "Nomes sem CPF", "separator": " | " }
  },
  {
    "column": "telefone",
    "strategy": "concat",
    "separator": " | ",
    "unkeyed": { "strategy": "collapse-column", "into": "Telefones sem CPF", "separator": " | " }
  }
]
```

Saída:

| cpf            | nome | nome_2    | telefone                 | Nomes sem CPF  | Telefones sem CPF        |
| -------------- | ---- | --------- | ------------------------ | -------------- | ------------------------ |
| 111.444.777-35 | Ana  | Ana Paula | 99999-0001 \| 98888-0002 |                |                          |
| sem CPF        |      |           |                          | Carla \| Diego | 96666-0004 \| 95555-0005 |
| CPF inválido   |      |           |                          | Elisa          | 94444-0006               |

Agora são no máximo duas linhas no fim: uma pras chaves vazias e outra pras rejeitadas. Só as colunas com `unkeyed` vão junto, as outras ficam de fora nessas linhas.

### 7. Arrumar os dados antes (`fillEmpty` e `combineColumns`)

Essas duas etapas rodam antes de qualquer modo, então funcionam até no `raw`.

```json
{
    "mode": "raw",
    "fillEmpty": [
        { "column": "DDD", "default": "53" },
        {
            "column": "cidade_entrega",
            "fallbackColumns": ["cidade"],
            "default": "não informada"
        }
    ],
    "combineColumns": [{ "into": "Telefone", "columns": ["DDD", "Fone"] }]
}
```

Entrada:

| nome  | DDD | Fone       | cidade       | cidade_entrega |
| ----- | --- | ---------- | ------------ | -------------- |
| Ana   | 51  | 99999-0001 | Porto Alegre | Canoas         |
| Bruno |     | 98888-0002 | Pelotas      |                |
| Carla | 53  |            |              |                |

Saída:

| nome  | Telefone      | cidade       | cidade_entrega |
| ----- | ------------- | ------------ | -------------- |
| Ana   | 51 99999-0001 | Porto Alegre | Canoas         |
| Bruno | 53 98888-0002 | Pelotas      | Pelotas        |
| Carla |               |              | não informada  |

O que aconteceu:

- O Bruno tava sem DDD, ganhou o `53` do `default`, e aí o telefone dele pôde ser montado.
- A `cidade_entrega` vazia do Bruno puxou a `cidade`. A da Carla não tinha nem `cidade`, então ficou com o `default`.
- A Carla não tem `Fone`, então o `Telefone` dela ficou vazio em vez de sair só `53`.
- `DDD` e `Fone` sumiram e o `Telefone` apareceu no lugar deles.

### 8. Um valor por coluna (`distribute`)

Em vez de juntar tudo numa célula, o `distribute` espalha os valores em colunas. Com `sources`, várias colunas entram na mesma lista.

```json
{
    "mode": "merge",
    "mergeKeyColumn": "email",
    "mergeColumns": [
        {
            "column": "Fone 1",
            "strategy": "concat",
            "separator": " | ",
            "distribute": {
                "columns": ["Fone 1", "Fone 2"],
                "sources": ["Fone 2"],
                "overflowInto": "Outros telefones"
            }
        }
    ]
}
```

Entrada:

| email             | Fone 1     | Fone 2     |
| ----------------- | ---------- | ---------- |
| `ana@email.com`   | 99999-0001 | 3222-0001  |
| `ana@email.com`   | 99999-0001 | 98888-0002 |
| `ana@email.com`   | 97777-0003 |            |
| `bruno@email.com` |            | 96666-0004 |

Saída:

| email             | Fone 1     | Fone 2    | Outros telefones         |
| ----------------- | ---------- | --------- | ------------------------ |
| `ana@email.com`   | 99999-0001 | 3222-0001 | 98888-0002 \| 97777-0003 |
| `bruno@email.com` | 96666-0004 |           |                          |

O que aconteceu:

- A Ana tinha 5 telefones nas duas colunas, com um repetido. Sobraram 4 diferentes: 2 foram pros destinos e 2 pro `Outros telefones`. Nenhum se perdeu.
- O Bruno só tinha telefone no `Fone 2`, mas ele subiu pro `Fone 1`. A planilha fica sempre preenchida da esquerda pra direita.

Sem `overflowInto` o ETL cria a coluna de sobra sozinho:

```json
{
    "column": "cor",
    "strategy": "concat",
    "distribute": { "columns": ["cor_principal"] }
}
```

Entrada:

| produto | cor     |
| ------- | ------- |
| Anel    | dourado |
| Anel    | prata   |
| Anel    | rosé    |

Saída:

| produto | cor_principal | cor_overflow |
| ------- | ------------- | ------------ |
| Anel    | dourado       | prata; rosé  |

### 9. Regra diferente por tipo de chave (`byGroup`)

Aqui o normalizador `codigoProduto` (o do guia em [Criando o seu próprio normalizador](#criando-o-seu-próprio-normalizador)) separa as letras do código como `group`. Produtos `AB` ficam com uma cor por coluna, produtos `CD` ficam com as cores juntas numa coluna própria.

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

O que aconteceu:

- `ab-0042` e `AB 0042` são o mesmo produto, viraram uma linha com `cor` e `cor_2`.
- `CD0042` tem os mesmos números, mas o grupo é outro, então nunca se junta com o `AB`. As cores dele foram pra `Cores CD`.
- `XYZ` não tem o formato esperado, o normalizador rejeitou e ele foi pro fim com o rótulo padrão.

### 10. Tudo junto: cadastro de clientes com CPF e CNPJ

O caso que deu origem ao projeto. Uma base de clientes onde:

- a mesma pessoa aparece várias vezes, com o documento escrito de jeitos diferentes;
- CPF e CNPJ ficam na mesma coluna e precisam de tratamentos diferentes;
- tem DDD faltando;
- tem cliente sem documento ou com documento errado.

Primeiro, um normalizador que entende CPF e CNPJ (em `local/documento.ts`):

```ts
import { KeyNormalizer } from "../src/filters/keyNormalizers";

const documento: KeyNormalizer = (raw) => {
    const digitos = String(raw).replace(/\D/g, "");

    if (digitos.length === 11) return { key: digitos, group: "cpf" };
    if (digitos.length === 14) return { key: digitos, group: "cnpj" };

    return null;
};

export const normalizers = { documento };
```

Depois, o config:

```json
{
    "mode": "merge",
    "mergeKeyColumn": "Documento",
    "normalizerModules": ["./local/documento.ts"],
    "mergeKeyNormalizer": "documento",
    "mergeEmptyKeyLabel": "sem documento",
    "mergeRejectedKeyLabel": "documento inválido",
    "fillEmpty": [
        { "column": "DDD 1", "default": "não tem" },
        {
            "column": "DDD 2",
            "fallbackColumns": ["DDD 1"],
            "default": "não tem"
        }
    ],
    "mergeColumns": [
        { "column": "Código", "strategy": "concat", "separator": " | " },
        {
            "column": "Nome",
            "strategy": "extra-column",
            "byGroup": {
                "cnpj": {
                    "strategy": "concat",
                    "into": "Nomes CNPJ",
                    "separator": " | "
                }
            },
            "unkeyed": {
                "strategy": "collapse-column",
                "into": "Nomes sem documento",
                "separator": " | "
            }
        },
        { "column": "Documento", "strategy": "overwrite" },
        {
            "column": "DDD 1",
            "strategy": "concat",
            "separator": " | ",
            "distribute": {
                "columns": ["DDD 1", "DDD 2"],
                "sources": ["DDD 2"],
                "overflowInto": "Outros DDDs"
            }
        },
        {
            "column": "Fone 1",
            "strategy": "concat",
            "separator": " | ",
            "distribute": {
                "columns": ["Fone 1", "Fone 2"],
                "sources": ["Fone 2"],
                "overflowInto": "Outros telefones"
            }
        },
        { "column": "Cidade", "strategy": "concat", "separator": " | " },
        { "column": "Ativo", "strategy": "overwrite" }
    ]
}
```

Entrada:

| Código | Nome          | Documento          | DDD 1 | Fone 1     | DDD 2 | Fone 2     | Cidade       | Ativo |
| ------ | ------------- | ------------------ | ----- | ---------- | ----- | ---------- | ------------ | ----- |
| 1      | Ana           | 111.444.777-35     | 53    | 99999-0001 |       | 3222-0001  | Pelotas      | S     |
| 2      | Ana Paula     | 11144477735        | 51    | 98888-0002 |       | 99999-0001 | Porto Alegre | N     |
| 3      | Joias Ltda    | 11.222.333/0001-81 |       | 3000-0000  |       |            | Pelotas      | S     |
| 4      | Joias Ltda ME | 11222333000181     | 53    | 3000-0001  |       |            | Pelotas      | S     |
| 5      | Bruno         | 22233344405        | 51    | 97777-0000 |       |            | Rio Grande   | S     |
| 6      | Carla         |                    | 53    | 96666-0000 |       |            | Pelotas      | N     |
| 7      | Diego         | 123                | 53    | 95555-0000 |       |            | Pelotas      | S     |

Saída:

| Código | Nome  | Nome_2    | Documento          | DDD 1   | Fone 1     | DDD 2 | Fone 2    | Cidade                  | Ativo | Outros telefones | Nomes CNPJ                  | Nomes sem documento |
| ------ | ----- | --------- | ------------------ | ------- | ---------- | ----- | --------- | ----------------------- | ----- | ---------------- | --------------------------- | ------------------- |
| 1 \| 2 | Ana   | Ana Paula | 11144477735        | 53      | 99999-0001 | 51    | 3222-0001 | Pelotas \| Porto Alegre | N     | 98888-0002       |                             |                     |
| 3 \| 4 |       |           | 11222333000181     | não tem | 3000-0000  | 53    | 3000-0001 | Pelotas                 | S     |                  | Joias Ltda \| Joias Ltda ME |                     |
| 5      | Bruno |           | 22233344405        | 51      | 97777-0000 |       |           | Rio Grande              | S     |                  |                             |                     |
|        |       |           | sem documento      |         |            |       |           |                         |       |                  |                             | Carla               |
|        |       |           | documento inválido |         |            |       |           |                         |       |                  |                             | Diego               |

O que aconteceu, passo a passo:

1. **`fillEmpty`**: DDD vazio virou o DDD 1 da mesma linha, e quando nem o DDD 1 existia virou `não tem` (é o caso da Joias Ltda).
2. **Normalizador**: `111.444.777-35` e `11144477735` viraram a mesma chave no grupo `cpf`. Os dois formatos do CNPJ viraram a mesma chave no grupo `cnpj`. O `123` não tem nem 11 nem 14 dígitos e foi rejeitado.
3. **`Código`**: os códigos das linhas unificadas ficaram juntos (`1 | 2`), dá pra achar os registros originais no banco.
4. **`Nome`**: pra CPF, cada nome numa coluna (`Nome`, `Nome_2`). Pra CNPJ, o `byGroup` juntou os nomes em `Nomes CNPJ`.
5. **Telefones**: os `Fone 1` e `Fone 2` da Ana (4 números, 1 repetido) foram distribuídos, e o que não coube foi pro `Outros telefones`. Os DDDs passam pelo mesmo processo, só que separados dos telefones, então o DDD 2 de uma linha não é necessariamente o DDD do Fone 2.
6. **`Ativo`**: `overwrite` ficou com o último valor, então se o cadastro mais recente tá inativo, a pessoa aparece inativa.
7. **Sem chave**: Carla (sem documento) e Diego (documento inválido) foram pro fim, só com o nome, cada um com seu rótulo.

## Preparando os dados

Antes de rodar o modo (`raw`, `dedupe` ou `merge`), dá pra arrumar as linhas com duas etapas opcionais. Elas rodam nessa ordem: primeiro o `fillEmpty`, depois o `combineColumns`.

### Preencher vazios (`fillEmpty`)

Serve pra quando uma coluna vem vazia e dá pra usar o valor de outra coluna no lugar, ou um texto padrão.

```json
"fillEmpty": [
  { "column": "DDD 1", "default": "não tem" },
  { "column": "DDD 2", "fallbackColumns": ["DDD 1"], "default": "não tem" }
]
```

Como funciona:

- Se a célula de `column` já tem valor, nada muda.
- Se tá vazia, ele procura em `fallbackColumns`, na ordem, e usa o primeiro que tiver valor.
- Se nenhuma tiver, usa o `default`. Sem `default`, a célula fica como veio.
- Conta como vazio: `null`, texto vazio ou só espaços.
- As regras sempre olham a linha como veio do banco. Então no exemplo, se o `DDD 1` tá vazio, o `DDD 2` recebe `"não tem"` do próprio `default`, e não do `DDD 1` já preenchido. A ordem das regras não muda o resultado.

### Juntar colunas (`combineColumns`)

Serve pra transformar várias colunas da mesma linha numa só, tipo DDD e telefone virando um telefone completo.

```json
"combineColumns": [
  { "into": "Telefone", "columns": ["DDD", "Fone"], "separator": " " }
]
```

| DDD | Fone       |     | Telefone      |
| --- | ---------- | --- | ------------- |
| 53  | 99999-0001 |     | 53 99999-0001 |
| 53  | _(vazio)_  |     | _(vazio)_     |

Como funciona:

- Os valores são juntados na ordem de `columns`, com o `separator` (padrão: um espaço).
- Se alguma das colunas estiver vazia, o resultado fica vazio. Assim não sai um valor pela metade. Se quiser preencher antes, use o `fillEmpty`.
- As colunas de origem somem da planilha, a não ser que você coloque `"keepSources": true`.
- A coluna nova aparece no lugar da primeira coluna de origem, e não no fim da planilha.

## Distribuir valores em várias colunas (`distribute`)

No modo `merge`, o `concat` normalmente junta todos os valores numa célula só (`"azul; verde; roxo"`). Com o `distribute`, cada valor vai pra uma coluna.

```json
"mergeColumns": [
  {
    "column": "Fone 1",
    "strategy": "concat",
    "separator": " | ",
    "distribute": {
      "columns": ["Fone 1", "Fone 2", "Fone 3"],
      "sources": ["Fone 2", "Fone 3"],
      "overflowInto": "Outros telefones"
    }
  }
]
```

| Campo          | O que faz                                                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `columns`      | Colunas de destino, na ordem. Cada valor diferente vai pra uma                                                                            |
| `sources`      | Opcional. Outras colunas que entram junto com a `column`. No exemplo, os telefones das três colunas de todas as linhas viram uma lista só |
| `overflowInto` | Opcional. Coluna pro que sobrar quando tem mais valores que destinos. Sem ele, o projeto cria uma coluna `<column>_overflow` sozinho      |

Como funciona:

- Valores repetidos aparecem uma vez só.
- Nenhum valor é descartado. O que não cabe nos destinos vai pro overflow, juntado com o `separator`.
- As colunas de `column` e `sources` que não são destino somem da planilha.
- Destino que não recebe valor fica vazio, ele não guarda valor velho da primeira linha.
- Também vale pra linhas que ficaram sozinhas no grupo, pra planilha sair com as mesmas colunas em todas as linhas.
- Só funciona com `strategy: "concat"`. Dá pra usar dentro do `byGroup` também, mas não junto com o `into`, porque quem decide as colunas é o `distribute`. Se configurar errado, a validação da config avisa antes de rodar.

## Normalizadores de chave

### Pra que serve

No modo `merge`, o projeto junta as linhas que têm a mesma chave. Só que dado de verdade é bagunçado. `Ana@Email.com` e `ana@email.com ` são a mesma pessoa, mas pro computador são textos diferentes, então a junção não acontece.

O **normalizador** resolve isso. Ele é uma função que roda em cada valor da coluna-chave antes de comparar, e devolve uma de três coisas:

| Devolve                        | Significa                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `{ key: "abc" }`               | "A chave limpa é `abc`". Linhas com a mesma `key` são unificadas                                                    |
| `{ key: "0042", group: "AB" }` | Igual ao de cima, mas com uma categoria. Linhas de categorias diferentes **nunca** se juntam, mesmo com `key` igual |
| `null`                         | "Esse valor não serve como chave" (rejeitada)                                                                       |

Valor vazio (`null`, texto vazio ou só espaços) nunca chega no normalizador. Ele vai direto pro grupo de linhas sem chave.

Linhas rejeitadas (`null`) também viram "sem chave": cada uma fica isolada, nunca se junta com outra, e vai pro fim da planilha com o rótulo de `mergeRejectedKeyLabel`.

Importante: a chave normalizada só serve pra comparar. O valor que aparece na planilha continua sendo o da primeira linha do grupo, sem alteração.

### Como ativar um normalizador

No `config.json`, coloque o nome dele em `mergeKeyNormalizer`:

```json
{
    "mode": "merge",
    "mergeKeyColumn": "email",
    "mergeKeyNormalizer": "lowercase",
    "mergeColumns": [{ "column": "nome", "strategy": "concat" }]
}
```

Sem `mergeKeyNormalizer`, o projeto usa o `trim` (só tira espaços das pontas).

Exemplo do que acontece com esse config:

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

Cada um deles serve pra situações como:

- `lowercase`: e-mails, usernames, qualquer texto que muda de maiúscula pra minúscula.
- `digitsOnly`: telefones e códigos numéricos escritos com pontos, traços e parênteses.
- `alphanumeric`: códigos de produto que aparecem como `AB-0042`, `ab 0042` e `AB0042`.

### Criando o seu próprio normalizador

Se nenhum dos prontos resolve o seu caso, você escreve um. É só uma função. Vamos fazer um passo a passo com um exemplo: códigos de produto no formato `letras + números`, que às vezes vêm com hífen, espaço ou minúsculas (`ab-0042`, `AB 0042`, `AB0042`). Queremos que `AB0042` e `CD0042` **não** sejam juntados, porque são produtos de linhas diferentes.

**Passo 1. Crie um arquivo.** Sugestão: `local/meusNormalizers.ts`. A pasta `local/` está no `.gitignore`, então o que você colocar lá fica só no seu computador e não vai pro GitHub.

**Passo 2. Escreva a função.**

```ts
import { KeyNormalizer } from "../src/filters/keyNormalizers";

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

O que cada parte faz:

- `raw` é o valor que veio do banco. Pode ser texto ou número, por isso o `String(raw)`.
- `toUpperCase().replace(...)` deixa tudo maiúsculo e tira tudo que não é letra ou número.
- `match(...)` separa as letras (`partes[1]`) dos números (`partes[2]`). Se o formato não bate, devolvemos `null` e a linha vai pro grupo de rejeitadas.
- `key` são os números e `group` são as letras. Assim `AB0042` e `CD0042` têm a mesma `key`, mas grupos diferentes, e não se juntam.
- O `?? ""` existe porque o `tsconfig` do projeto liga o `noUncheckedIndexedAccess`, e o TypeScript trata `partes[1]` como "pode ser `undefined`".
- A última linha é obrigatória: o arquivo precisa exportar um objeto chamado `normalizers`. O nome de cada propriedade é o nome que você vai usar no `config.json`. Você pode colocar vários normalizadores no mesmo arquivo.

**Passo 3. Avise o projeto que esse arquivo existe.** No `config.json`:

```json
{
    "normalizerModules": ["./local/meusNormalizers.ts"],
    "mergeKeyNormalizer": "codigoProduto"
}
```

O caminho é relativo à pasta de onde você roda o `npm start`. O arquivo pode ser `.ts` (funciona com `npm start`, que usa o `tsx`), `.js` ou `.cjs`. Se for `.js`/`.cjs`, exporte com `module.exports = { normalizers: { codigoProduto } }`.

**Passo 4. Teste.** Crie `local/meusNormalizers.test.ts`. O `npm test` também roda os testes dessa pasta.

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

**Passo 5. Rode** com `npm start`. Se o nome em `mergeKeyNormalizer` não existir, o erro mostra a lista dos disponíveis.

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

Quando o normalizador devolve um `group`, cada coluna do `mergeColumns` pode ter uma regra própria pra cada grupo, com o `byGroup`. Quem não tem regra usa a `strategy` normal da coluna.

Exemplo com o normalizador `codigoProduto` do guia acima (o `group` são as letras do código). Queremos que os produtos `AB` fiquem em `cor`, `cor_2`, `cor_3`, e que os produtos `CD` tenham todas as cores juntas numa coluna só:

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

Como funciona:

- A chave de `byGroup` (`"CD"`) é o `group` que o normalizador devolve. Maiúscula e minúscula fazem diferença.
- `strategy` aceita as mesmas três da coluna: `concat`, `overwrite` e `extra-column`.
- `into` é opcional. Com ele, o valor vai pra uma coluna nova e a coluna original fica vazia nessas linhas. Sem ele, o valor continua na coluna original.
- `separator` é opcional e vale só pro `concat`.
- A regra também vale pra linhas que ficaram sozinhas no grupo, pra que todas as linhas do mesmo grupo fiquem no mesmo formato.

### Cuidados

- A função não deve alterar nada fora dela nem depender de coisas externas. Dado o mesmo valor, tem que devolver sempre o mesmo resultado.
- Na dúvida, devolva `null`. É melhor um valor esquisito ir pro fim da planilha, rotulado, do que ser unido com a pessoa errada.
- Dois normalizadores com o mesmo nome dão erro. Isso vale também pros nomes dos prontos.
- Se o `normalizerModules` apontar pra um arquivo que não existe, ou que não exporta `normalizers`, o erro diz qual arquivo é o problema.

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

| Comando                   | O que faz                                                          |
| ------------------------- | ------------------------------------------------------------------ |
| `npm test`                | Testes unitários (Vitest), sem precisar de banco ou planilha reais |
| `npm run test:config`     | Carrega e valida o `config.json`                                   |
| `npm run test:connection` | Conecta no banco real e mostra as 3 primeiras linhas               |
| `npm run test:sheet`      | Escreve duas linhas de teste numa planilha real                    |

## Estrutura

```text
src/
  cli.ts              # parsing de argumentos (--config, --mode)
  config.ts           # schema Zod + carregamento de config (JSON + .env)
  db.ts               # conexão MySQL, leitura paginada, retry com backoff
  env.ts              # helpers de variável de ambiente
  sheets.ts           # autenticação e escrita no Google Sheets
  index.ts            # entrypoint: liga leitura → preparação → filtro → escrita
  filters/
    types.ts          # interface Filter<T>
    fillEmpty.ts      # preenche célula vazia (fillEmpty)
    combine.ts        # junta colunas da mesma linha (combineColumns)
    dedupe.ts         # implementação do filtro de dedupe
    merge.ts          # implementação do filtro de merge
    mergeTypes.ts     # tipos de config do merge
    keyNormalizers.ts # registry de normalizadores de chave
    normalizers/      # normalizadores prontos e carregador de módulos externos
  tests/              # testes unitários (Vitest)
local/                # (ignorada pelo git) seus normalizadores e testes pessoais
scripts/              # scripts manuais de smoke test (banco, config, sheets)
```

## Ainda falta

- Validação de dados (ex: formato de campos) e separação de linhas válidas/inválidas em abas diferentes
- Pipeline de filtros configurável (hoje os modos são um switch fixo no `index.ts`)
- Build de produção (hoje roda tudo via `tsx`)
