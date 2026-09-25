<p align="center">
  <a href="../README.md"><img src="https://img.shields.io/badge/In%C3%ADcio-475569?style=for-the-badge" alt="Início"></a>
  <a href="gestores.md"><img src="https://img.shields.io/badge/Para%20gestores-2563EB?style=for-the-badge" alt="Guia para gestores"></a>
  <a href="devs.md"><img src="https://img.shields.io/badge/Para%20devs-16181D?style=for-the-badge" alt="Guia para devs"></a>
</p>

[Guia para devs](devs.md) › Fontes e destinos

# Fontes e destinos

O ETL lê de um lugar (`source`) e escreve em outro (`destination`). Por enquanto dá pra ler de MySQL, Google Sheets, Excel, CSV e JSON e escrever no Google Sheets, no Excel, em CSV e em JSON, misturando do jeito que quiser.

```json
{
    "source": { "type": "csv", "path": "./dados/alunos.csv" },
    "destination": {
        "type": "sheets",
        "spreadsheetId": "...",
        "credentialsPath": "./credentials.json"
    }
}
```

Por dentro, tudo vira a mesma coisa: uma lista de linhas, e cada linha é um objeto `{ coluna: valor }`. Os filtros (fillEmpty, validation, merge...) só entendem isso, então nem sabem de onde o dado veio. Cada formato tem uma pecinha que converte do formato dela pra essa lista, ou o contrário. Descobri depois que isso tem nome, é o padrão Adapter, e é por causa dele que dá pra colocar formato novo sem mexer no resto.

## Fontes (`source`)

