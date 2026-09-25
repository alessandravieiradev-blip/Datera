import { Workbook } from "exceljs";
import { readBinaryFile, writeBinaryFile } from "../files";

type ExcelBuffer = Parameters<Workbook["xlsx"]["load"]>[0];

export async function openWorkbook(filePath: string): Promise<Workbook> {
    const workbook = new Workbook();
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
