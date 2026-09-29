import type { Workbook } from "exceljs";
import { requireOptional } from "../optional";
import { readBinaryFile, writeBinaryFile } from "../files";

type ExcelBuffer = Parameters<Workbook["xlsx"]["load"]>[0];

export function createWorkbook(): Workbook {
    const exceljs = requireOptional<typeof import("exceljs")>(
        () => require("exceljs"),
        ["exceljs"],
        "Excel",
    );
    return new exceljs.Workbook();
}

export async function openWorkbook(filePath: string): Promise<Workbook> {
    const workbook = createWorkbook();
    await workbook.xlsx.load(
        readBinaryFile(filePath) as unknown as ExcelBuffer,
    );
    return workbook;
}

export async function saveWorkbook(
    workbook: Workbook,
    filePath: string,
): Promise<void> {
    const buffer = await workbook.xlsx.writeBuffer();
    writeBinaryFile(filePath, Buffer.from(buffer as unknown as Uint8Array));
}
