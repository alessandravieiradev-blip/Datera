import { SinkWriteOptions } from "../types";

export const PENDING_SUFFIX = "_pendencias";

export interface TableTarget {
    table: string;
    pendingTable?: string | undefined;
}

export function pendingTableOf(target: TableTarget): string {
    return (
        target.pendingTable?.trim() || `${target.table.trim()}${PENDING_SUFFIX}`
    );
}

export function tableFor(
    target: TableTarget,
    options: SinkWriteOptions,
): string {
    return options.name === undefined
        ? target.table.trim()
        : pendingTableOf(target);
}
