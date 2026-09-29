type SqliteModule = typeof import("node:sqlite");

export function loadSqlite(): SqliteModule {
    try {
        return require("node:sqlite") as SqliteModule;
    } catch {
        throw new Error(
            "Essa versão do Node não sabe usar SQLite. Atualize pro Node 22.13 ou mais novo.",
        );
    }
}
