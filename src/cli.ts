import { Command } from "commander";

const program = new Command();

program
    .option("--config <caminho>", "Caminho para o arquivo de config do JSON.")
    .option("--mode <modo>", "Modo de execução do ETL (sobrescreve o mode do config.json).");
program.parse();

export const VALID_MODES = ["raw", "dedupe", "merge"] as const;
export type Mode = (typeof VALID_MODES)[number];

export function validateMode(value: string): Mode {
    if (!VALID_MODES.includes(value as Mode)) {
        console.error(`Modo inválido: "${value}". Modos aceitos: ${VALID_MODES.join(", ")}`);
        process.exit(1);
    }
    return value as Mode;
}

export const options = program.opts();