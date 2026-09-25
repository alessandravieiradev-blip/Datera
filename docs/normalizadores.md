<p align="center">
  <a href="../README.md"><img src="https://img.shields.io/badge/In%C3%ADcio-475569?style=for-the-badge" alt="Início"></a>
  <a href="gestores.md"><img src="https://img.shields.io/badge/Para%20gestores-2563EB?style=for-the-badge" alt="Guia para gestores"></a>
  <a href="devs.md"><img src="https://img.shields.io/badge/Para%20devs-16181D?style=for-the-badge" alt="Guia para devs"></a>
</p>

[Guia para devs](devs.md) › Normalizadores

# Normalizadores de chave

## Pra que serve

No modo `merge` ele junta as linhas que têm a mesma chave. Só que `Ana@Email.com` e `ana@email.com ` são a mesma pessoa e pro computador são textos diferentes, então a junção não acontece.

O normalizador resolve isso. Ele é uma função que roda em cada valor da coluna-chave antes de comparar, e devolve uma de três coisas:

| Devolve                        | Significa                                                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `{ key: "abc" }`               | "A chave limpa é `abc`". Linhas com a mesma `key` são unificadas                                                |
| `{ key: "0042", group: "AB" }` | Igual ao de cima, mas com uma categoria. Linhas de categorias diferentes nunca se juntam, mesmo com `key` igual |
| `null`                         | "Esse valor não serve como chave" (rejeitada)                                                                   |

Valor vazio (`null`, texto vazio ou só espaço) nem chega no normalizador, vai direto pro grupo das linhas sem chave.

As rejeitadas (`null`) também viram "sem chave": ficam sozinhas, nunca se juntam com outra e vão pro fim da planilha com o rótulo do `mergeRejectedKeyLabel`.

A chave normalizada só serve pra comparar. O valor que aparece na planilha continua sendo o da primeira linha do grupo.

## Como ativar um normalizador

No `config.json`, é só colocar o nome dele em `mergeKeyNormalizer`:

```json
{
    "mode": "merge",
    "mergeKeyColumn": "email",
    "mergeKeyNormalizer": "lowercase",
    "mergeColumns": [{ "column": "nome", "strategy": "concat" }]
}
```

Sem `mergeKeyNormalizer`, ele usa o `trim` (que só tira os espaços das pontas).

O que acontece com essa config:

| email (banco)    | nome (banco) |     | email (planilha) | nome (planilha) |
| ---------------- | ------------ | --- | ---------------- | --------------- |
| `Ana@Email.com`  | Ana          |     | `Ana@Email.com`  | Ana; Ana Paula  |
| ` ana@email.com` | Ana Paula    |     |                  |                 |

## Normalizadores que já vêm prontos

| Nome           | O que faz                                    | Exemplo                                   | Rejeita quando          |
| -------------- | -------------------------------------------- | ----------------------------------------- | ----------------------- |
| `trim`         | Tira espaços do começo e do fim. É o padrão  | `" AB-1 "` vira `"AB-1"`                  | Nunca                   |
| `lowercase`    | Faz o `trim` e deixa tudo minúsculo          | `"Ana@Email.COM "` vira `"ana@email.com"` | Nunca                   |
| `digitsOnly`   | Fica só com os números                       | `"(53) 99999-1234"` vira `"53999991234"`  | Não sobra nenhum dígito |
| `alphanumeric` | Fica só com letras e números, tudo minúsculo | `"AB-0042 / rev"` vira `"ab0042rev"`      | Não sobra nada          |

Onde cada um costuma servir:

- `lowercase`: e-mail, username, qualquer texto que muda de maiúscula pra minúscula
- `digitsOnly`: telefone e código numérico escrito com ponto, traço e parêntese
- `alphanumeric`: código de produto que aparece como `AB-0042`, `ab 0042` e `AB0042`

## Criando o seu próprio normalizador

Se nenhum dos prontos serve, dá pra escrever o seu, é só uma função. Vou mostrar com um exemplo: código de produto no formato letras + números, que às vezes vem com hífen, espaço ou minúscula (`ab-0042`, `AB 0042`, `AB0042`). A ideia é que `AB0042` e `CD0042` não sejam juntados, porque são de linhas diferentes.

Primeiro cria um arquivo, eu uso o `local/meusNormalizers.ts`. A pasta `local/` está no `.gitignore`, então o que você coloca lá não vai pro GitHub.

Depois escreve a função:

