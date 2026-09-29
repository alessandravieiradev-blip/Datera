import { describe, it, expect } from "vitest";
import {
    hasEntries,
    releaseChangelog,
    sectionFor,
} from "../../../scripts/changelog";

const CHANGELOG = `# Mudanças

## [Não lançado]

### Adicionado

- converter vários arquivos de uma vez

## [0.1.0] - 2026-09-29

### Adicionado

- primeira versão
`;

describe("CHANGELOG", () => {
    it("pega a seção de uma versão sem o título", () => {
        expect(sectionFor(CHANGELOG, "0.1.0")).toBe(
            "### Adicionado\n\n- primeira versão",
        );
        expect(sectionFor(CHANGELOG, "9.9.9")).toBe(null);
    });

    it("sabe se a seção tem alguma mudança escrita", () => {
        expect(hasEntries(sectionFor(CHANGELOG, "Não lançado"))).toBe(true);
        expect(hasEntries("### Adicionado")).toBe(false);
        expect(hasEntries(null)).toBe(false);
    });

    it("fecha a seção não lançada com a versão e a data", () => {
        const released = releaseChangelog(CHANGELOG, "0.2.0", "2026-10-05");

        expect(sectionFor(released, "0.2.0")).toBe(
            "### Adicionado\n\n- converter vários arquivos de uma vez",
        );
        expect(sectionFor(released, "Não lançado")).toBe("");
        expect(released).toContain("## [0.2.0] - 2026-10-05");
    });

    it("não deixa lançar versão repetida nem sem mudança escrita", () => {
        expect(() =>
            releaseChangelog(CHANGELOG, "0.1.0", "2026-10-05"),
        ).toThrow("já tem a versão");
        const empty = CHANGELOG.replace(
            "- converter vários arquivos de uma vez",
            "",
        );
        expect(() => releaseChangelog(empty, "0.2.0", "2026-10-05")).toThrow(
            "está vazia",
        );
    });
});
