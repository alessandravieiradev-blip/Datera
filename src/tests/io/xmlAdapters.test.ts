import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { XmlSource } from "../../io/xml/xmlSource";
import { XmlSink, xmlNameFor } from "../../io/xml/xmlSink";
import { parseXml } from "../../io/xml/xmlParse";
import { createMemoryLogger } from "../../logger";
import { etlConfigSchema } from "../../config";

function tempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "etl-xml-"));
}

function writeXml(content: string): string {
    const filePath = path.join(tempDir(), "alunos.xml");
    fs.writeFileSync(filePath, content);
    return filePath;
}

const ESCOLA = `<?xml version="1.0" encoding="UTF-8"?>
<!-- alunos da escola -->
<escola>
  <alunos>
    <aluno matricula="2024-0042">
      <nome>Lia Martins</nome>
      <email>lia@email.com</email>
      <plano>Mensal</plano>
      <instrumentos>
        <instrumento>violão</instrumento>
        <instrumento>ukulele</instrumento>
      </instrumentos>
      <endereco><cidade>Pelotas</cidade></endereco>
    </aluno>
    <aluno matricula="2024-0051">
      <nome>Theo Souza</nome>
      <email>theo@email.com</email>
      <plano/>
      <instrumentos><instrumento>bateria</instrumento></instrumentos>
      <endereco><cidade>Rio Grande</cidade></endereco>
    </aluno>
  </alunos>
</escola>
`;

describe("XmlSource", () => {
    it("vira uma linha por registro, com atributos, pontos e repetidos juntos", async () => {
        const file = writeXml(ESCOLA);
        const rows = await new XmlSource({
            path: file,
            recordsPath: "escola.alunos.aluno",
        }).read();

        expect(rows).toEqual([
            {
                matricula: "2024-0042",
                nome: "Lia Martins",
                email: "lia@email.com",
                plano: "Mensal",
                "instrumentos.instrumento": "violão, ukulele",
                "endereco.cidade": "Pelotas",
            },
            {
                matricula: "2024-0051",
                nome: "Theo Souza",
                email: "theo@email.com",
                plano: null,
                "instrumentos.instrumento": "bateria",
                "endereco.cidade": "Rio Grande",
            },
        ]);
    });

    it("sem recordsPath usa os elementos direto dentro da raiz", async () => {
        const file = writeXml(
            "<alunos><aluno><nome>Lia</nome></aluno><aluno><nome>Nina</nome></aluno></alunos>",
        );

        expect(await new XmlSource({ path: file }).read()).toEqual([
            { nome: "Lia" },
            { nome: "Nina" },
        ]);
    });

    it("entende entidades, CDATA e elemento com atributo e texto", async () => {
        const file = writeXml(
            '<alunos><aluno><nome>Duda &amp; Caio &#233;</nome><obs><![CDATA[toca <bem>]]></obs><plano tipo="promo">anual</plano></aluno></alunos>',
        );

        expect(await new XmlSource({ path: file }).read()).toEqual([
            {
                nome: "Duda & Caio é",
                obs: "toca <bem>",
                plano: "anual",
                "plano.tipo": "promo",
            },
        ]);
    });

    it("avisa quando o recordsPath não começa pela raiz", async () => {
        const file = writeXml(ESCOLA);

        await expect(
            new XmlSource({ path: file, recordsPath: "alunos.aluno" }).read(),
        ).rejects.toThrow('precisa começar com "escola"');
    });

    it("avisa quando não acha registro nenhum", async () => {
        const file = writeXml(ESCOLA);

        await expect(
            new XmlSource({
                path: file,
                recordsPath: "escola.professores.professor",
            }).read(),
        ).rejects.toThrow("Não achei nenhum registro");
    });

    it("dá uma mensagem clara com a linha quando o XML está quebrado", async () => {
        const file = writeXml(
            "<alunos>\n  <aluno><nome>Lia</aluno>\n</alunos>",
        );

        await expect(new XmlSource({ path: file }).read()).rejects.toThrow(
            "<nome> foi fechado com </aluno> (linha 2)",
        );
    });

    it("recusa DOCTYPE, que é por onde entram os ataques com XML", () => {
        expect(() =>
            parseXml(
                '<!DOCTYPE x [<!ENTITY y SYSTEM "file:///etc/passwd">]><x>&y;</x>',
            ),
        ).toThrow("DOCTYPE");
    });

    it("recusa & solto e entidade que não existe", () => {
        expect(() => parseXml("<x>Rock & Roll</x>")).toThrow("& solto");
        expect(() => parseXml("<x>&nada;</x>")).toThrow("&nada;");
    });
});

