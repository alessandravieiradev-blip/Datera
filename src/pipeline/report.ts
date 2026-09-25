import { EtlReport } from "./types";

export function formatDuration(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)} ms`;
    return `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
}

function plural(count: number, one: string, many: string): string {
    return `${count} ${count === 1 ? one : many}`;
}

export function formatReport(report: EtlReport): string[] {
    const lines = [
        "Resumo da execução",
        `  Modo: ${report.mode}`,
        `  Linhas lidas: ${report.rowsRead}`,
    ];

    for (const step of report.steps) {
        const pending =
            step.pending > 0
                ? `, ${plural(step.pending, "pendência", "pendências")}`
                : "";
        lines.push(
            `  ${step.name}: de ${step.rowsIn} para ${step.rowsOut}${pending} (${formatDuration(step.durationMs)})`,
        );
    }

    lines.push(`  Linhas no resultado: ${report.rowsOut}`);
    lines.push(`  Pendências: ${report.pendingRows}`);
    lines.push(`  Tempo total: ${formatDuration(report.durationMs)}`);

    if (report.dryRun) {
        lines.push("  Nada foi gravado, porque era só um teste (--dry-run).");
    }
    return lines;
}
