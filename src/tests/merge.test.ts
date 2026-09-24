import { describe, it, expect } from "vitest";
import { MergeFilter } from "../filters/merge";
import {
    KeyNormalizer,
    registerKeyNormalizer,
} from "../filters/keyNormalizers";
import { MergeColumnConfig } from "../filters/mergeTypes";

describe("MergeFilter", () => {
    it("mescla 2 linhas duplicadas: overwrite fica com o último valor", () => {
        const rows = [
            { id: 1, codigo: "111", email: "antigo@teste.com" },
            { id: 2, codigo: "111", email: "novo@teste.com" },
        ];
        const filter = new MergeFilter("codigo", [
            { column: "email", strategy: "overwrite" },
        ]);

        const result = filter.apply(rows);

        expect(result).toHaveLength(1);
        expect(result[0]!.email).toBe("novo@teste.com");
    });

    it("mescla 3+ linhas duplicadas com concat, sem repetir valor igual", () => {
        const rows = [
            { id: 1, codigo: "222", obs: "vip" },
            { id: 2, codigo: "222", obs: "atrasou pagamento" },
            { id: 3, codigo: "222", obs: "vip" },
        ];
        const filter = new MergeFilter("codigo", [
            { column: "obs", strategy: "concat" },
        ]);

        const result = filter.apply(rows);

        expect(result).toHaveLength(1);
        expect(result[0]!.obs).toBe("vip; atrasou pagamento");
    });

    it("extra-column joga o telefone excedente em telefone_2, telefone_3...", () => {
        const rows = [
            { id: 1, codigo: "333", telefone: "1111-1111" },
            { id: 2, codigo: "333", telefone: "2222-2222" },
            { id: 3, codigo: "333", telefone: "3333-3333" },
        ];
        const filter = new MergeFilter("codigo", [
            { column: "telefone", strategy: "extra-column" },
        ]);

        const result = filter.apply(rows);

        expect(result[0]!.telefone).toBe("1111-1111");
        expect(result[0]!.telefone_2).toBe("2222-2222");
        expect(result[0]!.telefone_3).toBe("3333-3333");
    });

    it("ignora campos vazios/nulos ao mesclar", () => {
        const rows = [
            { id: 1, codigo: "444", telefone: null },
            { id: 2, codigo: "444", telefone: "9999-9999" },
        ];
        const filter = new MergeFilter("codigo", [
            { column: "telefone", strategy: "extra-column" },
        ]);

        const result = filter.apply(rows);

        expect(result[0]!.telefone).toBe("9999-9999");
        expect(result[0]!.telefone_2).toBeUndefined();
    });

    it("não mescla linhas sem duplicata", () => {
        const rows = [{ id: 1, codigo: "555", email: "a@teste.com" }];
        const filter = new MergeFilter("codigo", [
            { column: "email", strategy: "overwrite" },
        ]);

        expect(filter.apply(rows)).toEqual(rows);
    });
});

const skuNormalizer: KeyNormalizer = (raw) => {
    const clean = String(raw)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
    const match = clean.match(/^([A-Z]+)(\d+)$/);
    if (!match) return null;
    return { key: match[2] ?? "", group: match[1] ?? "" };
};

