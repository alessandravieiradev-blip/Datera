import { describe, it, expect } from "vitest";
import { etlConfigSchema } from "../../config";
import { Sink, SinkWriteOptions, Source } from "../../io/types";
import { registerSourceAdapter } from "../../io/custom/registry";
import { createMemoryLogger, silentLogger } from "../../logger";
import { countPendingReasons, formatReport, runEtl } from "../../pipeline";
import { TableRow } from "../../types";

const alunos: TableRow[] = [
    { Aluno: "Lia", Oficina: "Violão", Turma: "A" },
    { Aluno: "Theo", Oficina: "Bateria", Turma: null },
    { Aluno: "Lia", Oficina: "Canto", Turma: "B" },
    { Aluno: null, Oficina: "Flauta", Turma: "A" },
];

function memorySource(rows: TableRow[]): Source {
    return { read: async () => rows.map((row) => ({ ...row })) };
}

interface MemorySink extends Sink {
    writes: { name: string | null; rows: TableRow[] }[];
}

function memorySink(): MemorySink {
    const writes: MemorySink["writes"] = [];
    return {
        writes,
        write: async (rows: TableRow[], options: SinkWriteOptions = {}) => {
            writes.push({ name: options.name ?? null, rows });
        },
    };
}

const config = (extra: Record<string, unknown> = {}) =>
    etlConfigSchema.parse({
        mode: "raw",
        source: { type: "csv", path: "nao-usado.csv" },
        destination: { type: "csv", path: "nao-usado-saida.csv" },
        ...extra,
    });

describe("runEtl", () => {
    it("no modo raw lê, passa tudo e grava no destino", async () => {
        const sink = memorySink();
        const report = await runEtl(config(), {
            source: memorySource(alunos),
            sink,
            logger: silentLogger,
        });

        expect(sink.writes).toHaveLength(1);
        expect(sink.writes[0]?.rows).toEqual(alunos);
        expect(report).toMatchObject({
            mode: "raw",
            dryRun: false,
            written: true,
            rowsRead: 4,
            rowsOut: 4,
            pendingRows: 0,
            preview: [],
        });
        expect(report.steps.map((step) => step.name)).toEqual(["raw"]);
    });

    it("no dry-run faz tudo, mas não grava nada e devolve uma prévia", async () => {
        const sink = memorySink();
        const report = await runEtl(config(), {
            source: memorySource(alunos),
            sink,
            logger: silentLogger,
            dryRun: true,
            previewSize: 2,
        });

        expect(sink.writes).toHaveLength(0);
        expect(report.written).toBe(false);
        expect(report.preview).toEqual(alunos.slice(0, 2));
        expect(report.pendingPreview).toEqual([]);
    });

    it("roda as etapas na ordem e conta as linhas de cada uma", async () => {
        const sink = memorySink();
        const report = await runEtl(
            config({
                mode: "merge",
                fillEmpty: [{ column: "Turma", default: "sem turma" }],
                combineColumns: [
                    {
                        into: "Inscrição",
                        columns: ["Oficina", "Turma"],
                        separator: " / ",
                        keepSources: true,
                    },
                ],
                validation: { rules: [{ column: "Aluno", rule: "required" }] },
                mergeKeyColumn: "Aluno",
                mergeColumns: [{ column: "Inscrição", strategy: "concat" }],
            }),
            { source: memorySource(alunos), sink, logger: silentLogger },
        );

        expect(report.steps.map((step) => step.name)).toEqual([
            "fillEmpty",
            "combineColumns",
            "validation",
            "merge",
        ]);
        expect(report.steps[2]).toMatchObject({
            rowsIn: 4,
            rowsOut: 3,
            pending: 1,
        });
        expect(report.steps[3]).toMatchObject({ rowsIn: 3, rowsOut: 2 });
        expect(report.pendingRows).toBe(1);
        expect(report.pendingPreview).toEqual([]);
        expect(report.pendingByReason).toEqual([
            { reason: "Aluno vazio", count: 1 },
        ]);

        const [principal, pendencias] = sink.writes;
        expect(principal?.name).toBeNull();
        expect(principal?.rows[0]).toMatchObject({
            Aluno: "Lia",
            Inscrição: "Violão / A; Canto / B",
        });
        expect(pendencias?.name).toBe("Pendências");
        expect(pendencias?.rows[0]).toMatchObject({
            Motivo: "Aluno vazio",
            Oficina: "Flauta",
        });
    });

    it("o mode passado nas opções ganha do mode da config", async () => {
        const report = await runEtl(config({ dedupeColumn: "Aluno" }), {
            source: memorySource(alunos),
            sink: memorySink(),
            logger: silentLogger,
            mode: "dedupe",
        });

        expect(report.mode).toBe("dedupe");
        expect(report.rowsOut).toBe(3);
    });

    it("avisa antes de ler quando falta config do modo", async () => {
        let leu = false;
        const source: Source = {
            read: async () => {
                leu = true;
                return [];
            },
        };

        await expect(
            runEtl(config({ mode: "dedupe" }), {
                source,
                sink: memorySink(),
                logger: silentLogger,
            }),
        ).rejects.toThrow("dedupeColumn");
        expect(leu).toBe(false);
    });

    it("usa o logger que eu passar", async () => {
        const logger = createMemoryLogger();
        await runEtl(config(), {
            source: memorySource(alunos),
            sink: memorySink(),
            logger,
        });

        expect(logger.messages).toEqual([
            "Modo em uso: raw",
            "4 linhas lidas.",
        ]);
    });

    it("fecha a fonte que ele mesmo criou, mesmo se der erro", async () => {
        let fechou = false;
        let loggerRecebido: unknown;
        registerSourceAdapter("fonteQueQuebra", (_options, context) => {
            loggerRecebido = context.logger;
            return {
                read: async () => {
                    throw new Error("a fonte quebrou");
                },
                close: async () => {
                    fechou = true;
                },
            };
        });
        const logger = createMemoryLogger();

        await expect(
            runEtl(
                config({
                    source: { type: "custom", adapter: "fonteQueQuebra" },
                }),
                { sink: memorySink(), logger },
            ),
        ).rejects.toThrow("a fonte quebrou");
        expect(fechou).toBe(true);
        expect(loggerRecebido).toBe(logger);
    });
});

