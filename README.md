# ETL MySQL → Google Sheets

Um ETL em TypeScript que lê uma tabela (ou view) do MySQL, arruma os dados e joga numa planilha do Google Sheets.

Comecei ele só pra copiar uma tabela pra planilha, mas aí fui vendo que dado de verdade vem todo bagunçado: gente cadastrada duas vezes, e-mail com maiúscula num lugar e minúscula no outro, campo vazio, a mesma informação espalhada em várias colunas... Então fui adicionando coisas até dar pra resolver quase tudo só mexendo no `config.json`, sem precisar programar nada.

O que dá pra fazer hoje:

- tirar linhas repetidas (`dedupe`) ou juntar as linhas da mesma pessoa sem perder nada (`merge`)
- escolher o que acontece com cada coluna na hora de juntar
- usar normalizadores pra `Lia@Email.com` e ` lia@email.com` contarem como a mesma pessoa (tem uns prontos e dá pra criar o seu)
- ter regras diferentes dependendo do tipo da chave (tipo tratar artista solo de um jeito e banda de outro)
- decidir o que fazer com as linhas que não têm chave, sem elas sumirem nem se misturarem
- preencher células vazias e juntar colunas antes de tudo
- espalhar valores em várias colunas sem jogar nenhum fora
- separar as linhas com problema numa aba de pendências, com o motivo escrito do lado

