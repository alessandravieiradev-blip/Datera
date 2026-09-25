import { TableRow } from "../types";

export interface Source {
    read(): Promise<TableRow[]>;
    close?(): Promise<void>;
}

export interface SinkWriteOptions {
    name?: string | undefined;
}

export interface Sink {
    write(rows: TableRow[], options?: SinkWriteOptions): Promise<void>;
}