describe("runEtl no dry-run com pendências", () => {
    it("devolve uma prévia das pendências também", async () => {
        const report = await runEtl(
            config({
                validation: { rules: [{ column: "Aluno", rule: "required" }] },
            }),
            {
                source: memorySource(alunos),
                sink: memorySink(),
                logger: silentLogger,
                dryRun: true,
            },
        );

        expect(report.pendingPreview).toHaveLength(1);
        expect(report.pendingPreview[0]).toMatchObject({
            Motivo: "Aluno vazio",
            Oficina: "Flauta",
        });
    });
});

describe("countPendingReasons", () => {
    it("conta cada motivo separado, do mais comum pro menos comum", () => {
        const pendentes: TableRow[] = [
            { Motivo: "sem matrícula; e-mail fora do formato", Aluno: "Caio" },
            { Motivo: "e-mail fora do formato", Aluno: "Nina" },
            { Motivo: "plano com valor não permitido", Aluno: "Duda" },
            { Motivo: null, Aluno: "Theo" },
        ];

        expect(countPendingReasons(pendentes)).toEqual([
            { reason: "e-mail fora do formato", count: 2 },
            { reason: "plano com valor não permitido", count: 1 },
            { reason: "sem matrícula", count: 1 },
        ]);
    });

    it("usa a coluna de motivo que eu escolher", () => {
        expect(
            countPendingReasons([{ Problema: "sem oficina" }], "Problema"),
        ).toEqual([{ reason: "sem oficina", count: 1 }]);
    });
});

describe("formatReport", () => {
    it("monta o resumo com cada etapa e avisa quando é dry-run", () => {
        const lines = formatReport({
            mode: "merge",
            dryRun: true,
            written: false,
            rowsRead: 120,
            rowsOut: 85,
            pendingRows: 10,
            pendingByReason: [{ reason: "sem matrícula", count: 10 }],
            durationMs: 1250,
            preview: [],
            pendingPreview: [],
            steps: [
                {
                    name: "validation",
                    rowsIn: 120,
                    rowsOut: 110,
                    pending: 10,
                    durationMs: 3,
                },
                {
                    name: "merge",
                    rowsIn: 110,
                    rowsOut: 85,
                    pending: 0,
                    durationMs: 7,
                },
            ],
        });

        expect(lines).toEqual([
            "Resumo da execução",
            "  Modo: merge",
            "  Linhas lidas: 120",
            "  validation: de 120 para 110, 10 pendências (3 ms)",
            "  merge: de 110 para 85 (7 ms)",
            "  Linhas no resultado: 85",
            "  Pendências: 10",
            "  Tempo total: 1,3 s",
            "  Nada foi gravado, porque era só um teste (--dry-run).",
        ]);
    });
});
