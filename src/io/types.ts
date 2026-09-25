import { TableRow } from "../types";

// qualquer lugar de onde da pra ler linhas (banco, arquivo csv, json...)
export interface Source {
    read(): Promise<TableRow[]>;
    close?(): Promise<void>;
}

export interface SinkWriteOptions {
    // nome da saida extra, tipo a aba de pendencias. sem nome e a saida principal
    name?: string | undefined;
}

// qualquer lugar pra onde da pra escrever linhas (planilha, arquivo csv, json...)
export interface Sink {
    write(rows: TableRow[], options?: SinkWriteOptions): Promise<void>;
}
