export function quoteTable(
    table: string,
    open: string,
    close: string = open,
): string {
    const parts = table.split(".").map((part) => part.trim());
    if (parts.some((part) => part === "")) {
        throw new Error(`Nome de tabela inválido: "${table}".`);
    }
    return parts
        .map(
            (part) => `${open}${part.split(close).join(close + close)}${close}`,
        )
        .join(".");
}
