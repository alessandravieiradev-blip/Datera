const BOM = "\uFEFF";
const CANDIDATE_DELIMITERS = [",", ";", "\t", "|"];

export function stripBom(text: string): string {
    return text.startsWith(BOM) ? text.slice(1) : text;
}

export function detectDelimiter(text: string): string {
    let best = ",";
    let bestCount = 0;

    for (const delimiter of CANDIDATE_DELIMITERS) {
        let count = 0;
        let inQuotes = false;
        for (const char of text) {
            if (char === '"') inQuotes = !inQuotes;
            else if (!inQuotes && (char === "\n" || char === "\r")) break;
            else if (!inQuotes && char === delimiter) count++;
        }
        if (count > bestCount) {
            best = delimiter;
            bestCount = count;
        }
    }

    return best;
}

export function parseCsv(text: string, delimiter: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text.charAt(i);

        if (inQuotes) {
            if (char === '"' && text[i + 1] === '"') {
                field += '"';
                i++;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                field += char;
            }
            continue;
        }

        if (char === '"') {
            inQuotes = true;
        } else if (text.startsWith(delimiter, i)) {
            row.push(field);
            field = "";
            i += delimiter.length - 1;
        } else if (char === "\n" || char === "\r") {
            if (char === "\r" && text[i + 1] === "\n") i++;
            row.push(field);
            rows.push(row);
            row = [];
            field = "";
        } else {
            field += char;
        }
    }

    if (inQuotes) {
        throw new Error("CSV com aspas abertas que nunca fecham.");
    }

    if (field !== "" || row.length > 0) {
        row.push(field);
        rows.push(row);
    }

    return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

function escapeField(value: string, delimiter: string): string {
    const needsQuotes =
        value.includes(delimiter) ||
        value.includes('"') ||
        value.includes("\n") ||
        value.includes("\r") ||
        value !== value.trim();
    return needsQuotes ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: string[][], delimiter: string): string {
    return rows
        .map((row) =>
            row.map((value) => escapeField(value, delimiter)).join(delimiter),
        )
        .join("\r\n");
}
