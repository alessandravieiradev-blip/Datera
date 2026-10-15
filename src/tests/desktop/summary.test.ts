import { afterEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
    formatRunSummary,
    saveRunSummary,
} from "../../../apps/desktop/src/main/summary";
import { RunRecord } from "../../../apps/desktop/src/shared/api";

const folders: string[] = [];

function folder(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "datera-summary-"));
    folders.push(dir);
    return dir;
}

function record(dryRun = false): RunRecord {
    return {
        id: "execucao-alunos",
        startedAt: "2026-10-15T12:00:00.000Z",
        configPath: "/escola/config.json",
        ok: true,
        dryRun,
        report: {
            mode: "dedupe",
            dryRun,
            written: !dryRun,
            rowsRead: 7,
            rowsOut: 3,
            pendingRows: 2,
            pendingByReason: [{ reason: "sem matrícula", count: 2 }],
            steps: [
                {
                    name: "validation",
                    rowsIn: 7,
                    rowsOut: 5,
                    pending: 2,
                    durationMs: 3,
                },
            ],
            durationMs: 10,
            preview: [{ nome: "Lia Martins" }],
            pendingPreview: [{ nome: "Caio Lima" }],
        },
    };
}

afterEach(() => {
    for (const dir of folders.splice(0))
        fs.rmSync(dir, { recursive: true, force: true });
});

describe("resumo da execução no app", () => {
    it("salva números, etapas e motivos sem incluir registros nem a configuração", () => {
        const target = path.join(folder(), "resumo.txt");
        expect(saveRunSummary(record(), target)).toEqual({
            ok: true,
            path: target,
        });
        const text = fs.readFileSync(target, "utf8");
        expect(text).toContain("Data: 2026-10-15T12:00:00.000Z");
        expect(text).toContain("Tipo: Exportação");
        expect(text).toContain("Linhas lidas: 7");
        expect(text).toContain("validation: de 7 para 5, 2 pendências (3 ms)");
        expect(text).toContain("Linhas no resultado: 3");
        expect(text).toContain("Tempo total: 10 ms");
        expect(text).toContain("sem matrícula: 2");
        expect(text).not.toContain("Lia Martins");
        expect(text).not.toContain("Caio Lima");
        expect(text).not.toContain("config.json");
    });

    it("identifica a prévia sem dizer que os dados foram exportados", () => {
        const text = formatRunSummary(record(true));
        expect(text).toContain("Tipo: Prévia");
        expect(text).toContain("Nada foi gravado");
    });

    it("explica quando não há motivos de pendência", () => {
        const run = record();
        run.report = { ...run.report!, pendingRows: 0, pendingByReason: [] };
        expect(formatRunSummary(run)).toContain(
            "Nenhuma pendência nessa execução.",
        );
    });

    it("não cria arquivo para uma execução sem relatório ou com erro", () => {
        const target = path.join(folder(), "resumo.txt");
        for (const run of [
            { ...record(), report: undefined },
            { ...record(), ok: false },
        ]) {
            expect(saveRunSummary(run, target)).toMatchObject({ ok: false });
        }
        expect(fs.existsSync(target)).toBe(false);
    });

    it("retorna a falha de escrita para a tela", () => {
        const target = path.join(folder(), "ausente", "resumo.txt");
        expect(saveRunSummary(record(), target)).toMatchObject({
            ok: false,
            error: expect.stringContaining("Não consegui salvar o resumo"),
        });
    });
});
