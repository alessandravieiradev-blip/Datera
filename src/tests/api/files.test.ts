import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
    convertMany,
    extensionFor,
    findFiles,
    planOutputs,
    readRows,
} from "../../api";

function pasta(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "datera-lote-"));
    fs.mkdirSync(path.join(dir, "matriculas"));
    const meses = [
        "janeiro",
        "fevereiro",
        "marco",
        "10-outubro",
        "2-fevereiro",
    ];
    for (const mes of meses) {
        fs.writeFileSync(
            path.join(dir, "matriculas", `${mes}.csv`),
            `matricula;nome\n2024-0042;Lia Martins\n2024-0051;Theo Souza\n`,
        );
    }
    fs.writeFileSync(path.join(dir, "matriculas", "leia.md"), "notas");
    fs.writeFileSync(path.join(dir, "matriculas", ".oculto.csv"), "x");
    return dir;
}

describe("findFiles", () => {
    it("acha pelo padrão, pula o que não é dado e ordena como gente", () => {
        const dir = pasta();
        const nomes = (files: string[]) => files.map((f) => path.basename(f));

        expect(
            nomes(findFiles(path.join(dir, "matriculas", "*o.csv"))),
        ).toEqual([
            "2-fevereiro.csv",
            "10-outubro.csv",
            "fevereiro.csv",
            "janeiro.csv",
            "marco.csv",
        ]);
        expect(findFiles(path.join(dir, "matriculas"))).toHaveLength(5);
        expect(
            findFiles([
                path.join(dir, "matriculas", "janeiro.csv"),
                path.join(dir, "matriculas", "jan*.csv"),
            ]),
        ).toHaveLength(1);
    });

    it("explica quando não acha nada ou o * está no lugar errado", () => {
        const dir = pasta();
        expect(() => findFiles(path.join(dir, "matriculas", "z*.csv"))).toThrow(
            "Nenhum arquivo encontrado",
        );
        expect(() => findFiles(path.join(dir, "*", "a.csv"))).toThrow(
            "só pode estar no nome do arquivo",
        );
        expect(() => findFiles(path.join(dir, "nao-existe.csv"))).toThrow(
            "Não achei o arquivo",
        );
    });
});

describe("planOutputs", () => {
    it("troca a extensão e usa a pasta de saída", () => {
        expect(extensionFor("XLSX")).toBe(".xlsx");
        expect(extensionFor("excel")).toBe(".xlsx");
        expect(extensionFor(".db")).toBe(".db");
        expect(() => extensionFor("pdf")).toThrow("Não conheço o formato");
        expect(() => extensionFor("constructor")).toThrow(
            "Não conheço o formato",
        );

        const [plano] = planOutputs(["/escola/janeiro.csv"], "json", "/saida");
        expect(plano!.output).toBe(path.join("/saida", "janeiro.json"));
    });

    it("não deixa dois arquivos virarem o mesmo nem gravar por cima de uma entrada", () => {
        expect(() =>
            planOutputs(["/a/janeiro.csv", "/b/janeiro.xml"], "json", "/saida"),
        ).toThrow("iam virar o mesmo arquivo");
        expect(() => planOutputs(["/a/janeiro.csv"], "csv")).toThrow(
            "gravar por cima",
        );
        expect(() =>
            planOutputs(["/a/janeiro.xml", "/a/janeiro.json"], "json"),
        ).toThrow("gravar por cima");
    });
});

describe("convertMany", () => {
    it("converte cada arquivo pro formato pedido", async () => {
        const dir = pasta();
        const saida = path.join(dir, "saida");

        const feitos = await convertMany(
            path.join(dir, "matriculas", "*.csv"),
            { to: "json", outDir: saida },
        );

        expect(feitos).toHaveLength(5);
        expect(feitos.every((item) => item.rows === 2)).toBe(true);
        expect(await readRows(path.join(saida, "janeiro.json"))).toEqual([
            { matricula: "2024-0042", nome: "Lia Martins" },
            { matricula: "2024-0051", nome: "Theo Souza" },
        ]);
    });

    it("diz em qual arquivo parou", async () => {
        const dir = pasta();
        fs.writeFileSync(path.join(dir, "matriculas", "zz.xml"), "<quebrado");

        await expect(
            convertMany(path.join(dir, "matriculas"), {
                to: "json",
                outDir: path.join(dir, "saida"),
            }),
        ).rejects.toThrow("Parei em");
    });
});
