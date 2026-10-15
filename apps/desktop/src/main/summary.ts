import fs from "fs";
import { formatReport } from "../../../../src/pipeline/report";
import { RunRecord, TemplateResult } from "../shared/api";

export function formatRunSummary(record: RunRecord): string {
    if (!record.ok || !record.report) {
        throw new Error("Essa execução não tem um resumo para salvar.");
    }
    const lines = [
        "Datera",
        `Data: ${record.startedAt}`,
        `Tipo: ${record.dryRun ? "Prévia" : "Exportação"}`,
        "",
        ...formatReport(record.report),
        "",
        "Pendências por motivo",
    ];
    if (record.report.pendingByReason.length === 0) {
        lines.push("  Nenhuma pendência nessa execução.");
    } else {
        for (const { reason, count } of record.report.pendingByReason) {
            lines.push(`  ${reason}: ${count}`);
        }
    }
    return lines.join("\n") + "\n";
}

export function saveRunSummary(
    record: RunRecord,
    target: string,
): TemplateResult {
    try {
        fs.writeFileSync(target, formatRunSummary(record), "utf8");
        return { ok: true, path: target };
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return { ok: false, error: `Não consegui salvar o resumo: ${reason}` };
    }
}
