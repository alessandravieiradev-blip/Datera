export interface Snippet {
    id: string;
    label: string;
    text: string;
}

export const SNIPPETS: Snippet[] = [
    {
        id: "fonte-csv",
        label: "Fonte: CSV",
        text: '"source": { "type": "csv", "path": "./dados.csv" }',
    },
    {
        id: "fonte-excel",
        label: "Fonte: Excel",
        text: '"source": { "type": "excel", "path": "./dados.xlsx", "sheet": "Planilha1" }',
    },
    {
        id: "fonte-json",
        label: "Fonte: JSON",
        text: '"source": { "type": "json", "path": "./dados.json" }',
    },
    {
        id: "fonte-sheets",
        label: "Fonte: Google Planilhas",
        text: '"source": { "type": "sheets", "spreadsheetId": "ID_DA_PLANILHA", "sheet": "Aba" }',
    },
    {
        id: "fonte-mysql",
        label: "Fonte: MySQL",
        text: '"source": { "type": "mysql", "host": "localhost", "port": 3306, "user": "usuario", "database": "banco", "table": "tabela" }',
    },
    {
        id: "destino-excel",
        label: "Destino: Excel",
        text: '"destination": { "type": "excel", "path": "./saida/resultado.xlsx" }',
    },
    {
        id: "destino-csv",
        label: "Destino: CSV",
        text: '"destination": { "type": "csv", "path": "./saida/resultado.csv", "delimiter": ";" }',
    },
    {
        id: "destino-json",
        label: "Destino: JSON",
        text: '"destination": { "type": "json", "path": "./saida/resultado.json" }',
    },
    {
        id: "destino-sheets",
        label: "Destino: Google Planilhas",
        text: '"destination": { "type": "sheets", "spreadsheetId": "ID_DA_PLANILHA", "sheet": "Resultado" }',
    },
    {
        id: "regra-vazio",
        label: "Regra: campo obrigatório",
        text: '{ "column": "coluna", "rule": "required", "message": "Campo vazio" }',
    },
    {
        id: "regra-formato",
        label: "Regra: formato (regex)",
        text: '{ "column": "coluna", "rule": "pattern", "pattern": "^\\\\d{5}-?\\\\d{3}$", "message": "Formato inválido" }',
    },
    {
        id: "regra-lista",
        label: "Regra: lista de valores",
        text: '{ "column": "coluna", "rule": "oneOf", "values": ["a", "b"], "ignoreCase": true }',
    },
    {
        id: "regra-normalizador",
        label: "Regra: normalizador",
        text: '{ "column": "coluna", "rule": "normalizer", "normalizer": "digitsOnly" }',
    },
    {
        id: "merge-concat",
        label: "Merge: juntar valores (concat)",
        text: '{ "column": "coluna", "strategy": "concat", "separator": "; " }',
    },
    {
        id: "merge-extra",
        label: "Merge: colunas extras",
        text: '{ "column": "coluna", "strategy": "extra-column" }',
    },
    {
        id: "merge-distribute",
        label: "Merge: distribuir em colunas",
        text: '{ "column": "item 1", "strategy": "concat", "distribute": { "columns": ["item 1", "item 2"], "overflowInto": "outros" } }',
    },
    {
        id: "fill-empty",
        label: "Preencher vazio (fillEmpty)",
        text: '{ "column": "coluna", "fallbackColumns": ["outra"], "default": "não informado" }',
    },
    {
        id: "combine",
        label: "Juntar colunas (combineColumns)",
        text: '{ "into": "nova", "columns": ["a", "b"], "separator": " " }',
    },
];

export const NEW_CONFIG = {
    source: { type: "csv", path: "./dados.csv" },
    destination: { type: "excel", path: "./saida/resultado.xlsx" },
    mode: "raw",
};
