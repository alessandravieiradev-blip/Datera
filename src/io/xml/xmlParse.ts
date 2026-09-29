export interface XmlElement {
    name: string;
    attributes: Record<string, string>;
    children: XmlElement[];
    text: string;
}

const NAMED_ENTITIES: Record<string, string> = {
    lt: "<",
    gt: ">",
    amp: "&",
    quot: '"',
    apos: "'",
};

const NAME = /^[^\s/>=<"'!?]+/;

export class XmlError extends Error {}

class Reader {
    private position = 0;

    constructor(private readonly text: string) {}

    get done(): boolean {
        return this.position >= this.text.length;
    }

    fail(message: string, at: number = this.position): never {
        const line = this.text.slice(0, at).split("\n").length;
        throw new XmlError(`${message} (linha ${line})`);
    }

    startsWith(value: string): boolean {
        return this.text.startsWith(value, this.position);
    }

    skip(value: string): void {
        if (!this.startsWith(value)) this.fail(`Esperava "${value}"`);
        this.position += value.length;
    }

    skipSpaces(): void {
        while (!this.done && /\s/.test(this.text[this.position] ?? "")) {
            this.position++;
        }
    }

    until(end: string, what: string): string {
        const found = this.text.indexOf(end, this.position);
        if (found === -1) this.fail(`${what} sem fechar`);
        const value = this.text.slice(this.position, found);
        this.position = found + end.length;
        return value;
    }

    textUntilTag(): string {
        const found = this.text.indexOf("<", this.position);
        const end = found === -1 ? this.text.length : found;
        const start = this.position;
        this.position = end;
        return decode(this.text.slice(start, end), this, start);
    }

    name(): string {
        const match = this.text.slice(this.position).match(NAME);
        if (!match) this.fail("Esperava o nome de um elemento ou atributo");
        this.position += match[0].length;
        return match[0];
    }

    quoted(): string {
        const quote = this.text[this.position];
        if (quote !== '"' && quote !== "'") {
            this.fail("O valor do atributo precisa estar entre aspas");
        }
        this.position++;
        const start = this.position;
        const value = this.until(quote, "Valor de atributo");
        if (value.includes("<")) this.fail("Atributo com < dentro", start);
        return decode(value, this, start);
    }
}

function decode(value: string, reader: Reader, at: number): string {
    return value.replace(/&([^;&\s]*);?/g, (whole, entity: string) => {
        if (!whole.endsWith(";")) reader.fail("Tem um & solto no texto", at);
        const named = Object.prototype.hasOwnProperty.call(
            NAMED_ENTITIES,
            entity,
        )
            ? NAMED_ENTITIES[entity]
            : undefined;
        if (named !== undefined) return named;
        const code = entity.startsWith("#x")
            ? parseInt(entity.slice(2), 16)
            : entity.startsWith("#")
              ? parseInt(entity.slice(1), 10)
              : NaN;
        if (Number.isNaN(code) || code > 0x10ffff) {
            reader.fail(`A entidade &${entity}; não existe`, at);
        }
        return String.fromCodePoint(code);
    });
}

function skipMarkup(reader: Reader): boolean {
    if (reader.startsWith("<?")) {
        reader.until("?>", "Instrução <?");
        return true;
    }
    if (reader.startsWith("<!--")) {
        reader.until("-->", "Comentário");
        return true;
    }
    if (reader.startsWith("<!DOCTYPE") || reader.startsWith("<!ENTITY")) {
        reader.fail(
            "O XML tem um <!DOCTYPE>, e o Datera não lê isso por segurança. Tire essa parte do arquivo",
        );
    }
    return false;
}

function readElement(reader: Reader): XmlElement {
    reader.skip("<");
    const element: XmlElement = {
        name: reader.name(),
        attributes: Object.create(null) as Record<string, string>,
        children: [],
        text: "",
    };

    for (;;) {
        reader.skipSpaces();
        if (reader.startsWith("/>")) {
            reader.skip("/>");
            return element;
        }
        if (reader.startsWith(">")) {
            reader.skip(">");
            break;
        }
        const attribute = reader.name();
        reader.skipSpaces();
        reader.skip("=");
        reader.skipSpaces();
        element.attributes[attribute] = reader.quoted();
    }

    const texts: string[] = [];
    for (;;) {
        if (reader.done) reader.fail(`O elemento <${element.name}> não fecha`);
        if (reader.startsWith("</")) {
            reader.skip("</");
            const closing = reader.name();
            if (closing !== element.name) {
                reader.fail(`<${element.name}> foi fechado com </${closing}>`);
            }
            reader.skipSpaces();
            reader.skip(">");
            element.text = texts.join("").trim();
            return element;
        }
        if (reader.startsWith("<![CDATA[")) {
            reader.skip("<![CDATA[");
            texts.push(reader.until("]]>", "Bloco CDATA"));
        } else if (!skipMarkup(reader)) {
            if (reader.startsWith("<"))
                element.children.push(readElement(reader));
            else texts.push(reader.textUntilTag());
        }
    }
}

export function parseXml(text: string): XmlElement {
    const reader = new Reader(text.replace(/^﻿/, ""));
    let root: XmlElement | undefined;

    for (;;) {
        reader.skipSpaces();
        if (reader.done) break;
        if (skipMarkup(reader)) continue;
        if (!reader.startsWith("<"))
            reader.fail("Tem texto fora do elemento principal");
        if (root) reader.fail("O XML tem mais de um elemento principal");
        root = readElement(reader);
    }

    if (!root) throw new XmlError("O arquivo não tem nenhum elemento XML.");
    return root;
}
