import crypto from "crypto";
import path from "path";
import { EtlConfig } from "../../../../src";
import { compareSourceOf, serverOf } from "../../../../src/io/servers";

const SERVER_LABELS: Record<string, string> = {
    mysql: "Banco MySQL",
    postgres: "Banco PostgreSQL",
    sqlserver: "Banco SQL Server",
};

const FILE_LABELS: Record<string, string> = {
    csv: "Arquivo CSV",
    json: "Arquivo JSON",
    xml: "Arquivo XML",
    parquet: "Arquivo Parquet",
    excel: "Arquivo Excel",
    sqlite: "Arquivo SQLite",
};

export interface Route {
    source: string;
    destination: string;
}

interface Side {
    type: string;
    path?: string | undefined;
    table?: string | undefined;
    spreadsheetId?: string | undefined;
    sheet?: string | undefined;
    adapter?: string | undefined;
}

function describeSide(
    config: EtlConfig,
    side: "source" | "destination",
    value: Side,
    folder: string,
): string {
    const server = serverOf(config, side);
    if (server) {
        return `${SERVER_LABELS[server.type]} no servidor ${server.host ?? "?"}:${server.port}, banco ${server.database ?? "?"}, tabela ${server.table ?? "?"}`;
    }
    if (value.type === "sheets") {
        const id =
            value.spreadsheetId ??
            (side === "destination" ? config.spreadsheetId : undefined);
        return `Planilha do Google ${id ?? "?"}${value.sheet ? `, aba ${value.sheet}` : ""}`;
    }
    if (value.type === "custom") {
        return `Adapter próprio "${value.adapter ?? "?"}"`;
    }
    const label = FILE_LABELS[value.type] ?? value.type;
    const file = value.path ? path.resolve(folder, value.path) : "?";
    return value.type === "sqlite" && value.table
        ? `${label} ${file}, tabela ${value.table}`
        : `${label} ${file}`;
}

const HIDDEN =
    /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g;
const MAX_TEXT = 300;

function safeText(text: string): string {
    const clean = text.replace(HIDDEN, "?");
    return clean.length > MAX_TEXT ? `${clean.slice(0, MAX_TEXT)}…` : clean;
}

function withoutPassword(value: unknown): unknown {
    if (typeof value !== "object" || value === null) return value ?? null;
    return Object.fromEntries(
        Object.entries(value)
            .filter(([key]) => key !== "password")
            .sort(([a], [b]) => a.localeCompare(b)),
    );
}

function describeSources(
    config: EtlConfig,
    sources: NonNullable<EtlConfig["sources"]>,
    folder: string,
): string {
    return sources
        .map((source) => describeSide(config, "source", source, folder))
        .join(" + ");
}

function describeCompare(config: EtlConfig, folder: string): string {
    const other = compareSourceOf(config);
    if (other === undefined) return "";
    const side = describeSide(
        { ...config, source: other, sources: undefined, compare: undefined },
        "source",
        other,
        folder,
    );
    return `, comparando com ${side}`;
}

export function describeRoute(config: EtlConfig, folder: string): Route {
    const main = config.sources
        ? describeSources(config, config.sources, folder)
        : describeSide(
              config,
              "source",
              config.source ?? { type: "mysql" },
              folder,
          );
    const route = {
        source: `${main}${describeCompare(config, folder)}`,
        destination: describeSide(
            config,
            "destination",
            config.destination ?? { type: "sheets" },
            folder,
        ),
    };
    return {
        source: safeText(route.source),
        destination: safeText(route.destination),
    };
}

export function routeKey(route: Route, config: EtlConfig): string {
    const settings = {
        route,
        source: withoutPassword(config.source),
        sources: (config.sources ?? []).map(withoutPassword),
        compare: withoutPassword(config.compare?.with),
        summary: config.summary ?? null,
        output: {
            splitBy: config.splitBy ?? null,
            sheetBy: config.sheetBy ?? null,
            blocksBy: config.blocksBy ?? null,
        },
        destination: withoutPassword(config.destination),
        pendingSheet: config.validation?.pendingSheet ?? null,
        legacy: withoutPassword({
            tableName: config.tableName,
            spreadsheetId: config.spreadsheetId,
            credentialsPath: config.credentialsPath,
            dbHost: config.dbHost,
            dbPort: config.dbPort,
            dbUser: config.dbUser,
            dbName: config.dbName,
        }),
    };
    return crypto
        .createHash("sha256")
        .update(JSON.stringify(settings))
        .digest("hex");
}