describe("MergeFilter com normalizador de chave", () => {
    it("sem normalizador, mantém o comportamento antigo (só trim)", () => {
        const rows = [
            { id: 1, sku: " AB-1 ", cor: "azul" },
            { id: 2, sku: "AB-1", cor: "verde" },
            { id: 3, sku: "ab-1", cor: "rosa" },
        ];
        const filter = new MergeFilter("sku", [
            { column: "cor", strategy: "concat" },
        ]);

        const result = filter.apply(rows);

        expect(result).toHaveLength(2);
        expect(result[0]!.cor).toBe("azul; verde");
    });

    it("chave suja com texto colado agrupa com a versão limpa", () => {
        const rows = [
            { id: 1, sku: "sku 0042", cor: "azul" },
            { id: 2, sku: "SKU-0042", cor: "verde" },
            { id: 3, sku: "SKU0042 (revisar)", cor: "rosa" },
        ];
        const filter = new MergeFilter(
            "sku",
            [{ column: "cor", strategy: "extra-column" }],
            {
                keyNormalizer: (raw) => {
                    const m = String(raw)
                        .toUpperCase()
                        .match(/([A-Z]+)\W*(\d+)/);
                    return m ? { key: m[2] ?? "", group: m[1] ?? "" } : null;
                },
            },
        );

        const result = filter.apply(rows);

        expect(result).toHaveLength(1);
        expect(result[0]!.cor).toBe("azul");
        expect(result[0]!.cor_2).toBe("verde");
        expect(result[0]!.cor_3).toBe("rosa");
    });

    it("formatos diferentes na mesma coluna nunca se agrupam, mesmo com key igual", () => {
        const rows = [
            { id: 1, sku: "AB-0042", cor: "azul" },
            { id: 2, sku: "CD-0042", cor: "verde" },
            { id: 3, sku: "ab 0042", cor: "rosa" },
        ];
        const filter = new MergeFilter(
            "sku",
            [{ column: "cor", strategy: "concat" }],
            {
                keyNormalizer: skuNormalizer,
            },
        );

        const result = filter.apply(rows);

        expect(result).toHaveLength(2);
        expect(result[0]!.cor).toBe("azul; rosa");
        expect(result[1]!.cor).toBe("verde");
    });

    it("chave rejeitada vira 'sem chave': isolada, no fim, com rótulo próprio", () => {
        const rows = [
            { id: 1, sku: "???", cor: "azul" },
            { id: 2, sku: "AB1", cor: "verde" },
            { id: 3, sku: "???", cor: "rosa" },
            { id: 4, sku: "AB1", cor: "preto" },
        ];
        const filter = new MergeFilter(
            "sku",
            [{ column: "cor", strategy: "concat" }],
            {
                keyNormalizer: skuNormalizer,
                rejectedKeyLabel: "sku inválido",
            },
        );

        const result = filter.apply(rows);

        expect(result).toHaveLength(3);
        expect(result[0]!.cor).toBe("verde; preto");
        expect(result[1]).toMatchObject({
            id: 1,
            sku: "sku inválido",
            cor: "azul",
        });
        expect(result[2]).toMatchObject({
            id: 3,
            sku: "sku inválido",
            cor: "rosa",
        });
    });

    it("rótulo padrão de rejeitada usa o nome da coluna-chave", () => {
        const filter = new MergeFilter("matricula", [], {
            keyNormalizer: () => null,
        });

        const result = filter.apply([{ id: 1, matricula: "x" }]);

        expect(result[0]!.matricula).toBe("(matricula inválido)");
    });

    it("valor vazio nem chega no normalizador e usa o rótulo de chave vazia", () => {
        const seen: unknown[] = [];
        const filter = new MergeFilter("email", [], {
            keyNormalizer: (raw) => {
                seen.push(raw);
                return { key: String(raw).toLowerCase() };
            },
            emptyKeyLabel: "sem email",
        });

        const result = filter.apply([
            { id: 1, email: null },
            { id: 2, email: "   " },
            { id: 3, email: "A@x.com" },
        ]);

        expect(seen).toEqual(["A@x.com"]);
        expect(result.map((r) => r.email)).toEqual([
            "A@x.com",
            "sem email",
            "sem email",
        ]);
    });

    it("aceita normalizador registrado por nome e reclama de nome desconhecido", () => {
        registerKeyNormalizer("sku-teste", skuNormalizer);
        const filter = new MergeFilter(
            "sku",
            [{ column: "cor", strategy: "concat" }],
            {
                keyNormalizer: "sku-teste",
            },
        );

        expect(
            filter.apply([
                { sku: "ab1", cor: "a" },
                { sku: "AB-1", cor: "b" },
            ]),
        ).toHaveLength(1);
        expect(
            () => new MergeFilter("sku", [], { keyNormalizer: "nao-existe" }),
        ).toThrow(/nao-existe/);
    });

    it("registrar dois normalizadores diferentes com o mesmo nome dá erro", () => {
        registerKeyNormalizer("nome-repetido", () => null);
        expect(() =>
            registerKeyNormalizer("nome-repetido", () => null),
        ).toThrow();
    });
});