describe("XmlSink", () => {
    it("escreve com raiz e registro escolhidos e escapa o texto", async () => {
        const file = path.join(tempDir(), "saida", "resultado.xml");
        await new XmlSink(
            { path: file, root: "alunos", record: "aluno" },
            createMemoryLogger(),
        ).write([{ nome: "Duda & Caio", plano: "<anual>", cidade: null }]);

        expect(fs.readFileSync(file, "utf8")).toBe(
            [
                '<?xml version="1.0" encoding="UTF-8"?>',
                "<alunos>",
                "  <aluno>",
                "    <nome>Duda &amp; Caio</nome>",
                "    <plano>&lt;anual&gt;</plano>",
                "    <cidade/>",
                "  </aluno>",
                "</alunos>",
                "",
            ].join("\n"),
        );
    });

    it("usa registros e registro quando não informa os nomes", async () => {
        const file = path.join(tempDir(), "resultado.xml");
        await new XmlSink({ path: file }, createMemoryLogger()).write([
            { nome: "Lia" },
        ]);

        const text = fs.readFileSync(file, "utf8");
        expect(text).toContain("<registros>");
        expect(text).toContain("<registro>");
    });

    it("ajusta nomes de coluna que não valem em XML e avisa no log", async () => {
        const file = path.join(tempDir(), "resultado.xml");
        const logger = createMemoryLogger();
        await new XmlSink({ path: file }, logger).write([
            {
                "instrumento 1": "violão",
                instrumento_1: "piano",
                "1a aula": "sim",
            },
        ]);

        const text = fs.readFileSync(file, "utf8");
        expect(text).toContain("<instrumento_1>violão</instrumento_1>");
        expect(text).toContain("<instrumento_1_2>piano</instrumento_1_2>");
        expect(text).toContain("<_1a_aula>sim</_1a_aula>");
        expect(logger.messages.join("\n")).toContain(
            'A coluna "instrumento 1" virou <instrumento_1>',
        );
    });

    it("grava as pendências num arquivo do lado", async () => {
        const dir = tempDir();
        const file = path.join(dir, "resultado.xml");
        await new XmlSink({ path: file }, createMemoryLogger()).write(
            [{ nome: "Nina" }],
            { name: "Pendências" },
        );

        expect(fs.existsSync(path.join(dir, "resultado.pendencias.xml"))).toBe(
            true,
        );
    });

    it("o que ele escreve, ele lê de volta igual", async () => {
        const file = path.join(tempDir(), "resultado.xml");
        const rows = [
            {
                matricula: "2024-0042",
                nome: "Lia Martins",
                "endereco.cidade": "Pelotas",
                plano: null,
            },
            {
                matricula: "2024-0077",
                nome: "Duda <Alves> & cia",
                "endereco.cidade": "Canguçu",
                plano: "anual",
            },
        ];
        await new XmlSink({ path: file }, createMemoryLogger()).write(rows);

        expect(await new XmlSource({ path: file }).read()).toEqual(rows);
    });

    it("xmlNameFor deixa nome vazio com um nome padrão", () => {
        expect(xmlNameFor("   ")).toBe("coluna");
        expect(xmlNameFor("e-mail")).toBe("e-mail");
    });
});

describe("config do XML", () => {
    it("recusa nome de raiz ou registro que não vale em XML", () => {
        const result = etlConfigSchema.safeParse({
            mode: "raw",
            source: { type: "xml", path: "./alunos.xml" },
            destination: {
                type: "xml",
                path: "./saida/resultado.xml",
                root: "meus alunos",
            },
        });

        expect(result.success).toBe(false);
    });
});
