<p align="center">
  <a href="../README.md"><img src="https://img.shields.io/badge/In%C3%ADcio-475569?style=for-the-badge" alt="Início"></a>
  <a href="gestores.md"><img src="https://img.shields.io/badge/Para%20gestores-2563EB?style=for-the-badge" alt="Guia para gestores"></a>
  <a href="devs.md"><img src="https://img.shields.io/badge/Para%20devs-16181D?style=for-the-badge" alt="Guia para devs"></a>
</p>

[Guia para devs](devs.md) › Preparação e pendências

# Preparação e pendências

Tudo que acontece com as linhas antes do modo rodar, e como separar as que têm problema.

## Preparando os dados

Antes do modo rodar dá pra arrumar as linhas com duas etapas opcionais, primeiro o `fillEmpty` e depois o `combineColumns`. As duas aparecem juntas no [exemplo 7](exemplos.md#7-arrumar-antes-de-tudo-fillempty-e-combinecolumns).

### Preencher vazios (`fillEmpty`)

Serve pra quando uma coluna vem vazia e dá pra usar o valor de outra no lugar, ou um texto padrão.

```json
"fillEmpty": [
  { "column": "hora", "default": "19:00" },
  { "column": "sala", "fallbackColumns": ["sala_reserva", "sala_antiga"], "default": "a definir" }
]
```

Se a célula já tem valor, nada muda. Se está vazia, ele procura nas `fallbackColumns` na ordem e usa a primeira que tiver alguma coisa. Se nenhuma tiver, usa o `default`, e sem `default` a célula fica como veio. Conta como vazio `null`, texto vazio ou só espaço.

Uma coisa que pode parecer estranha: as regras sempre olham a linha do jeito que veio do banco. Então se uma regra usa como reserva uma coluna que outra regra preencheu, ela vê o valor original. Fiz assim de propósito, pra ordem das regras não mudar o resultado.

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

Os valores são juntados na ordem de `columns`, com o `separator` (se não tiver, é um espaço). Se alguma coluna estiver vazia o resultado fica vazio, pra não sair valor pela metade, por isso o Theo ficou sem. Dá pra usar o `fillEmpty` antes se quiser evitar isso.

As colunas de origem somem da planilha, a não ser que tenha `"keepSources": true`, e a coluna nova aparece no lugar da primeira de origem em vez de ir lá pro fim.

## Distribuir valores em várias colunas (`distribute`)

No `merge`, o `concat` normalmente junta tudo numa célula (`"violão; piano; voz"`). Com o `distribute`, cada valor vai pra uma coluna. O [exemplo 8](exemplos.md#8-um-valor-em-cada-coluna-distribute) mostra ele funcionando.

| Campo          | O que faz                                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------- |
| `columns`      | As colunas de destino, em ordem. Cada valor diferente vai pra uma                                                     |
| `sources`      | Opcional. Outras colunas que entram na mesma lista junto com a `column`                                               |
| `overflowInto` | Opcional. Coluna pro que sobrar quando tem mais valor que coluna. Sem ele, o ETL cria uma `<column>_overflow` sozinho |

Valor repetido aparece uma vez só, e nenhum valor é jogado fora: o que não cabe vai pro overflow, separado pelo `separator`. As colunas de `column` e `sources` que não são destino somem da planilha, e coluna de destino que não recebe nada fica vazia (ela não guarda valor velho de outra linha). Isso vale até pra linha que ficou sozinha no grupo, pra planilha sair com as mesmas colunas em todas as linhas.

Ele só funciona com `strategy: "concat"`. Dá pra usar dentro do `byGroup`, mas não junto com o `into`, porque quem decide as colunas aí é o `distribute`. Se configurar errado, a validação da config avisa antes de rodar.

## Separar as pendências (`validation`)

Tem coisa que não dá pra consertar sozinho, tipo um e-mail escrito errado ou um campo obrigatório vazio. Pra isso tem o `validation`: você diz as regras e as linhas que não passam vão pra uma aba separada, com o motivo escrito do lado. Aí fica fácil alguém olhar e corrigir no sistema.

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

Na primeira aba (só essas seguem pro modo):

| matricula | nome | email           | plano      |
| --------- | ---- | --------------- | ---------- |
| 2024-0042 | Lia  | `lia@email.com` | Mensal     |
| 2024-0060 | Caio |                 | trimestral |

Na aba `Pendências`:

| Motivo                                                          | matricula | nome | email            | plano   |
| --------------------------------------------------------------- | --------- | ---- | ---------------- | ------- |
| e-mail fora do formato                                          | 2024-0051 | Theo | theo.email.com   | anual   |
| nome vazio; plano com valor não permitido; matrícula sem número | pendente  |      | `nina@email.com` | semanal |

As regras que existem:

| `rule`       | Passa quando                         | Campos extras                                                                                              |
| ------------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `required`   | a célula não tá vazia                | nenhum                                                                                                     |
| `pattern`    | o valor bate com a expressão regular | `pattern` e `flags` (opcional, tipo `"i"` pra ignorar maiúscula)                                           |
| `oneOf`      | o valor tá na lista                  | `values` e `ignoreCase` (opcional)                                                                         |
| `normalizer` | o normalizador não devolve `null`    | `normalizer`: o nome de um normalizador, pronto ou seu (veja [Normalizadores de chave](normalizadores.md)) |

Toda regra aceita um `message` pra trocar o texto do motivo, senão ele sai tipo `nome vazio` ou `plano com valor não permitido`. E se a linha falha em mais de uma regra, os motivos aparecem juntos separados por `; `.

Só o `required` reclama de célula vazia, as outras deixam passar. Foi por isso que o Caio passou mesmo sem e-mail. Se o campo for obrigatório e também tiver um formato, coloca as duas regras na mesma coluna.

O `normalizer` é bom pra reaproveitar o normalizador do merge. Se ele rejeitar a chave, a linha vai inteira pras pendências em vez de ir pro fim da planilha só com o rótulo.

A validação roda depois do `fillEmpty` e do `combineColumns`, então o que o `fillEmpty` preencheu já conta.

O `pendingSheet` (padrão `Pendências`) é o nome da aba, e se ela não existir ele cria. O `reasonColumn` (padrão `Motivo`) é o nome da coluna do motivo, que fica sempre na primeira coluna. Se não tiver nenhuma pendência a aba fica vazia, ela é limpa do mesmo jeito pra não sobrar pendência antiga.

E se o `pattern` tiver uma regex inválida ou o `normalizer` não existir, ele avisa antes de ler o banco.

---

[← Exemplos](exemplos.md) · [Normalizadores →](normalizadores.md)

<p align="center">
  <a href="../README.md"><img src="https://img.shields.io/badge/In%C3%ADcio-475569?style=for-the-badge" alt="Início"></a>
  <a href="gestores.md"><img src="https://img.shields.io/badge/Para%20gestores-2563EB?style=for-the-badge" alt="Guia para gestores"></a>
  <a href="devs.md"><img src="https://img.shields.io/badge/Para%20devs-16181D?style=for-the-badge" alt="Guia para devs"></a>
</p>
