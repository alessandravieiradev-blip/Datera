const NOT_FOUND = new Set(["MODULE_NOT_FOUND", "ERR_MODULE_NOT_FOUND"]);

function missing(packages: string[], feature: string): Error {
    const list = packages.join(" ");
    return new Error(
        `Pra usar ${feature}, o Datera precisa do pacote ${packages.map((name) => `"${name}"`).join(" e ")}. Rode "npm install ${list}" no seu projeto (ou "npm install -g ${list}" se você usa o comando datera instalado com -g).`,
    );
}

function isNotFound(error: unknown, packages: string[]): boolean {
    const code = (error as { code?: unknown })?.code;
    const message = error instanceof Error ? error.message : "";
    return (
        typeof code === "string" &&
        NOT_FOUND.has(code) &&
        packages.some((name) => message.includes(name))
    );
}

export function requireOptional<T>(
    load: () => unknown,
    packages: string[],
    feature: string,
): T {
    try {
        return load() as T;
    } catch (error) {
        if (isNotFound(error, packages)) throw missing(packages, feature);
        throw error;
    }
}

export async function importOptional<T>(
    load: () => Promise<T>,
    packages: string[],
    feature: string,
): Promise<T> {
    try {
        return await load();
    } catch (error) {
        if (isNotFound(error, packages)) throw missing(packages, feature);
        throw error;
    }
}
