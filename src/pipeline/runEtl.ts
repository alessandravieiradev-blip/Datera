import { EtlConfig } from "../config";
import { createSink, createSource } from "../io/factory";
import { loadAdapterModules } from "../io/custom/loader";
import { Sink, Source } from "../io/types";
import {
    DEFAULT_PENDING_SHEET,
    DEFAULT_REASON_COLUMN,
} from "../filters/validate";
import {
    loadNormalizerModules,
    registerBuiltinKeyNormalizers,
} from "../normalizers";
import { consoleLogger, Logger } from "../logger";
import { TableRow } from "../types";
import { Mode } from "./modes";
import { buildSteps } from "./steps";
import { EtlReport, PendingReason, StepReport } from "./types";

export const DEFAULT_PREVIEW_SIZE = 5;

export function countPendingReasons(
    pending: TableRow[],
    reasonColumn: string = DEFAULT_REASON_COLUMN,
): PendingReason[] {
    const counts = new Map<string, number>();
    for (const row of pending) {
        const text = row[reasonColumn];
        if (text === null || text === undefined) continue;
        for (const part of String(text).split(";")) {
            const reason = part.trim();
            if (reason === "") continue;
            counts.set(reason, (counts.get(reason) ?? 0) + 1);
        }
    }
    return Array.from(counts, ([reason, count]) => ({ reason, count })).sort(
        (a, b) => b.count - a.count || a.reason.localeCompare(b.reason),
    );
}

export interface RunEtlOptions {
    mode?: Mode | undefined;
    dryRun?: boolean | undefined;
    logger?: Logger | undefined;
    source?: Source | undefined;
    sink?: Sink | undefined;
    previewSize?: number | undefined;
}

export async function runEtl(
    config: EtlConfig,
    options: RunEtlOptions = {},
): Promise<EtlReport> {
    const startedAt = Date.now();
    const logger = options.logger ?? consoleLogger;
    const dryRun = options.dryRun ?? false;
    const mode = options.mode ?? config.mode;

    registerBuiltinKeyNormalizers();
    loadNormalizerModules(config.normalizerModules ?? []);
    loadAdapterModules(config.adapterModules ?? []);

    const steps = buildSteps(config, mode);
    const sink = options.sink ?? createSink(config, logger);
    const ownsSource = options.source === undefined;
    const source = options.source ?? createSource(config, logger);

    try {
        logger.info(
            dryRun ? `Modo em uso: ${mode} (só teste)` : `Modo em uso: ${mode}`,
        );
        const rawRows = await source.read();
        logger.info(`${rawRows.length} linhas lidas.`);

        let rows = rawRows;
        const pending: TableRow[] = [];
        const stepReports: StepReport[] = [];

        for (const step of steps) {
            const stepStartedAt = Date.now();
            const output = step.run(rows);
            const stepPending = output.pending ?? [];
            pending.push(...stepPending);
            stepReports.push({
                name: step.name,
                rowsIn: rows.length,
                rowsOut: output.rows.length,
                pending: stepPending.length,
                durationMs: Date.now() - stepStartedAt,
            });
            rows = output.rows;
        }

        if (!dryRun) {
            await sink.write(rows);
            if (config.validation) {
                await sink.write(pending, {
                    name:
                        config.validation.pendingSheet ?? DEFAULT_PENDING_SHEET,
                });
            }
        }

        return {
            mode,
            dryRun,
            written: !dryRun,
            rowsRead: rawRows.length,
            rowsOut: rows.length,
            pendingRows: pending.length,
            pendingByReason: countPendingReasons(
                pending,
                config.validation?.reasonColumn,
            ),
            steps: stepReports,
            durationMs: Date.now() - startedAt,
            preview: dryRun
                ? rows.slice(0, options.previewSize ?? DEFAULT_PREVIEW_SIZE)
                : [],
            pendingPreview: dryRun
                ? pending.slice(0, options.previewSize ?? DEFAULT_PREVIEW_SIZE)
                : [],
        };
    } finally {
        if (ownsSource) await source.close?.();
    }
}
