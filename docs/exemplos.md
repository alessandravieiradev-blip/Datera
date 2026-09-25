<p align="center">
  <a href="../README.md"><img src="https://img.shields.io/badge/In%C3%ADcio-475569?style=for-the-badge" alt="Início"></a>
  <a href="gestores.md"><img src="https://img.shields.io/badge/Para%20gestores-2563EB?style=for-the-badge" alt="Guia para gestores"></a>
  <a href="devs.md"><img src="https://img.shields.io/badge/Para%20devs-16181D?style=for-the-badge" alt="Guia para devs"></a>
</p>

[Guia para devs](devs.md) › Exemplos

# Exemplos

Todos os exemplos usam uma escola de música e um festival que eu inventei. Em cada um só aparece a parte do `config.json` que importa, o resto (banco, planilha) fica igual ao seu.

As tabelas de saída eu não escrevi na mão, elas saíram rodando o ETL com essas configs. Então é isso mesmo que vai aparecer.

## 1. Só copiar (`raw`)

O mais simples de todos, nada é mexido.

```json
{ "mode": "raw" }
```

| id  | nome | email            |
| --- | ---- | ---------------- |
| 1   | Lia  | `lia@email.com`  |
| 2   | Theo | `theo@email.com` |
| 3   | Lia  | `lia@email.com`  |

A Lia aparece duas vezes. Os próximos exemplos resolvem isso de jeitos diferentes.

## 2. Tirar as repetidas (`dedupe`)

Aqui ele olha a coluna `email` e deixa uma linha só pra cada valor. Com `keep-last` fica a última.

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

A primeira linha da Lia saiu e ficou só a 3. Como é `keep-last`, a linha que fica vai pra posição da última, por isso o Theo subiu (com `keep-first`, que é o padrão, a ordem não muda). E repara que a turma de segunda sumiu junto, porque o `dedupe` joga a linha inteira fora. Se isso for um problema, o `merge` do próximo exemplo resolve.

## 3. Juntar sem perder nada (`merge`)

Aqui as linhas com a mesma chave viram uma só e você escolhe o que acontece com cada coluna.

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

O `concat` juntou as oficinas numa célula e o "Violão" repetido apareceu uma vez só. O `overwrite` ficou com o último plano preenchido (a terceira linha não tinha plano, então ficou o "trimestral"). E o `extra-column` criou a `instrumento_2`, se tivesse um terceiro ia pra `instrumento_3`. As colunas que não estão no `mergeColumns` ficam com o valor da primeira linha.

## 4. Mesma chave escrita diferente (normalizador pronto)

Esses três e-mails são da mesma pessoa, mas sem normalizador o ETL acha que são três pessoas diferentes.

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

O `lowercase` tira os espaços e deixa tudo minúsculo só na hora de comparar, na planilha o e-mail continua como veio na primeira linha. Tem outros prontos e dá pra criar o seu, explico em [Normalizadores de chave](normalizadores.md).

## 5. Linhas sem chave (jeito padrão)

E quando a chave tá vazia ou não serve? Nesse exemplo a chave é a matrícula, e o `digitsOnly` deixa só os números dela.

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

`2024-0042` e `20240042` viraram a mesma chave e a Lia foi juntada. A Nina e o Caio não têm matrícula, e eles nunca são juntados entre si (podem ser pessoas diferentes), então vão pro fim, um por linha, com o rótulo `sem matrícula`. Já o `pendente` da Duda não tem nenhum número, o `digitsOnly` rejeitou e ela foi pro fim com `matrícula inválida`.

## 6. Linhas sem chave resumidas (`unkeyed`)

É a mesma entrada do exemplo 5, só que agora quem não tem chave fica resumido numa linha.

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

Agora sobram no máximo duas linhas no fim, uma pra quem veio sem chave e outra pra quem teve a chave rejeitada. Só as colunas com `unkeyed` aparecem nelas.

## 7. Arrumar antes de tudo (`fillEmpty` e `combineColumns`)

Essas duas rodam antes do modo, então funcionam até no `raw`. Aqui o exemplo é a agenda das aulas.

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

A aula de Canto estava sem hora, ganhou o `19:00` do `default` e aí deu pra montar o `quando`. A sala vazia dela puxou a `sala_reserva`, já a Bateria não tinha nem reserva e ficou `a definir`. A Bateria também está sem data, então o `quando` dela ficou vazio em vez de sair só `20:00` pela metade. E as colunas `data` e `hora` sumiram, o `quando` entrou no lugar delas.

