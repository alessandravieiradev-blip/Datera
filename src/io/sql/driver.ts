export function loadDriver<T>(
    load: () => unknown,
    packageName: string,
    label: string,
): T {
    try {
        return load() as T;
    } catch (error) {
        const code = (error as { code?: unknown })?.code;
        if (code === "MODULE_NOT_FOUND") {
            throw new Error(
                `Pra ler de ${label}, o pacote "${packageName}" precisa estar instalado. Rode: npm install ${packageName}`,
            );
        }
        throw error;
    }
}
