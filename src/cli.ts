import { Command } from "commander";

export interface CliOptions {
    config: string;
    mode?: string | undefined;
    dryRun: boolean;
}

export function parseCli(argv: string[] = process.argv): CliOptions {
    const program = new Command();

    program
        .name("datera")
        .option(
            "--config <caminho>",
            "Caminho para o arquivo de config do JSON.",
            "./config.json",
        )
        .option(
            "--mode <modo>",
            "Modo de execução do ETL (sobrescreve o mode do config.json).",
        )
        .option(
            "--dry-run",
            "Roda tudo e mostra o resultado, mas não grava nada no destino.",
        );
    program.parse(argv);

    const options = program.opts<{
        config: string;
        mode?: string;
        dryRun?: boolean;
    }>();
    return {
        config: options.config,
        mode: options.mode,
        dryRun: options.dryRun ?? false,
    };
}
