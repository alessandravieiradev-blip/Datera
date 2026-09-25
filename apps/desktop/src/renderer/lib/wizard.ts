import type { RawConfig } from "../../shared/api";

export type SourceKind = "excel" | "csv" | "sheets" | "mysql";
export type DestinationKind = "excel" | "csv" | "sheets";

export interface WizardDraft {
    source: SourceKind | null;
    destination: DestinationKind | null;
    sourcePath: string;
    sourceSheet: string;
    sourceLink: string;
    destinationPath: string;
    destinationLink: string;
    destinationSheet: string;
    credentialsPath: string;
    host: string;
    port: string;
    user: string;
    password: string;
    database: string;
    table: string;
}

export const EMPTY_DRAFT: WizardDraft = {
    source: null,
    destination: null,
    sourcePath: "",
    sourceSheet: "",
    sourceLink: "",
    destinationPath: "",
    destinationLink: "",
    destinationSheet: "",
    credentialsPath: "",
    host: "localhost",
    port: "3306",
    user: "",
    password: "",
    database: "",
    table: "",
};

export function spreadsheetIdFrom(link: string): string {
    const match = link.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match?.[1] ?? link.trim();
}

export function usesGoogle(draft: WizardDraft): boolean {
    return draft.source === "sheets" || draft.destination === "sheets";
}

export function detailsProblem(draft: WizardDraft): string | null {
    if (draft.source === "excel" || draft.source === "csv") {
        if (!draft.sourcePath) return "Escolha o arquivo de onde ler.";
    }
    if (draft.source === "sheets" && !draft.sourceLink.trim())
        return "Cole o link da planilha de onde ler.";
    if (draft.source === "mysql") {
        if (!draft.host || !draft.user || !draft.database || !draft.table) {
            return "Preencha servidor, usuário, banco e tabela.";
        }
    }
    if (
        (draft.destination === "excel" || draft.destination === "csv") &&
        !draft.destinationPath
    ) {
        return "Escolha onde salvar o resultado.";
    }
    if (draft.destination === "sheets" && !draft.destinationLink.trim()) {
        return "Cole o link da planilha onde salvar.";
    }
    if (usesGoogle(draft) && !draft.credentialsPath)
        return "Escolha o arquivo de credenciais do Google.";
    if (
        draft.source === "sheets" &&
        draft.destination === "sheets" &&
        spreadsheetIdFrom(draft.sourceLink) ===
            spreadsheetIdFrom(draft.destinationLink)
    ) {
        if (!draft.sourceSheet.trim() || !draft.destinationSheet.trim()) {
            return "É a mesma planilha, então diga o nome da aba de onde ler e da aba do resultado.";
        }
        if (
            draft.sourceSheet.trim().toLowerCase() ===
            draft.destinationSheet.trim().toLowerCase()
        ) {
            return "A aba do resultado precisa ser diferente da aba de onde ele lê.";
        }
    }
    return null;
}

function optional(key: string, value: string): RawConfig {
    return value.trim() ? { [key]: value.trim() } : {};
}

function sourceOf(draft: WizardDraft): RawConfig {
    switch (draft.source) {
        case "excel":
            return {
                type: "excel",
                path: draft.sourcePath,
                ...optional("sheet", draft.sourceSheet),
            };
        case "csv":
            return { type: "csv", path: draft.sourcePath };
        case "sheets":
            return {
                type: "sheets",
                spreadsheetId: spreadsheetIdFrom(draft.sourceLink),
                ...optional("sheet", draft.sourceSheet),
            };
        default:
            return {
                type: "mysql",
                host: draft.host.trim(),
                port: Number(draft.port) || 3306,
                user: draft.user.trim(),
                ...optional("password", draft.password),
                database: draft.database.trim(),
                table: draft.table.trim(),
            };
    }
}

function destinationOf(draft: WizardDraft): RawConfig {
    switch (draft.destination) {
        case "excel":
            return { type: "excel", path: draft.destinationPath };
        case "csv":
            return { type: "csv", path: draft.destinationPath, delimiter: ";" };
        default:
            return {
                type: "sheets",
                spreadsheetId: spreadsheetIdFrom(draft.destinationLink),
                ...optional("sheet", draft.destinationSheet),
            };
    }
}

export function configFromDraft(draft: WizardDraft): RawConfig {
    return {
        source: sourceOf(draft),
        destination: destinationOf(draft),
        ...(usesGoogle(draft)
            ? { credentialsPath: draft.credentialsPath }
            : {}),
        mode: "raw",
    };
}
