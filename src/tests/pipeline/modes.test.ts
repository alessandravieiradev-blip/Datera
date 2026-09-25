import { describe, it, expect } from "vitest";
import { parseMode } from "../../pipeline";

describe("parseMode", () => {
    it("aceita os modos que existem", () => {
        expect(parseMode("raw")).toBe("raw");
        expect(parseMode("dedupe")).toBe("dedupe");
        expect(parseMode("merge")).toBe("merge");
    });

    it("explica quais modos existem quando o nome tá errado", () => {
        expect(() => parseMode("junta")).toThrow(
            'Modo inválido: "junta". Modos aceitos: raw, dedupe, merge.',
        );
    });
});
