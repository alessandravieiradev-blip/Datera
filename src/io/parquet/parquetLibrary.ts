import { writeBinaryFile } from "../files";

export type ParquetColumnType = "STRING" | "INT32" | "DOUBLE";

export interface ParquetColumn {
    name: string;
    type: ParquetColumnType;
    data: (string | number | null)[];
}

export interface ParquetLibrary {
    read(filePath: string): Promise<Record<string, unknown>[]>;
    write(filePath: string, columns: ParquetColumn[]): Promise<void>;
}

export const parquetLibrary: ParquetLibrary = {
    async read(filePath) {
        const { asyncBufferFromFile, parquetReadObjects } =
            await import("hyparquet");
        const { compressors } = await import("hyparquet-compressors");
        const file = await asyncBufferFromFile(filePath);
        return (await parquetReadObjects({ file, compressors })) as Record<
            string,
            unknown
        >[];
    },

    async write(filePath, columns) {
        const { parquetWriteBuffer } = await import("hyparquet-writer");
        const buffer = parquetWriteBuffer({ columnData: columns });
        writeBinaryFile(filePath, Buffer.from(buffer));
    },
};
