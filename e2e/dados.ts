import type { EtlReport } from "../src";
import type { RunRecord } from "../apps/desktop/src/shared/api";

export const CONFIG_PATH = "C:\\Users\\voce\\escola\\config.json";

export const CONFIG = {
    source: { type: "csv", path: "./alunos.csv" },
    destination: { type: "excel", path: "./saida/resultado.xlsx" },
    mode: "dedupe",
    dedupeColumn: "email",
    dedupeKeyNormalizer: "lowercase",
    fillEmpty: [{ column: "cidade", default: "não informada" }],
    validation: {
        rules: [
            {
                column: "matricula",
                rule: "required",
                message: 'Campo "matricula" vazio',
            },
            {
                column: "email",
                rule: "pattern",
                pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$",
                message: 'E-mail inválido em "email"',
            },
            {
                column: "plano",
                rule: "oneOf",
                values: ["mensal", "trimestral", "anual"],
                ignoreCase: true,
            },
        ],
    },
};

export const COLUNAS = [
    "matricula",
    "nome",
    "email",
    "instrumento",
    "plano",
    "cidade",
];

const RESULTADO = [
    {
        matricula: "2024-0042",
        nome: "Lia Martins",
        email: "lia@email.com",
        instrumento: "violão",
        plano: "mensal",
        cidade: "Pelotas",
    },
    {
        matricula: "2024-0051",
        nome: "Theo Souza",
        email: "theo@email.com",
        instrumento: "bateria",
        plano: "anual",
        cidade: "Rio Grande",
    },
    {
        matricula: "2024-0077",
        nome: "Duda Alves",
        email: "duda@email.com",
        instrumento: "voz",
        plano: "mensal",
        cidade: "não informada",
    },
];

const PENDENCIAS = [
    {
        Motivo: 'E-mail inválido em "email"',
        matricula: "2024-0060",
        nome: "Nina Rocha",
        email: "nina.email.com",
        instrumento: "piano",
        plano: "trimestral",
        cidade: "Pelotas",
    },
    {
        Motivo: 'Campo "matricula" vazio',
        matricula: null,
        nome: "Caio Lima",
        email: "caio@email.com",
        instrumento: "voz",
        plano: "mensal",
        cidade: "Canguçu",
    },
];

export function relatorio(dryRun: boolean): EtlReport {
    return {
        mode: "dedupe",
        dryRun,
        written: !dryRun,
        rowsRead: 7,
        rowsOut: 3,
        pendingRows: 2,
        pendingByReason: [
            { reason: 'E-mail inválido em "email"', count: 1 },
            { reason: 'Campo "matricula" vazio', count: 1 },
        ],
        steps: [
            {
                name: "fillEmpty",
                rowsIn: 7,
                rowsOut: 7,
                pending: 0,
                durationMs: 1,
            },
            {
                name: "validation",
                rowsIn: 7,
                rowsOut: 5,
                pending: 2,
                durationMs: 2,
            },
            {
                name: "dedupe",
                rowsIn: 5,
                rowsOut: 3,
                pending: 0,
                durationMs: 1,
            },
        ],
        durationMs: 18,
        preview: dryRun ? RESULTADO : [],
        pendingPreview: dryRun ? PENDENCIAS : [],
    };
}

export function historico(): RunRecord[] {
    const dias = ["2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22"];
    return dias
        .map((dia, indice) => {
            const report = relatorio(false);
            report.pendingRows = 6 - indice;
            return {
                id: `execucao-${indice}`,
                startedAt: `${dia}T09:00:00.000Z`,
                dryRun: false,
                configPath: CONFIG_PATH,
                sourceLabel: "Arquivo CSV",
                destinationLabel: "Arquivo Excel",
                ok: true,
                report,
            };
        })
        .reverse();
}

export const MODULO = `const matriculaComOitoDigitos = (valor) => {
    const digitos = String(valor).replace(/\\D/g, "");
    if (digitos.length !== 8) return null;
    return { key: digitos };
};

module.exports = {
    normalizers: { matriculaComOitoDigitos },
};
`;