describe("MergeFilter: collapse-column nas linhas sem chave", () => {
    const columns = [
        {
            column: "nome",
            strategy: "extra-column" as const,
            unkeyed: {
                strategy: "collapse-column" as const,
                into: "Nomes sem chave",
                separator: " | ",
            },
        },
    ];

    it("junta a coluna de todas as linhas sem chave numa coluna só, numa linha só", () => {
        const rows = [
            { id: 1, ref: "R1", nome: "Ana" },
            { id: 2, ref: null, nome: "Bia" },
            { id: 3, ref: "R1", nome: "Caio" },
            { id: 4, ref: "", nome: "Duda" },
            { id: 5, ref: "  ", nome: "Edu" },
        ];
        const filter = new MergeFilter("ref", columns);

        const result = filter.apply(rows);

        expect(result).toHaveLength(2);
        expect(result[0]!.nome).toBe("Ana");
        expect(result[0]!.nome_2).toBe("Caio");
        expect(result[1]).toEqual({
            ref: "(sem ref)",
            "Nomes sem chave": "Bia | Duda | Edu",
        });
        expect(Object.keys(result[1]!)).not.toContain("nome_2");
    });

    it("chave vazia e chave rejeitada ficam em linhas separadas, cada uma com seu rótulo", () => {
        const rows = [
            { ref: null, nome: "Ana" },
            { ref: "!!", nome: "Bia" },
            { ref: "", nome: "Caio" },
            { ref: "??", nome: "Duda" },
        ];
        const filter = new MergeFilter("ref", columns, {
            keyNormalizer: (raw) =>
                /^[A-Z0-9]+$/.test(String(raw)) ? { key: String(raw) } : null,
            emptyKeyLabel: "vazio",
            rejectedKeyLabel: "rejeitado",
        });

        const result = filter.apply(rows);

        expect(result).toEqual([
            { ref: "vazio", "Nomes sem chave": "Ana | Caio" },
            { ref: "rejeitado", "Nomes sem chave": "Bia | Duda" },
        ]);
    });

    it("não deduplica os valores, já que são pessoas diferentes", () => {
        const filter = new MergeFilter("ref", columns);

        const result = filter.apply([
            { ref: null, nome: "Ana" },
            { ref: null, nome: "Ana" },
        ]);

        expect(result[0]!["Nomes sem chave"]).toBe("Ana | Ana");
    });

    it("sem 'into', o nome da coluna nova sai de coluna + rótulo; separador padrão é '; '", () => {
        const filter = new MergeFilter("ref", [
            {
                column: "nome",
                strategy: "concat",
                unkeyed: { strategy: "collapse-column" },
            },
        ]);

        const result = filter.apply([
            { ref: null, nome: "Ana" },
            { ref: null, nome: "Bia" },
        ]);

        expect(result).toEqual([
            { ref: "(sem ref)", "nome (sem ref)": "Ana; Bia" },
        ]);
    });

    it("funciona pra mais de uma coluna ao mesmo tempo", () => {
        const filter = new MergeFilter("ref", [
            {
                column: "nome",
                strategy: "concat",
                unkeyed: { strategy: "collapse-column", into: "Nomes" },
            },
            {
                column: "email",
                strategy: "concat",
                unkeyed: { strategy: "collapse-column", into: "Emails" },
            },
        ]);

        const result = filter.apply([
            { ref: null, nome: "Ana", email: "a@x.com" },
            { ref: null, nome: "Bia", email: null },
        ]);

        expect(result[0]).toMatchObject({
            Nomes: "Ana; Bia",
            Emails: "a@x.com",
        });
    });

    it("sem unkeyed configurado, linhas sem chave continuam uma por linha (comportamento antigo)", () => {
        const filter = new MergeFilter("ref", [
            { column: "nome", strategy: "extra-column" },
        ]);

        const result = filter.apply([
            { ref: null, nome: "Ana" },
            { ref: null, nome: "Bia" },
        ]);

        expect(result).toEqual([
            { ref: "(sem ref)", nome: "Ana" },
            { ref: "(sem ref)", nome: "Bia" },
        ]);
    });
});

