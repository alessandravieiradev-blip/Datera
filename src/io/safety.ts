import path from "path";
import { EtlConfig } from "../config";
import { DEFAULT_PENDING_SHEET } from "../filters/validate";

function sameName(a: string, b: string): boolean {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function filePath(side: object): string | undefined {
    return "path" in side && typeof side.path === "string"
        ? side.path
        : undefined;
}

function assertSheetsAreSafe(config: EtlConfig): void {
    const source = config.source;
    const destination = config.destination ?? { type: "sheets" as const };
    if (source?.type !== "sheets" || destination.type !== "sheets") return;

    const destinationId = destination.spreadsheetId ?? config.spreadsheetId;
    if (source.spreadsheetId !== destinationId) return;

    if (source.sheet === undefined) {
        throw new Error(
            'A fonte e o destino são a mesma planilha. Coloque "sheet" na fonte com o nome da aba dos dados originais, senão ele pode ler e apagar a mesma aba.',
        );
    }
    if (destination.sheet === undefined) {
        throw new Error(
            'A fonte e o destino são a mesma planilha. Coloque "sheet" no destino com o nome da aba do resultado, senão ele grava na primeira aba, que pode ser a dos dados originais.',
        );
    }

    const pendingSheet = config.validation
        ? (config.validation.pendingSheet ?? DEFAULT_PENDING_SHEET)
        : undefined;
    for (const target of [destination.sheet, pendingSheet]) {
        if (target !== undefined && sameName(target, source.sheet)) {
            throw new Error(
                `A aba "${source.sheet}" é de onde o Datera lê, então ele não pode gravar nela. Escolha outro nome pra aba do resultado ou das pendências.`,
            );
        }
    }
}

function assertFilesAreSafe(config: EtlConfig): void {
    const sourcePath = config.source ? filePath(config.source) : undefined;
    const destinationPath = config.destination
        ? filePath(config.destination)
        : undefined;
    if (sourcePath === undefined || destinationPath === undefined) return;

    if (path.resolve(sourcePath) === path.resolve(destinationPath)) {
        throw new Error(
            `A fonte e o destino são o mesmo arquivo (${sourcePath}). O destino é apagado antes de gravar, então escolha outro arquivo pra saída.`,
        );
    }
}

export function assertSourceIsSafe(config: EtlConfig): void {
    assertSheetsAreSafe(config);
    assertFilesAreSafe(config);
}