| `type`   | Campos                                                  | Observações                                                                                                                                  |
| -------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `mysql`  | `host`, `port`, `user`, `password`, `database`, `table` | Todos opcionais: o que faltar vem das variáveis do `.env` ou dos campos antigos (`dbHost`, `tableName`...)                                   |
| `csv`    | `path`, `delimiter?`, `encoding?`                       | Sem `delimiter` ele descobre sozinho (`,`, `;`, tab ou `\|`). `encoding` é `"utf-8"` (padrão) ou `"latin1"`                                  |
| `json`   | `path`, `recordsPath?`                                  | O arquivo tem que ser uma lista de objetos. Se a lista tá dentro de outras chaves, usa `recordsPath` tipo `"dados.alunos"`                   |
| `excel`  | `path`, `sheet?`                                        | Arquivo `.xlsx`. Sem `sheet`, ele lê a primeira aba. A primeira linha tem que ser o cabeçalho                                                |
| `sheets` | `spreadsheetId`, `sheet?`, `credentialsPath?`           | Uma planilha do Google. Sem `sheet`, lê a primeira aba. Sem `credentialsPath`, usa o mesmo das outras configs                                |
| `custom` | `adapter`, `options?`                                   | Um adapter seu, carregado pelo `adapterModules`. Veja [E se o meu formato não tá aqui?](fontes-e-destinos.md#e-se-o-meu-formato-não-tá-aqui) |

Umas coisas que eu aprendi apanhando:

- o Excel em português salva CSV com `;` e não com `,`, por isso ele descobre o separador sozinho
- CSV exportado de sistema antigo às vezes vem em `latin1`. Se os acentos aparecerem tipo `JoÃ£o`, coloca `"encoding": "latin1"`
- no CSV, célula vazia vira vazio de verdade (igual o `null` do banco), então o `required` e o `fillEmpty` funcionam do mesmo jeito
- no JSON, objeto dentro de objeto vira coluna com ponto e lista simples vira texto separado por vírgula

Um exemplo com JSON, usando `"recordsPath": "dados.alunos"`. Esse arquivo:

```json
{
    "dados": {
        "alunos": [
            {
                "nome": "Lia",
                "matricula": 42,
                "endereco": {
                    "cidade": "Pelotas",
                    "bairro": "Centro"
                },
                "instrumentos": ["violão", "ukulele"]
            },
            {
                "nome": "Theo",
                "matricula": 51,
                "endereco": {
                    "cidade": "Rio Grande",
                    "bairro": null
                },
                "instrumentos": ["bateria"]
            }
        ]
    }
}
```

fica assim:

| nome | matricula | endereco.cidade | endereco.bairro | instrumentos    |
| ---- | --------- | --------------- | --------------- | --------------- |
| Lia  | 42        | Pelotas         | Centro          | violão, ukulele |
| Theo | 51        | Rio Grande      |                 | bateria         |

## Destinos (`destination`)

| `type`   | Campos                                       | A aba de pendências vira                                                                         |
| -------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `sheets` | `spreadsheetId`, `credentialsPath`, `sheet?` | outra aba na mesma planilha (a principal é a primeira aba, ou a que você colocar em `sheet`)     |
| `csv`    | `path`, `delimiter?`, `bom?`                 | outro arquivo do lado: `resultado.csv` → `resultado.pendencias.csv`                              |
| `json`   | `path`                                       | outro arquivo do lado: `resultado.json` → `resultado.pendencias.json`                            |
| `excel`  | `path`, `sheet?`                             | outra aba no mesmo arquivo (a principal se chama `Dados`, ou o nome que você colocar em `sheet`) |
| `custom` | `adapter`, `options?`                        | o seu adapter recebe `{ name: "Pendências" }` no `write` e decide                                |

O CSV sai com vírgula. Se for abrir no Excel em português, coloca `"delimiter": ";"`. Ele também sai com um caractere invisível no começo (o `bom`, que já vem ligado) pro Excel mostrar os acentos certo. Se o arquivo for pra outro programa e ele reclamar desse caractere, coloca `"bom": false`. E se a pasta do arquivo não existir, ele cria.

Pra ler do Google Sheets, a planilha de origem também tem que estar compartilhada com o e-mail da service account (pode ser só como Leitor). Os números chegam como número e as datas chegam do jeito que aparecem na planilha.

A planilha de onde ele lê nunca é alterada, ele só escreve no destino. O jeito mais seguro é usar outra planilha pro destino e compartilhar a original só como Leitor, aí nem o Google deixa mexer nela.

Se quiser ler e escrever na mesma planilha, dá, mas precisa dizer as abas: `sheet` na fonte com a aba dos dados originais e `sheet` no destino com a aba do resultado. As duas (e a de pendências) têm que ter nomes diferentes. Se faltar alguma coisa ou algum nome bater, ele avisa e nem começa. O mesmo vale pra arquivo: a fonte e o destino não podem ser o mesmo arquivo.

Sobre o Excel, umas coisas que acontecem por baixo:

- célula com fórmula vira o valor calculado, não a fórmula
- data vira texto no formato `2024-03-10` (ou com a hora junto, se tiver hora)
- texto com negrito, cor ou link vira texto normal
- linha totalmente vazia é pulada
- na saída o arquivo é recriado toda vez que roda, então não guarda coisa sua dentro dele. O cabeçalho sai em negrito e fixo, e a largura das colunas se ajusta sozinha
- o Excel não aceita alguns caracteres em nome de aba (tipo `/` e `:`) nem nome com mais de 31 letras, então ele arruma isso sozinho

## E a config antiga?

Continua funcionando igual. Sem `source`, ele usa `dbHost`, `dbUser`, `tableName`... como MySQL, e sem `destination` usa `spreadsheetId` e `credentialsPath` como Google Sheets. O `.env` continua valendo mais que o `config.json` nos dois jeitos.

## E se o meu formato não tá aqui?

Dá pra escrever o seu próprio adapter sem mexer no código do projeto, do mesmo jeitinho que os normalizadores. Por exemplo, uma fonte que lê um `.txt` com um valor por linha. Cria um arquivo, tipo `local/meusAdapters.cjs`:

```js
const fs = require("fs");

const linhasDeTexto = (options) => ({
    read: async () =>
        fs
            .readFileSync(options.path, "utf8")
            .split(/\r?\n/)
            .map((linha) => linha.trim())
            .filter((linha) => linha !== "")
            .map((linha) => ({ [options.column ?? "valor"]: linha })),
});

module.exports = { sources: { linhasDeTexto } };
```

E na config:

```json
{
    "adapterModules": ["./local/meusAdapters.cjs"],
    "source": {
        "type": "custom",
        "adapter": "linhasDeTexto",
        "options": { "path": "./alunos.txt", "column": "nome" }
    }
}
```

O que precisa saber:

- o arquivo exporta `sources` (fontes), `sinks` (destinos) ou os dois. O nome de cada um é o que vai no `adapter` da config
- cada um é uma função que recebe o `options` da config e devolve um objeto. Fonte tem que ter `read()`, que devolve a lista de linhas. Destino tem que ter `write(rows, { name })`, e o `name` vem preenchido quando é a saída de pendências
- pode ser `.ts` (funciona com `npm start`), `.js` ou `.cjs`
- se o nome não existir, ou se a função não devolver o objeto certo, ele avisa antes de começar
- a função também recebe um segundo parâmetro com o `logger`. Se quiser mostrar alguma mensagem do mesmo jeito que o resto do ETL, é só usar `context.logger.info("...")`

---

[← Configuração](configuracao.md) · [Exemplos →](exemplos.md)

<p align="center">
  <a href="../README.md"><img src="https://img.shields.io/badge/In%C3%ADcio-475569?style=for-the-badge" alt="Início"></a>
  <a href="gestores.md"><img src="https://img.shields.io/badge/Para%20gestores-2563EB?style=for-the-badge" alt="Guia para gestores"></a>
  <a href="devs.md"><img src="https://img.shields.io/badge/Para%20devs-16181D?style=for-the-badge" alt="Guia para devs"></a>
</p>