describe("MergeFilter: estratégia diferente por grupo (byGroup)", () => {
    const columns: MergeColumnConfig[] = [
        {
            column: "cor",
            strategy: "extra-column",
            byGroup: {
                CD: { strategy: "concat", into: "cores CD", separator: " | " },
            },
        },
    ];
    const build = (cols: MergeColumnConfig[] = columns) =>
        new MergeFilter("sku", cols, { keyNormalizer: skuNormalizer });

    const rows = [
        { sku: "AB1", cor: "azul" },
        { sku: "ab-1", cor: "verde" },
        { sku: "CD1", cor: "rosa" },
        { sku: "cd 1", cor: "preto" },
        { sku: "CD2", cor: "cinza" },
    ];

    it("grupo sem regra própria segue a estratégia normal da coluna", () => {
        const result = build().apply(rows);

        expect(result[0]).toEqual({ sku: "AB1", cor: "azul", cor_2: "verde" });
    });

    it("grupo com regra junta tudo numa coluna nova e esvazia a coluna original", () => {
        const result = build().apply(rows);

        expect(result[1]).toEqual({ sku: "CD1", "cores CD": "rosa | preto" });
    });

    it("grupo com regra também move o valor quando tem uma linha só", () => {
        const result = build().apply(rows);

        expect(result[2]).toEqual({ sku: "CD2", "cores CD": "cinza" });
        expect(result).toHaveLength(3);
    });

    it("sem byGroup, nada muda", () => {
        const result = build([
            { column: "cor", strategy: "extra-column" },
        ]).apply(rows);

        expect(result[1]).toEqual({ sku: "CD1", cor: "rosa", cor_2: "preto" });
        expect(result[2]).toEqual({ sku: "CD2", cor: "cinza" });
    });

    it("normalizador que não devolve grupo ignora o byGroup", () => {
        const filter = new MergeFilter("sku", columns);

        const result = filter.apply([
            { sku: "CD1", cor: "rosa" },
            { sku: "CD1", cor: "preto" },
        ]);

        expect(result).toEqual([{ sku: "CD1", cor: "rosa", cor_2: "preto" }]);
    });

    it("override pode ter estratégia própria sem coluna nova", () => {
        const result = build([
            {
                column: "cor",
                strategy: "extra-column",
                byGroup: { CD: { strategy: "concat" } },
            },
        ]).apply(rows);

        expect(result[1]).toEqual({ sku: "CD1", cor: "rosa; preto" });
    });
});

