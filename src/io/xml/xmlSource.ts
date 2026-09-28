import { TableRow } from "../../types";
import { Source } from "../types";
import { readTextFile } from "../files";
import { parseXml, XmlElement, XmlError } from "./xmlParse";

export interface XmlSourceOptions {
    path: string;
    recordsPath?: string | undefined;
}

function join(prefix: string, name: string): string {
    return prefix ? `${prefix}.${name}` : name;
}

function isSimple(element: XmlElement): boolean {
    return (
        element.children.length === 0 &&
        Object.keys(element.attributes).length === 0
    );
}

function groupByName(elements: XmlElement[]): Map<string, XmlElement[]> {
    const groups = new Map<string, XmlElement[]>();
    for (const element of elements) {
        const group = groups.get(element.name) ?? [];
        group.push(element);
        groups.set(element.name, group);
    }
    return groups;
}

function flatten(element: XmlElement, prefix: string, row: TableRow): void {
    for (const [name, value] of Object.entries(element.attributes)) {
        row[join(prefix, name)] = value === "" ? null : value;
    }

    if (prefix && element.children.length === 0) {
        if (element.text !== "") row[prefix] = element.text;
        else if (isSimple(element)) row[prefix] = null;
    }

    for (const [name, group] of groupByName(element.children)) {
        const key = join(prefix, name);
        const [first] = group;
        if (group.length === 1 && first) {
            flatten(first, key, row);
        } else if (group.every(isSimple)) {
            row[key] = group.map((item) => item.text).join(", ");
        } else {
            row[key] = JSON.stringify(
                group.map((item) => {
                    const inner: TableRow = {};
                    flatten(item, "", inner);
                    return inner;
                }),
            );
        }
    }
}

function findRecords(root: XmlElement, recordsPath: string): XmlElement[] {
    const [first, ...rest] = recordsPath.split(".");
    if (first !== root.name) {
        throw new Error(
            `O XML começa em <${root.name}>, então o recordsPath precisa começar com "${root.name}".`,
        );
    }
    let current = [root];
    for (const name of rest) {
        current = current.flatMap((element) =>
            element.children.filter((child) => child.name === name),
        );
    }
    return current;
}

export class XmlSource implements Source {
    constructor(private readonly options: XmlSourceOptions) {}

    async read(): Promise<TableRow[]> {
        let root: XmlElement;
        try {
            root = parseXml(readTextFile(this.options.path));
        } catch (error) {
            if (error instanceof XmlError) {
                throw new Error(
                    `XML inválido em ${this.options.path}: ${error.message}`,
                );
            }
            throw error;
        }

        const { recordsPath } = this.options;
        const records = recordsPath
            ? findRecords(root, recordsPath)
            : root.children;

        if (records.length === 0) {
            throw new Error(
                recordsPath
                    ? `Não achei nenhum registro em "${recordsPath}" no XML ${this.options.path}.`
                    : `O elemento <${root.name}> em ${this.options.path} não tem nenhum registro dentro. Se os registros estão mais para dentro, use recordsPath.`,
            );
        }

        return records.map((record) => {
            const row: TableRow = {};
            flatten(record, "", row);
            return row;
        });
    }
}
