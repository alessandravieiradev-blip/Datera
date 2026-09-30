import { TableRow } from "../types";
import { SheetRows } from "./tabs";

export interface Source {
    read(): Promise<TableRow[]>;
    readTabs?(): Promise<SheetRows[]>;
    close?(): Promise<void>;
}

export interface SinkWriteOptions {
    name?: string | undefined;
}

export interface Sink {
    write(rows: TableRow[], options?: SinkWriteOptions): Promise<void>;
}