## 8. Um valor em cada coluna (`distribute`)

Em vez de juntar tudo numa célula, o `distribute` coloca cada valor numa coluna. E com o `sources` várias colunas entram na mesma lista.

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

A Lia tinha 5 instrumentos nas duas colunas, um repetido. Sobraram 4 diferentes: 2 foram pras colunas e 2 pro `outros instrumentos`, nenhum se perdeu. O Theo só tinha coisa no `instrumento 2` e subiu pro `instrumento 1`, porque ele sempre preenche da esquerda pra direita.

Se não tiver `overflowInto`, ele cria a coluna da sobra sozinho:

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

## 9. Regra diferente pra cada tipo de chave (`byGroup`)

Esse usa o normalizador `codigoProduto` do guia [Criando o seu próprio normalizador](normalizadores.md#criando-o-seu-próprio-normalizador), que separa as letras do código como `group`. Os produtos `AB` ficam com uma cor por coluna e os `CD` ficam com as cores juntas numa coluna só deles.

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

`ab-0042` e `AB 0042` são o mesmo produto e viraram uma linha só, com `cor` e `cor_2`. O `CD0042` tem os mesmos números mas é de outro grupo, então nunca junta com o `AB`, e as cores dele foram pra `Cores CD`. O `XYZ` não tem o formato certo, foi rejeitado e foi pro fim com o rótulo padrão.

## 10. Tudo junto: inscrições de um festival

Esse é o exemplo que eu mais gosto. Um festival recebe inscrição de artista solo e de banda na mesma planilha. Artista solo se inscreve com e-mail (e às vezes se inscreve duas vezes), banda se inscreve com uma tag tipo `#nomedabanda` e cada integrante manda a sua. Tem gente que não disse o palco, e tem inscrição sem identificação ou com uma que não vale.

Primeiro um normalizador que sabe separar solo de banda (em `local/inscrito.ts`):

```ts
import { KeyNormalizer } from "../src/normalizers/registry";

const inscrito: KeyNormalizer = (raw) => {
    const texto = String(raw).trim().toLowerCase();

    if (texto.includes("@")) return { key: texto, group: "solo" };
    if (texto.startsWith("#"))
        return { key: texto.replace(/[^a-z0-9]/g, ""), group: "banda" };

    return null;
};

export const normalizers = { inscrito };
```

Depois a config:

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

Explicando por partes:

1. O `fillEmpty` deu o `Palco preferido` pra quem estava sem palco, e quem não tinha nenhum dos dois ficou com `a definir` (foi o caso do Theo)
2. O normalizador fez `lia@email.com` e ` LIA@email.com` virarem a mesma chave no grupo `solo`, e `#Os Vagalumes` e `#osvagalumes` a mesma no grupo `banda`. O `caio` não é e-mail nem tag, então foi rejeitado
3. Na `Inscrição` os números das inscrições juntadas ficaram lado a lado (`1 | 2`), pra dar pra achar as originais
4. No `Nome`, artista solo ficou com um nome por coluna (`Nome`, `Nome_2`) e banda teve os integrantes juntados em `Integrantes` pelo `byGroup`
5. Os estilos da Lia (MPB, Folk, Folk, Indie) viraram três diferentes, dois foram pras colunas e o outro pro `Outros estilos`
6. O `Confirmado` usa `overwrite`, então se a inscrição mais nova diz "não", fica "não"
7. A Nina (sem identificação) e o Caio (identificação inválida) foram pro fim, cada um com seu rótulo

---

[← Fontes e destinos](fontes-e-destinos.md) · [Preparação e pendências →](preparacao-e-pendencias.md)

<p align="center">
  <a href="../README.md"><img src="https://img.shields.io/badge/In%C3%ADcio-475569?style=for-the-badge" alt="Início"></a>
  <a href="gestores.md"><img src="https://img.shields.io/badge/Para%20gestores-2563EB?style=for-the-badge" alt="Guia para gestores"></a>
  <a href="devs.md"><img src="https://img.shields.io/badge/Para%20devs-16181D?style=for-the-badge" alt="Guia para devs"></a>
</p>
