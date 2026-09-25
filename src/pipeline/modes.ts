import { EtlConfig } from "../config";
import { DedupeFilter } from "../filters/dedupe";
import { MergeFilter } from "../filters/merge";
import { Step } from "./types";

export const MODES = ["raw", "dedupe", "merge"] as const;
export type Mode = (typeof MODES)[number];

export function parseMode(value: string): Mode {
    const mode = MODES.find((known) => known === value);
    if (mode === undefined) {
        throw new Error(
            `Modo inválido: "${value}". Modos aceitos: ${MODES.join(", ")}.`,
        );
    }
    return mode;
}

export function buildModeStep(mode: Mode, config: EtlConfig): Step {
    switch (mode) {
        case "raw":
            return { name: "raw", run: (rows) => ({ rows }) };
        case "dedupe": {
            if (!config.dedupeColumn) {
                throw new Error(
                    "dedupeColumn não definido na config para o modo dedupe.",
                );
            }
            const filter = new DedupeFilter(
                config.dedupeColumn,
                config.dedupeStrategy,
            );
            return {
                name: "dedupe",
                run: (rows) => ({ rows: filter.apply(rows) }),
            };
        }
        case "merge": {
            if (!config.mergeKeyColumn || !config.mergeColumns) {
                throw new Error(
                    "mergeKeyColumn/mergeColumns não definidos na config para o modo merge.",
                );
            }
            const filter = new MergeFilter(
                config.mergeKeyColumn,
                config.mergeColumns,
                {
                    emptyKeyLabel: config.mergeEmptyKeyLabel,
                    rejectedKeyLabel: config.mergeRejectedKeyLabel,
                    keyNormalizer: config.mergeKeyNormalizer,
                },
            );
            return {
                name: "merge",
                run: (rows) => ({ rows: filter.apply(rows) }),
            };
        }
    }
}
