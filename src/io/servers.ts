import { EtlConfig } from "../config";
import { SourceConfig } from "../config/ioSchema";

export type ServerType = "mysql" | "postgres" | "sqlserver";

export const DEFAULT_PORTS: Record<ServerType, number> = {
    mysql: 3306,
    postgres: 5432,
    sqlserver: 1433,
};

export interface ServerPlace {
    type: ServerType;
    host: string | undefined;
    port: number;
    user: string | undefined;
    password: string | undefined;
    database: string | undefined;
    table: string | undefined;
}

function sourceServer(config: EtlConfig): ServerPlace | undefined {
    if (config.sources !== undefined) return undefined;
    const source: SourceConfig = config.source ?? { type: "mysql" };
    if (
        source.type !== "mysql" &&
        source.type !== "postgres" &&
        source.type !== "sqlserver"
    )
        return undefined;
    const legacy = source.type === "mysql";
    return {
        type: source.type,
        host: source.host ?? (legacy ? config.dbHost : undefined),
        port:
            source.port ??
            (legacy ? config.dbPort : undefined) ??
            DEFAULT_PORTS[source.type],
        user: source.user ?? (legacy ? config.dbUser : undefined),
        password: source.password ?? (legacy ? config.dbPassword : undefined),
        database: source.database ?? (legacy ? config.dbName : undefined),
        table: source.table ?? (legacy ? config.tableName : undefined),
    };
}

function sameHost(a: string | undefined, b: string | undefined): boolean {
    return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

function isSameServer(
    source: ServerPlace,
    destination: {
        type: ServerType;
        host?: string | undefined;
        port?: number | undefined;
    },
): boolean {
    if (source.type !== destination.type) return false;
    if (destination.host === undefined) return destination.port === undefined;
    return (
        sameHost(source.host, destination.host) &&
        (destination.port ?? DEFAULT_PORTS[destination.type]) === source.port
    );
}

export function serverOf(
    config: EtlConfig,
    side: "source" | "destination",
): ServerPlace | undefined {
    const source = sourceServer(config);
    if (side === "source") return source;

    const destination = config.destination;
    if (
        destination?.type !== "mysql" &&
        destination?.type !== "postgres" &&
        destination?.type !== "sqlserver"
    )
        return undefined;
    const same =
        source !== undefined && isSameServer(source, destination)
            ? source
            : undefined;
    return {
        type: destination.type,
        host: destination.host ?? same?.host,
        port: destination.port ?? same?.port ?? DEFAULT_PORTS[destination.type],
        user: destination.user ?? same?.user,
        password: destination.password ?? same?.password,
        database: destination.database ?? same?.database,
        table: destination.table,
    };
}

export function destinationSharesSource(config: EtlConfig): boolean {
    const source = sourceServer(config);
    const destination = config.destination;
    if (
        source === undefined ||
        (destination?.type !== "mysql" &&
            destination?.type !== "postgres" &&
            destination?.type !== "sqlserver")
    )
        return false;
    return isSameServer(source, destination);
}