describe("MergeFilter: concat com distribute", () => {
    const cores = (
        distribute: MergeColumnConfig["distribute"],
    ): MergeColumnConfig[] => [
        { column: "cor", strategy: "concat", distribute },
    ];

    it("sem distribute, o concat continua juntando tudo numa célula", () => {
        const rows = [
            { codigo: "A", cor: "azul" },
            { codigo: "A", cor: "verde" },
        ];
        const filter = new MergeFilter("codigo", [
            { column: "cor", strategy: "concat" },
        ]);

        expect(filter.apply(rows)).toEqual([
            { codigo: "A", cor: "azul; verde" },
        ]);
    });

    it("distribui um valor por coluna quando a quantidade bate e remove a coluna de origem", () => {
        const rows = [
            { codigo: "A", cor: "azul" },
            { codigo: "A", cor: "verde" },
        ];
        const filter = new MergeFilter(
            "codigo",
            cores({ columns: ["cor_1", "cor_2"] }),
        );

        expect(filter.apply(rows)).toEqual([
            { codigo: "A", cor_1: "azul", cor_2: "verde" },
        ]);
    });

    it("joga o excedente no overflowInto, com o separador da coluna", () => {
        const rows = [
            { codigo: "A", cor: "azul" },
            { codigo: "A", cor: "verde" },
            { codigo: "A", cor: "roxo" },
            { codigo: "A", cor: "preto" },
        ];
        const filter = new MergeFilter("codigo", [
            {
                column: "cor",
                strategy: "concat",
                separator: " | ",
                distribute: {
                    columns: ["cor_1", "cor_2"],
                    overflowInto: "outras_cores",
                },
            },
        ]);

        expect(filter.apply(rows)).toEqual([
            {
                codigo: "A",
                cor_1: "azul",
                cor_2: "verde",
                outras_cores: "roxo | preto",
            },
        ]);
    });

    it("sem overflowInto, cria a coluna <coluna>_overflow e não perde nenhum valor", () => {
        const rows = [
            { codigo: "A", cor: "azul" },
            { codigo: "A", cor: "verde" },
            { codigo: "A", cor: "roxo" },
        ];
        const filter = new MergeFilter("codigo", cores({ columns: ["cor_1"] }));

        expect(filter.apply(rows)).toEqual([
            { codigo: "A", cor_1: "azul", cor_overflow: "verde; roxo" },
        ]);
    });

    it("se <coluna>_overflow já existe na linha, usa o próximo sufixo livre", () => {
        const rows = [
            { codigo: "A", cor: "azul", cor_overflow: "já tinha" },
            { codigo: "A", cor: "verde", cor_overflow: "já tinha" },
        ];
        const filter = new MergeFilter("codigo", cores({ columns: ["cor_1"] }));

        const result = filter.apply(rows);

        expect(result[0]!.cor_overflow).toBe("já tinha");
        expect(result[0]!.cor_overflow_2).toBe("verde");
    });

    it("remove duplicados exatos antes de distribuir", () => {
        const rows = [
            { codigo: "A", cor: "azul" },
            { codigo: "A", cor: "azul" },
            { codigo: "A", cor: "verde" },
        ];
        const filter = new MergeFilter(
            "codigo",
            cores({ columns: ["cor_1", "cor_2", "cor_3"] }),
        );

        expect(filter.apply(rows)).toEqual([
            { codigo: "A", cor_1: "azul", cor_2: "verde" },
        ]);
    });

    it("mantém a coluna de origem quando ela mesma é um dos destinos", () => {
        const rows = [
            { codigo: "A", cor: "azul" },
            { codigo: "A", cor: "verde" },
        ];
        const filter = new MergeFilter(
            "codigo",
            cores({ columns: ["cor", "cor_2"] }),
        );

        expect(filter.apply(rows)).toEqual([
            { codigo: "A", cor: "azul", cor_2: "verde" },
        ]);
    });

    it("chave com uma linha só também é distribuída, pra planilha sair com as mesmas colunas", () => {
        const rows = [
            { codigo: "A", cor: "azul" },
            { codigo: "A", cor: "verde" },
            { codigo: "B", cor: "preto" },
        ];
        const filter = new MergeFilter(
            "codigo",
            cores({ columns: ["cor_1", "cor_2"] }),
        );

        expect(filter.apply(rows)).toEqual([
            { codigo: "A", cor_1: "azul", cor_2: "verde" },
            { codigo: "B", cor_1: "preto" },
        ]);
    });

    it("distribute dentro do byGroup vale só pro grupo configurado", () => {
        const byPrefix: KeyNormalizer = (raw) => {
            const text = String(raw);
            return { group: text.slice(0, 2), key: text };
        };
        const rows = [
            { codigo: "AB1", cor: "azul" },
            { codigo: "AB1", cor: "verde" },
            { codigo: "CD1", cor: "azul" },
            { codigo: "CD1", cor: "verde" },
        ];
        const filter = new MergeFilter(
            "codigo",
            [
                {
                    column: "cor",
                    strategy: "concat",
                    byGroup: {
                        AB: {
                            strategy: "concat",
                            distribute: { columns: ["cor_1", "cor_2"] },
                        },
                    },
                },
            ],
            { keyNormalizer: byPrefix },
        );

        expect(filter.apply(rows)).toEqual([
            { codigo: "AB1", cor_1: "azul", cor_2: "verde" },
            { codigo: "CD1", cor: "azul; verde" },
        ]);
    });
});
