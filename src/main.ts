import "dotenv/config";
import path from "path";
import { parseCli } from "./cli";
import { checkConfigFile, formatCheck, loadConfig } from "./config";
import { consoleLogger } from "./logger";
import { formatReport, parseMode, runEtl } from "./pipeline";

async function main(): Promise<void> {
    const cli = parseCli();
    const logger = consoleLogger;

    if (cli.command === "validate") {
        const check = checkConfigFile(cli.config);
        for (const line of formatCheck(cli.config, check)) {
            if (check.ok) logger.info(line);
            else logger.error(line);
        }
        if (!check.ok) process.exitCode = 1;
        return;
    }

    try {
        const configPath = path.resolve(cli.config);
        process.chdir(path.dirname(configPath));
        const config = loadConfig(configPath);
        const report = await runEtl(config, {
            mode: cli.mode === undefined ? undefined : parseMode(cli.mode),
            dryRun: cli.dryRun,
            logger,
        });

        if (report.dryRun && report.preview.length > 0) {
            logger.info(
                `Primeiras ${report.preview.length} linhas do resultado:`,
            );
            console.table(report.preview);
        }
        logger.info("");
        for (const line of formatReport(report)) logger.info(line);
        logger.info(
            report.written ? "ETL concluído com sucesso!" : "Teste concluído.",
        );
    } catch (error) {
        logger.error("Deu erro no ETL:", error);
        process.exitCode = 1;
    }
}

main();
