import { TableRow } from "../types";
import { Mode } from "./modes";

export interface StepOutput {
    rows: TableRow[];
    pending?: TableRow[] | undefined;
}

export interface Step {
    name: string;
    run(rows: TableRow[]): StepOutput;
}

export interface StepReport {
    name: string;
    rowsIn: number;
    rowsOut: number;
    pending: number;
    durationMs: number;
}

export interface EtlReport {
    mode: Mode;
    dryRun: boolean;
    written: boolean;
    rowsRead: number;
    rowsOut: number;
    pendingRows: number;
    steps: StepReport[];
    durationMs: number;
    preview: TableRow[];
}