```ts
import { KeyNormalizer } from "../src/normalizers/registry";

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

Explicando cada parte:

- `raw` é o valor que veio do banco. Pode ser texto ou número, por isso tem o `String(raw)`
- o `toUpperCase().replace(...)` deixa tudo maiúsculo e tira o que não é letra nem número
- o `match(...)` separa as letras (`partes[1]`) dos números (`partes[2]`). Se o formato não bate, ele devolve `null` e a linha vai pras rejeitadas
- `key` são os números e `group` são as letras. Assim `AB0042` e `CD0042` têm a mesma `key` mas grupos diferentes, e não se juntam
- o `?? ""` está ali porque o `tsconfig` do projeto liga o `noUncheckedIndexedAccess`, e aí o TypeScript acha que `partes[1]` pode ser `undefined`
- a última linha é obrigatória: o arquivo tem que exportar um objeto chamado `normalizers`. O nome de cada propriedade é o nome que você usa no `config.json`, e dá pra colocar vários no mesmo arquivo

Aí avisa o projeto que esse arquivo existe, no `config.json`:

```json
{
    "normalizerModules": ["./local/meusNormalizers.ts"],
    "mergeKeyNormalizer": "codigoProduto"
}
```

O caminho é a partir da pasta onde você roda o `npm start`. O arquivo pode ser `.ts` (funciona porque o `npm start` usa o `tsx`), `.js` ou `.cjs`. Se for `.js` ou `.cjs`, exporta com `module.exports = { normalizers: { codigoProduto } }`.

Vale testar também. Cria um `local/meusNormalizers.test.ts`, o `npm test` roda os testes dessa pasta junto:

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

Depois é só rodar com `npm start`. Se o nome no `mergeKeyNormalizer` não existir, o erro mostra a lista dos que existem.

## Ideias de uso

| Situação                                                         | Como resolver                                                                            |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| E-mails com maiúscula/minúscula misturada                        | `lowercase`                                                                              |
| Telefones escritos de jeitos diferentes                          | `digitsOnly`, ou um seu que também tire o `55` do começo                                 |
| Códigos de produto com hífen ou espaço                           | `alphanumeric`, ou um seu com `group` pelas letras (como no exemplo acima)               |
| Matrícula com prefixo da unidade (`SP-1234`, `RJ-1234`)          | Um seu com `group` = prefixo e `key` = número, pra unidades diferentes nunca se juntarem |
| Dois formatos de ID na mesma coluna (ex: 8 dígitos e 12 dígitos) | Um seu que tire tudo que não é número e use o tamanho como `group`                       |
| Valor com texto grudado no fim (`12345abc`)                      | Um seu que pegue só a parte inicial com uma regex                                        |
| Valores de "preenchimento" (`n/a`, `0000`, `-`)                  | Um seu que devolva `null` pra eles                                                       |

## Estratégia diferente por grupo

Quando o normalizador devolve um `group`, cada coluna do `mergeColumns` pode ter uma regra própria pra cada grupo usando o `byGroup`. O grupo que não tem regra usa a `strategy` normal da coluna.

Usando o `codigoProduto` de cima (o `group` são as letras do código), dá pra deixar os produtos `AB` com `cor`, `cor_2`, `cor_3` e os `CD` com todas as cores juntas numa coluna só:

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

A chave do `byGroup` (`"CD"`) é o `group` que o normalizador devolve, e maiúscula faz diferença. O `strategy` aceita as mesmas três da coluna. O `into` é opcional: com ele o valor vai pra uma coluna nova e a original fica vazia nessas linhas, sem ele continua na original. O `separator` também é opcional e só vale pro `concat`.

A regra vale até pras linhas que ficaram sozinhas no grupo, pra todo mundo do mesmo grupo ficar no mesmo formato.

## Cuidados

- a função não pode mexer em nada fora dela nem depender de coisa de fora. Pro mesmo valor tem que devolver sempre o mesmo resultado
- na dúvida, devolve `null`. É melhor um valor esquisito ir pro fim da planilha com rótulo do que juntar com a pessoa errada
- dois normalizadores com o mesmo nome dão erro, e isso vale pros nomes dos prontos também
- se o `normalizerModules` apontar pra um arquivo que não existe, ou que não exporta `normalizers`, o erro diz qual é o arquivo

---

[← Preparação e pendências](preparacao-e-pendencias.md) · [Estrutura do projeto →](estrutura.md)

<p align="center">
  <a href="../README.md"><img src="https://img.shields.io/badge/In%C3%ADcio-475569?style=for-the-badge" alt="Início"></a>
  <a href="gestores.md"><img src="https://img.shields.io/badge/Para%20gestores-2563EB?style=for-the-badge" alt="Guia para gestores"></a>
  <a href="devs.md"><img src="https://img.shields.io/badge/Para%20devs-16181D?style=for-the-badge" alt="Guia para devs"></a>
</p>
