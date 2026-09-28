const TYPE_NAMES: Record<string, string> = {
    string: "texto",
    number: "número",
    boolean: "true ou false",
    array: "lista",
    object: "objeto",
};

export interface IssueLike {
    code: string;
    message: string;
    expected?: unknown;
    values?: unknown;
}

export function translateIssue(issue: IssueLike): string {
    const expected =
        typeof issue.expected === "string"
            ? (TYPE_NAMES[issue.expected] ?? issue.expected)
            : "";
    switch (issue.code) {
        case "invalid_type":
            return /received undefined/.test(issue.message)
                ? `Campo obrigatório (${expected}).`
                : `Tipo errado: aqui vai ${expected}.`;
        case "invalid_value":
            return Array.isArray(issue.values)
                ? `Valor não aceito. Use um destes: ${issue.values.map((value) => JSON.stringify(value)).join(", ")}.`
                : "Valor não aceito.";
        case "invalid_union":
            return "Valor não aceito aqui. Confira o type e os campos obrigatórios.";
        case "too_small":
            return "Não pode ficar vazio.";
        case "unrecognized_keys":
            return "Tem campos que o Datera não conhece.";
        default:
            return issue.message;
    }
}