Se você quer ver funcionando antes de ler a configuração toda, pode pular direto pros [exemplos](#exemplos-do-mais-simples-ao-mais-completo).

## Sumário

- [Instalação](#instalação)
- [Configuração](#configuração)
- [Como os dados passam pelo ETL](#como-os-dados-passam-pelo-etl)
- [Exemplos, do mais simples ao mais completo](#exemplos-do-mais-simples-ao-mais-completo)
- [Preparando os dados](#preparando-os-dados)
- [Distribuir valores em várias colunas](#distribuir-valores-em-várias-colunas-distribute)
- [Separar as pendências](#separar-as-pendências-validation)
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
| `validation`     | `{ rules, pendingSheet?, reasonColumn? }`. Manda as linhas com problema pra uma aba separada. Veja [Separar as pendências](#separar-as-pendências-validation)      |

Quando um valor existe tanto no `.env` quanto no `config.json`, o `.env` tem prioridade.

## Como os dados passam pelo ETL

```text
banco (tabela ou view)
   │
   ├─ fillEmpty        preenche células vazias          (opcional)
   ├─ combineColumns   junta colunas da mesma linha      (opcional)
   ├─ validation       separa as linhas com problema     (opcional) ──► aba "Pendências"
   │
   ├─ modo (só com as linhas válidas)
   │    raw     escreve do jeito que veio
   │    dedupe  tira as linhas repetidas por uma coluna
   │    merge   junta as linhas com a mesma chave
   │
   ▼
primeira aba da planilha
```

### Modos

- **`raw`**: é o padrão. Escreve os dados do jeito que vieram do banco.
- **`dedupe`**: tira as linhas repetidas olhando uma coluna, e fica com a primeira ou a última (`dedupeStrategy`). A linha que sai, sai inteira.
- **`merge`**: junta as linhas que têm a mesma chave numa só, e cada coluna do `mergeColumns` diz como os valores vão ser juntados.

### Estratégias do merge

| `strategy`     | O que faz                                                                           | Com `cor` = azul, verde, azul fica |
| -------------- | ----------------------------------------------------------------------------------- | ---------------------------------- |
| `concat`       | Junta os valores diferentes numa célula, separados pelo `separator` (padrão `"; "`) | `azul; verde`                      |
| `overwrite`    | Fica com o último valor preenchido                                                  | `azul`                             |
| `extra-column` | O primeiro fica na coluna e os outros vão pra `<coluna>_2`, `<coluna>_3`...         | `azul`, `verde`, `azul`            |

O `concat` também aceita o `distribute`, que espalha os valores em colunas (tem exemplo lá embaixo). E nas três, célula vazia é ignorada.

## Exemplos, do mais simples ao mais completo

Os exemplos usam uma escola de música e um festival inventados. Em cada um eu mostro só a parte do `config.json` que importa pra ele, o resto (banco, planilha) continua igual ao seu.

As tabelas de saída não foram escritas na mão, elas saíram rodando o ETL de verdade com essas configs. Então é exatamente isso que vai aparecer na planilha.

### 1. Só copiar (`raw`)

O mais básico. Nada é tratado.

```json
{ "mode": "raw" }
```

| id  | nome | email            |
| --- | ---- | ---------------- |
| 1   | Lia  | `lia@email.com`  |
| 2   | Theo | `theo@email.com` |
| 3   | Lia  | `lia@email.com`  |

A Lia tá duas vezes. Os próximos exemplos resolvem isso de jeitos diferentes.

### 2. Tirar as repetidas (`dedupe`)

O ETL olha a coluna `email` e deixa uma linha só pra cada valor. Com `keep-last` ele fica com a última.

```json
{
    "mode": "dedupe",
    "dedupeColumn": "email",
    "dedupeStrategy": "keep-last"
}
```

Entrada:

| id  | nome        | email            | turma   |
| --- | ----------- | ---------------- | ------- |
| 1   | Lia         | `lia@email.com`  | segunda |
| 2   | Theo        | `theo@email.com` | quarta  |
| 3   | Lia Martins | `lia@email.com`  | sexta   |

Saída:

| id  | nome        | email            | turma  |
| --- | ----------- | ---------------- | ------ |
| 2   | Theo        | `theo@email.com` | quarta |
| 3   | Lia Martins | `lia@email.com`  | sexta  |

O que aconteceu:

- a primeira linha da Lia foi embora e ficou só a 3
- como é `keep-last`, a linha que fica vai pro lugar da última que apareceu, por isso o Theo subiu. Com `keep-first` (o padrão) a ordem não muda
- o `dedupe` joga a linha inteira fora, então a turma de segunda sumiu. Se isso for um problema, o `merge` do próximo exemplo resolve

### 3. Juntar sem perder nada (`merge`)

Aqui as linhas com a mesma chave viram uma só, e você escolhe o que acontece com cada coluna.

```json
{
    "mode": "merge",
    "mergeKeyColumn": "email",
    "mergeColumns": [
        { "column": "oficina", "strategy": "concat", "separator": ", " },
        { "column": "plano", "strategy": "overwrite" },
        { "column": "instrumento", "strategy": "extra-column" }
    ]
}
```

Entrada:

| email            | oficina | plano      | instrumento |
| ---------------- | ------- | ---------- | ----------- |
| `lia@email.com`  | Violão  | mensal     | violão      |
| `lia@email.com`  | Canto   | trimestral | voz         |
| `lia@email.com`  | Violão  |            |             |
| `theo@email.com` | Bateria | mensal     | bateria     |

Saída:

| email            | oficina       | plano      | instrumento | instrumento_2 |
| ---------------- | ------------- | ---------- | ----------- | ------------- |
| `lia@email.com`  | Violão, Canto | trimestral | violão      | voz           |
| `theo@email.com` | Bateria       | mensal     | bateria     |               |

O que aconteceu:

- `concat` juntou as oficinas numa célula. O "Violão" repetido aparece uma vez só
- `overwrite` ficou com o último plano preenchido. A terceira linha tava sem plano, então valeu o "trimestral"
- `extra-column` abriu a `instrumento_2`. Se tivesse um terceiro ia pra `instrumento_3`, e por aí vai
- as colunas que não estão no `mergeColumns` ficam com o valor da primeira linha

### 4. Mesma chave escrita diferente (normalizador pronto)

Esses três e-mails são da mesma pessoa, mas sem normalizador o ETL acha que são três pessoas.

```json
{
    "mode": "merge",
    "mergeKeyColumn": "email",
    "mergeKeyNormalizer": "lowercase",
    "mergeColumns": [
        { "column": "oficina", "strategy": "concat", "separator": ", " }
    ]
}
```

Entrada:

| email            | oficina |
| ---------------- | ------- |
| `Lia@Email.com`  | Violão  |
| ` lia@email.com` | Canto   |
| `LIA@EMAIL.COM ` | Ukulele |

Saída:

| email           | oficina                |
| --------------- | ---------------------- |
| `Lia@Email.com` | Violão, Canto, Ukulele |

O `lowercase` tira os espaços e deixa tudo minúsculo só na hora de comparar. Na planilha o e-mail continua como veio na primeira linha. Tem outros prontos e dá pra criar o seu, tá tudo em [Normalizadores de chave](#normalizadores-de-chave).

### 5. Linhas sem chave (jeito padrão)

E se a chave tá vazia ou não serve? Aqui a chave é a matrícula, e o `digitsOnly` deixa só os números dela.

```json
{
    "mode": "merge",
    "mergeKeyColumn": "matricula",
    "mergeKeyNormalizer": "digitsOnly",
    "mergeEmptyKeyLabel": "sem matrícula",
    "mergeRejectedKeyLabel": "matrícula inválida",
    "mergeColumns": [
        { "column": "nome", "strategy": "extra-column" },
        { "column": "oficina", "strategy": "concat", "separator": " | " }
    ]
}
```

Entrada:

| matricula | nome        | oficina |
| --------- | ----------- | ------- |
| 2024-0042 | Lia         | Violão  |
| 20240042  | Lia Martins | Canto   |
|           | Nina        | Piano   |
|           | Caio        | Bateria |
| pendente  | Duda        | Flauta  |

Saída:

| matricula          | nome | nome_2      | oficina         |
| ------------------ | ---- | ----------- | --------------- |
| 2024-0042          | Lia  | Lia Martins | Violão \| Canto |
| sem matrícula      | Nina |             | Piano           |
| sem matrícula      | Caio |             | Bateria         |
| matrícula inválida | Duda |             | Flauta          |

O que aconteceu:

- `2024-0042` e `20240042` viraram a mesma chave, então a Lia foi juntada
- Nina e Caio não têm matrícula. Eles nunca são juntados entre si (podem ser pessoas diferentes), vão pro fim da planilha, um por linha, com o rótulo `sem matrícula`
- o `pendente` da Duda não tem nenhum número, então o `digitsOnly` rejeitou e ela foi pro fim com o rótulo `matrícula inválida`

### 6. Linhas sem chave resumidas (`unkeyed`)

Mesma entrada do exemplo 5, só que agora quem não tem chave é resumido numa linha.

```json
"mergeColumns": [
  {
    "column": "nome",
    "strategy": "extra-column",
    "unkeyed": { "strategy": "collapse-column", "into": "Nomes sem matrícula", "separator": " | " }
  },
  {
    "column": "oficina",
    "strategy": "concat",
    "separator": " | ",
    "unkeyed": { "strategy": "collapse-column", "into": "Oficinas sem matrícula", "separator": " | " }
  }
]
```

Saída:

| matricula          | nome | nome_2      | oficina         | Nomes sem matrícula | Oficinas sem matrícula |
| ------------------ | ---- | ----------- | --------------- | ------------------- | ---------------------- |
| 2024-0042          | Lia  | Lia Martins | Violão \| Canto |                     |                        |
| sem matrícula      |      |             |                 | Nina \| Caio        | Piano \| Bateria       |
| matrícula inválida |      |             |                 | Duda                | Flauta                 |

Agora sobram no máximo duas linhas no fim: uma pra quem veio sem chave e outra pra quem teve a chave rejeitada. Só as colunas que têm `unkeyed` aparecem nelas, o resto fica de fora.

### 7. Arrumar antes de tudo (`fillEmpty` e `combineColumns`)

Essas duas rodam antes do modo, então funcionam até no `raw`. Aqui é a agenda das aulas.

```json
{
    "mode": "raw",
    "fillEmpty": [
        { "column": "hora", "default": "19:00" },
        {
            "column": "sala",
            "fallbackColumns": ["sala_reserva"],
            "default": "a definir"
        }
    ],
    "combineColumns": [{ "into": "quando", "columns": ["data", "hora"] }]
}
```

Entrada:

| aula    | data  | hora  | sala   | sala_reserva |
| ------- | ----- | ----- | ------ | ------------ |
| Violão  | 10/03 | 18:00 | Sala 1 | Sala 2       |
| Canto   | 12/03 |       |        | Sala 3       |
| Bateria |       | 20:00 |        |              |

Saída:

| aula    | quando      | sala      | sala_reserva |
| ------- | ----------- | --------- | ------------ |
| Violão  | 10/03 18:00 | Sala 1    | Sala 2       |
| Canto   | 12/03 19:00 | Sala 3    | Sala 3       |
| Bateria |             | a definir |              |

O que aconteceu:

- a aula de Canto tava sem hora, pegou o `19:00` do `default` e aí deu pra montar o `quando`
- a sala vazia do Canto puxou a `sala_reserva`. A da Bateria não tinha nem reserva, então ficou `a definir`
- a Bateria tá sem data, então o `quando` dela ficou vazio em vez de sair só `20:00` pela metade
- `data` e `hora` sumiram e o `quando` apareceu no lugar delas

### 8. Um valor em cada coluna (`distribute`)

Em vez de juntar tudo numa célula, o `distribute` coloca cada valor numa coluna. E com o `sources` dá pra várias colunas entrarem na mesma lista.

```json
{
    "mode": "merge",
    "mergeKeyColumn": "email",
    "mergeColumns": [
        {
            "column": "instrumento 1",
            "strategy": "concat",
            "separator": " | ",
            "distribute": {
                "columns": ["instrumento 1", "instrumento 2"],
                "sources": ["instrumento 2"],
                "overflowInto": "outros instrumentos"
            }
        }
    ]
}
```

Entrada:

| email            | instrumento 1 | instrumento 2 |
| ---------------- | ------------- | ------------- |
| `lia@email.com`  | violão        | ukulele       |
| `lia@email.com`  | violão        | piano         |
| `lia@email.com`  | voz           |               |
| `theo@email.com` |               | bateria       |

Saída:

| email            | instrumento 1 | instrumento 2 | outros instrumentos |
| ---------------- | ------------- | ------------- | ------------------- |
| `lia@email.com`  | violão        | ukulele       | piano \| voz        |
| `theo@email.com` | bateria       |               |                     |

O que aconteceu:

- a Lia tinha 5 instrumentos nas duas colunas, com um repetido. Sobraram 4 diferentes, 2 foram pras colunas e os outros 2 pro `outros instrumentos`. Nenhum se perdeu
- o Theo só tinha coisa no `instrumento 2`, mas subiu pro `instrumento 1`. A planilha sempre vai sendo preenchida da esquerda pra direita

Se você não colocar `overflowInto`, o ETL cria a coluna da sobra sozinho:

```json
{
    "column": "cor",
    "strategy": "concat",
    "distribute": { "columns": ["cor_principal"] }
}
```

Entrada:

| produto            | cor    |
| ------------------ | ------ |
| Camiseta da escola | preta  |
| Camiseta da escola | branca |
| Camiseta da escola | vinho  |

Saída:

| produto            | cor_principal | cor_overflow  |
| ------------------ | ------------- | ------------- |
| Camiseta da escola | preta         | branca; vinho |

### 9. Regra diferente pra cada tipo de chave (`byGroup`)

Esse usa o normalizador `codigoProduto` do guia [Criando o seu próprio normalizador](#criando-o-seu-próprio-normalizador), que separa as letras do código como `group`. Os produtos `AB` ficam com uma cor por coluna, e os `CD` ficam com as cores juntas numa coluna só deles.

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

- `ab-0042` e `AB 0042` são o mesmo produto e viraram uma linha com `cor` e `cor_2`
- o `CD0042` tem os mesmos números, mas é de outro grupo, então nunca junta com o `AB`. As cores dele foram pra `Cores CD`
- o `XYZ` não tem o formato certo, o normalizador rejeitou e ele foi pro fim com o rótulo padrão

### 10. Tudo junto: inscrições de um festival

Esse é o exemplo que eu gosto de mostrar. Um festival recebe inscrição de artista solo e de banda na mesma planilha:

- artista solo se inscreve com e-mail, e às vezes o mesmo artista se inscreve duas vezes
- banda se inscreve com uma tag (`#nomedabanda`), e cada integrante manda a sua inscrição
- tem gente que não informou o palco
- e tem inscrição sem identificação ou com identificação que não vale

Primeiro um normalizador que sabe separar solo de banda (em `local/inscrito.ts`):

```ts
import { KeyNormalizer } from "../src/filters/keyNormalizers";

const inscrito: KeyNormalizer = (raw) => {
    const texto = String(raw).trim().toLowerCase();

    if (texto.includes("@")) return { key: texto, group: "solo" };
    if (texto.startsWith("#"))
        return { key: texto.replace(/[^a-z0-9]/g, ""), group: "banda" };

    return null;
};

export const normalizers = { inscrito };
```

Aí o config:

```json
{
    "mode": "merge",
    "mergeKeyColumn": "Identificação",
    "normalizerModules": ["./local/inscrito.ts"],
    "mergeKeyNormalizer": "inscrito",
    "mergeEmptyKeyLabel": "sem identificação",
    "mergeRejectedKeyLabel": "identificação inválida",
    "fillEmpty": [
        {
            "column": "Palco",
            "fallbackColumns": ["Palco preferido"],
            "default": "a definir"
        }
    ],
    "mergeColumns": [
        { "column": "Inscrição", "strategy": "concat", "separator": " | " },
        {
            "column": "Nome",
            "strategy": "extra-column",
            "byGroup": {
                "banda": {
                    "strategy": "concat",
                    "into": "Integrantes",
                    "separator": " | "
                }
            },
            "unkeyed": {
                "strategy": "collapse-column",
                "into": "Nomes sem identificação",
                "separator": " | "
            }
        },
        {
            "column": "Estilo 1",
            "strategy": "concat",
            "separator": " | ",
            "distribute": {
                "columns": ["Estilo 1", "Estilo 2"],
                "sources": ["Estilo 2"],
                "overflowInto": "Outros estilos"
            }
        },
        { "column": "Palco", "strategy": "concat", "separator": " | " },
        { "column": "Confirmado", "strategy": "overwrite" }
    ]
}
```

Entrada:

| Inscrição | Nome        | Identificação    | Estilo 1 | Estilo 2 | Palco   | Palco preferido | Confirmado |
| --------- | ----------- | ---------------- | -------- | -------- | ------- | --------------- | ---------- |
| 1         | Lia Martins | `lia@email.com`  | MPB      | Folk     | Palco A |                 | sim        |
| 2         | Lia M.      | ` LIA@email.com` | Folk     | Indie    |         | Palco A         | não        |
| 3         | Rafa        | #Os Vagalumes    | Rock     |          |         | Palco B         | sim        |
| 4         | Duda        | #osvagalumes     | Rock     | Punk     | Palco B |                 | sim        |
| 5         | Theo        | `theo@email.com` | Jazz     |          |         |                 | sim        |
| 6         | Nina        |                  | Samba    |          | Palco A |                 | sim        |
| 7         | Caio        | caio             | Rap      |          |         |                 | não        |

Saída:

| Inscrição | Nome        | Nome_2 | Identificação          | Estilo 1 | Estilo 2 | Palco     | Palco preferido | Confirmado | Outros estilos | Integrantes  | Nomes sem identificação |
| --------- | ----------- | ------ | ---------------------- | -------- | -------- | --------- | --------------- | ---------- | -------------- | ------------ | ----------------------- |
| 1 \| 2    | Lia Martins | Lia M. | `lia@email.com`        | MPB      | Folk     | Palco A   |                 | não        | Indie          |              |                         |
| 3 \| 4    |             |        | #Os Vagalumes          | Rock     | Punk     | Palco B   | Palco B         | sim        |                | Rafa \| Duda |                         |
| 5         | Theo        |        | `theo@email.com`       | Jazz     |          | a definir |                 | sim        |                |              |                         |
|           |             |        | sem identificação      |          |          |           |                 |            |                |              | Nina                    |
|           |             |        | identificação inválida |          |          |           |                 |            |                |              | Caio                    |

O que aconteceu, por partes:

1. **`fillEmpty`**: quem tava sem palco pegou o `Palco preferido`, e quem não tinha nenhum dos dois ficou com `a definir` (foi o caso do Theo)
2. **normalizador**: `lia@email.com` e ` LIA@email.com` viraram a mesma chave no grupo `solo`. `#Os Vagalumes` e `#osvagalumes` viraram a mesma no grupo `banda`. O `caio` não é e-mail nem tag, então foi rejeitado
3. **`Inscrição`**: os números das inscrições juntadas ficaram lado a lado (`1 | 2`), assim dá pra achar as originais
4. **`Nome`**: pra artista solo cada nome vai numa coluna (`Nome`, `Nome_2`). Pra banda, o `byGroup` juntou os integrantes em `Integrantes`
5. **estilos**: os estilos da Lia (MPB, Folk, Folk, Indie) viraram três diferentes, dois foram pras colunas e o que sobrou foi pro `Outros estilos`
6. **`Confirmado`**: o `overwrite` ficou com o último valor, então se a inscrição mais nova diz "não", vale o "não"
7. **sem chave**: a Nina (sem identificação) e o Caio (identificação inválida) foram pro fim, cada um com seu rótulo

## Preparando os dados

Antes do modo (`raw`, `dedupe` ou `merge`) rodar, dá pra arrumar as linhas com duas etapas opcionais. Elas rodam nessa ordem: primeiro o `fillEmpty`, depois o `combineColumns`. Tem as duas funcionando juntas no [exemplo 7](#7-arrumar-antes-de-tudo-fillempty-e-combinecolumns).

### Preencher vazios (`fillEmpty`)

Serve pra quando uma coluna vem vazia e dá pra usar o valor de outra no lugar, ou um texto padrão.

```json
"fillEmpty": [
  { "column": "hora", "default": "19:00" },
  { "column": "sala", "fallbackColumns": ["sala_reserva", "sala_antiga"], "default": "a definir" }
]
```

Como funciona:

- se a célula já tem valor, nada muda
- se tá vazia, ele procura nas `fallbackColumns`, na ordem, e usa a primeira que tiver alguma coisa
- se nenhuma tiver, usa o `default`. Sem `default`, a célula fica do jeito que veio
- conta como vazio: `null`, texto vazio ou só espaço
- as regras sempre olham a linha do jeito que veio do banco. Então se uma regra usa como reserva uma coluna que outra regra preenche, ela vê o valor original, e não o preenchido. Isso é de propósito, assim a ordem das regras não muda o resultado

### Juntar colunas (`combineColumns`)

Serve pra transformar várias colunas da mesma linha numa só.

```json
"combineColumns": [
  { "into": "nome completo", "columns": ["nome", "sobrenome"], "separator": " " }
]
```

Entrada:

| nome | sobrenome |
| ---- | --------- |
| Lia  | Martins   |
| Theo |           |

Saída:

| nome completo |
| ------------- |
| Lia Martins   |
|               |

Como funciona:

- os valores são juntados na ordem de `columns`, com o `separator` (se não colocar, é um espaço)
- se alguma coluna tiver vazia o resultado fica vazio, pra não sair valor pela metade (por isso o Theo ficou sem). Se quiser evitar isso, usa o `fillEmpty` antes
- as colunas de origem somem da planilha, a não ser que você coloque `"keepSources": true`
- a coluna nova aparece no lugar da primeira coluna de origem, e não lá no fim

## Distribuir valores em várias colunas (`distribute`)

No `merge`, o `concat` normalmente junta tudo numa célula (`"violão; piano; voz"`). Com o `distribute`, cada valor vai pra uma coluna. Tem exemplo completo no [exemplo 8](#8-um-valor-em-cada-coluna-distribute).

| Campo          | O que faz                                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------- |
| `columns`      | As colunas de destino, em ordem. Cada valor diferente vai pra uma                                                     |
| `sources`      | Opcional. Outras colunas que entram na mesma lista junto com a `column`                                               |
| `overflowInto` | Opcional. Coluna pro que sobrar quando tem mais valor que coluna. Sem ele, o ETL cria uma `<column>_overflow` sozinho |

Algumas coisas que é bom saber:

- valor repetido aparece uma vez só
- nenhum valor é jogado fora. O que não cabe vai pro overflow, separado pelo `separator`
- as colunas de `column` e `sources` que não são destino somem da planilha
- coluna de destino que não recebe nada fica vazia, ela não guarda valor velho de outra linha
- vale também pra linha que ficou sozinha no grupo, pra planilha sair com as mesmas colunas em todas as linhas
- só funciona com `strategy: "concat"`. Dá pra usar dentro do `byGroup`, mas não junto com o `into`, porque quem decide as colunas aí é o `distribute`. Se configurar errado, a validação avisa antes de rodar

## Separar as pendências (`validation`)

Às vezes não dá pra consertar tudo automaticamente, tipo um e-mail escrito errado ou um campo obrigatório vazio. Pra isso tem o `validation`: você diz as regras, e as linhas que não passam vão pra uma aba separada com o motivo escrito do lado. Aí fica fácil de alguém olhar e corrigir no sistema.

```json
"validation": {
  "pendingSheet": "Pendências",
  "reasonColumn": "Motivo",
  "rules": [
    { "column": "nome", "rule": "required" },
    { "column": "email", "rule": "pattern", "pattern": "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", "message": "e-mail fora do formato" },
    { "column": "plano", "rule": "oneOf", "values": ["mensal", "trimestral", "anual"], "ignoreCase": true },
    { "column": "matricula", "rule": "normalizer", "normalizer": "digitsOnly", "message": "matrícula sem número" }
  ]
}
```

Entrada:

| matricula | nome | email            | plano      |
| --------- | ---- | ---------------- | ---------- |
| 2024-0042 | Lia  | `lia@email.com`  | Mensal     |
| 2024-0051 | Theo | theo.email.com   | anual      |
| pendente  |      | `nina@email.com` | semanal    |
| 2024-0060 | Caio |                  | trimestral |

Na primeira aba (e só essas seguem pro modo):

| matricula | nome | email           | plano      |
| --------- | ---- | --------------- | ---------- |
| 2024-0042 | Lia  | `lia@email.com` | Mensal     |
| 2024-0060 | Caio |                 | trimestral |

Na aba `Pendências`:

| Motivo                                                          | matricula | nome | email            | plano   |
| --------------------------------------------------------------- | --------- | ---- | ---------------- | ------- |
| e-mail fora do formato                                          | 2024-0051 | Theo | theo.email.com   | anual   |
| nome vazio; plano com valor não permitido; matrícula sem número | pendente  |      | `nina@email.com` | semanal |

As regras que dá pra usar:

| `rule`       | Passa quando                         | Campos extras                                                                                                     |
| ------------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `required`   | a célula não tá vazia                | nenhum                                                                                                            |
| `pattern`    | o valor bate com a expressão regular | `pattern` e `flags` (opcional, tipo `"i"` pra ignorar maiúscula)                                                  |
| `oneOf`      | o valor tá na lista                  | `values` e `ignoreCase` (opcional)                                                                                |
| `normalizer` | o normalizador não devolve `null`    | `normalizer`: o nome de um normalizador, pronto ou seu (veja [Normalizadores de chave](#normalizadores-de-chave)) |

Algumas coisas que é bom saber:

- toda regra aceita um `message` pra trocar o texto do motivo. Sem ele, o motivo sai tipo `nome vazio` ou `plano com valor não permitido`
- só o `required` reclama de célula vazia. As outras regras deixam a célula vazia passar, foi por isso que o Caio sem e-mail passou. Se o campo for obrigatório **e** tiver formato, coloca as duas regras na mesma coluna
- se a linha falha em mais de uma regra, os motivos aparecem juntos, separados por `; `
- o `normalizer` é bem útil pra reaproveitar o normalizador do merge. Se ele rejeita a chave, a linha vai pras pendências inteirinha, em vez de ir pro fim da planilha só com o rótulo
- a validação roda depois do `fillEmpty` e do `combineColumns`, então um valor que o `fillEmpty` preencheu já conta como preenchido
- `pendingSheet` (padrão `Pendências`) é o nome da aba. Se ela não existir, o ETL cria sozinho
- `reasonColumn` (padrão `Motivo`) é o nome da coluna com o motivo, que sempre fica na primeira coluna
- se não tiver nenhuma pendência, a aba fica vazia (ela é limpa do mesmo jeito, pra não sobrar pendência antiga)
- se o `pattern` tiver uma regex inválida, ou o `normalizer` não existir, o ETL avisa antes de ler o banco

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

Importante: a cada rodada o ETL **limpa a aba antes de escrever** (a primeira aba e, se tiver `validation`, a de pendências). Assim não sobra linha velha de uma rodada anterior. Então não coloca anotação sua nessas abas, usa outra aba pra isso.

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
    validate.ts       # separa as linhas com problema (validation)
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

- Pipeline de filtros configurável (hoje os modos são um switch fixo no `index.ts`)
- Build de produção (hoje roda tudo via `tsx`)
