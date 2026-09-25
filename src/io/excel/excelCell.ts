import type { CellValue as ExcelCellValue } from "exceljs";

type CellValue = string | number | null;

function isoDate(date: Date): string {
    const iso = date.toISOString();
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso;
}

export function fromExcelCell(value: ExcelCellValue | undefined): CellValue {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return value;
    if (typeof value === "string") return value === "" ? null : value;
    if (typeof value === "boolean") return String(value);
    if (value instanceof Date) return isoDate(value);

    if ("richText" in value) {
        return fromExcelCell(value.richText.map((part) => part.text).join(""));
    }
    if ("formula" in value || "sharedFormula" in value) {
        return fromExcelCell(value.result as ExcelCellValue | undefined);
    }
    if ("hyperlink" in value) {
        return fromExcelCell(value.text as ExcelCellValue);
    }
    return null;
}
