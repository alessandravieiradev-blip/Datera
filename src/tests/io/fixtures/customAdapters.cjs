const fs = require("fs");

const linhasDeTexto = (options) => ({
    read: async () =>
        fs
            .readFileSync(options.path, "utf8")
            .split(/\r?\n/)
            .map((linha) => linha.trim())
            .filter((linha) => linha !== "")
            .map((linha) => ({ [options.column ?? "valor"]: linha })),
});

const escritas = [];
const memoria = () => ({
    write: async (rows, options = {}) => {
        escritas.push({ name: options.name ?? null, rows });
    },
});

module.exports = { sources: { linhasDeTexto }, sinks: { memoria }, escritas };
