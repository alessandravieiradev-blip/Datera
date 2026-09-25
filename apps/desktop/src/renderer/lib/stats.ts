import type { EtlReport } from "../../../../../src";
import type { RunRecord } from "../../shared/api";

export interface RunStats {
    read: number;
    valid: number;
    pending: number;
    unified: number;
    result: number;
}

const GROUPING_STEPS = new Set(["dedupe", "merge"]);

export function statsOf(report: EtlReport): RunStats {
    const unified = report.steps
        .filter((step) => GROUPING_STEPS.has(step.name))
        .reduce((total, step) => total + (step.rowsIn - step.rowsOut), 0);
    return {
        read: report.rowsRead,
        valid: report.rowsRead - report.pendingRows,
        pending: report.pendingRows,
        unified,
        result: report.rowsOut,
    };
}

export function successfulRuns(history: RunRecord[]): RunRecord[] {
    return history.filter((record) => record.ok && record.report);
}

export function latestRun(history: RunRecord[]): RunRecord | undefined {
    const successful = successfulRuns(history);
    return successful.find((record) => !record.dryRun) ?? successful[0];
}

export function latestExport(history: RunRecord[]): RunRecord | undefined {
    return successfulRuns(history).find((record) => !record.dryRun);
}

export function exportsForChart(
    history: RunRecord[],
    limit: number,
): RunRecord[] {
    return successfulRuns(history)
        .filter((record) => !record.dryRun)
        .slice(0, limit)
        .reverse();
}
