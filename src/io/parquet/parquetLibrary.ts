import { writeBinaryFile } from "../files";
import { importOptional } from "../optional";

const READ_PACKAGES = ["hyparquet", "hyparquet-compressors"];
const WRITE_PACKAGES = ["hyparquet-writer"];

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
            await importOptional(
                () => import("hyparquet"),
                READ_PACKAGES,
                "Parquet",
            );
        const { compressors } = await importOptional(
            () => import("hyparquet-compressors"),
            READ_PACKAGES,
            "Parquet",
        );
        const file = await asyncBufferFromFile(filePath);
        return (await parquetReadObjects({ file, compressors })) as Record<
            string,
            unknown
        >[];
    },

    async write(filePath, columns) {
        const { parquetWriteBuffer } = await importOptional(
            () => import("hyparquet-writer"),
            WRITE_PACKAGES,
            "Parquet",
        );
        const buffer = parquetWriteBuffer({ columnData: columns });
        writeBinaryFile(filePath, Buffer.from(buffer));
    },
};
