#!/usr/bin/env node
import "dotenv/config";
import { parseCli } from "./cli";
import { runCommand } from "./commands";
import { consoleLogger } from "./logger";

async function main(): Promise<void> {
    const cli = parseCli();
    try {
        process.exitCode = await runCommand(cli, consoleLogger);
    } catch (error) {
        consoleLogger.error(
            cli.command === "run" ? "Deu erro no ETL:" : "Deu erro:",
            error,
        );
        process.exitCode = 1;
    }
}

main();
