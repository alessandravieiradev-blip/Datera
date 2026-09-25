import { TableRow } from "../../types";
import { Source } from "../types";
import { readTextFile } from "../files";

export interface JsonSourceOptions {
    path: string;
    recordsPath?: string | undefined;
}

type Json = unknown;

// objeto dentro de objeto vira coluna com ponto: { endereco: { cidade } } -> "endereco.cidade"
function flatten(value: Json, prefix: string, row: TableRow): void {
    if (value === null || value === undefined) {
        row[prefix] = null;
    } else if (Array.isArray(value)) {
        row[prefix] = value.every(
            (item) => typeof item !== "object" || item === null,
        )
            ? value.map((item) => String(item ?? "")).join(", ")
            : JSON.stringify(value);
    } else if (typeof value === "object") {
        for (const [key, inner] of Object.entries(value)) {
            flatten(inner, prefix ? `${prefix}.${key}` : key, row);
        }
    } else if (typeof value === "number" || typeof value === "string") {
        row[prefix] = value;
    } else {
        row[prefix] = String(value);
    }
}

export class JsonSource implements Source {
    constructor(private readonly options: JsonSourceOptions) {}

    async read(): Promise<TableRow[]> {
        let data: Json;
        try {
            data = JSON.parse(readTextFile(this.options.path));
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new Error(
                    `JSON inválido em ${this.options.path}: ${error.message}`,
                );
            }
            throw error;
        }

        // recordsPath tipo "dados.alunos" pra quando a lista ta dentro de outras chaves
        for (const key of this.options.recordsPath?.split(".") ?? []) {
            data =
                typeof data === "object" && data !== null
                    ? (data as Record<string, Json>)[key]
                    : undefined;
        }

        if (!Array.isArray(data)) {
            throw new Error(
                `O JSON em ${this.options.path} precisa ser uma lista de objetos` +
                    (this.options.recordsPath
                        ? ` em "${this.options.recordsPath}".`
                        : "."),
            );
        }

        return data.map((item, index) => {
            if (
                typeof item !== "object" ||
                item === null ||
                Array.isArray(item)
            ) {
                throw new Error(`O item ${index} do JSON não é um objeto.`);
            }
            const row: TableRow = {};
            flatten(item, "", row);
            return row;
        });
    }
}
