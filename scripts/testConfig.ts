import "dotenv/config";
import { loadConfig } from "../src/config";

function main() {
    try {
        const config = loadConfig("./config.json");
        console.log("Config carregada com sucesso: ", config);
    } catch (error) {
        console.error("Deu erro ao carregar config: ", error);
    }
}

main();
