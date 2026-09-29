<p align="center">
  <a href="../README.md"><img src="https://img.shields.io/badge/In%C3%ADcio-475569?style=for-the-badge" alt="Início"></a>
  <a href="gestores.md"><img src="https://img.shields.io/badge/Para%20gestores-2563EB?style=for-the-badge" alt="Guia para gestores"></a>
  <a href="devs.md"><img src="https://img.shields.io/badge/Para%20devs-16181D?style=for-the-badge" alt="Guia para devs"></a>
</p>

# Guia para devs

Aqui fica tudo pra quem vai rodar pelo terminal, montar a config na mão, usar o Datera Dev ou chamar o Datera de dentro de outro código.

## Sumário

- [Teste em 1 minuto](#teste-em-1-minuto)
- [Instalação](#instalação)
- [Rodando](#rodando)
- [Os dois apps](#os-dois-apps)
- [Usando dentro de outro código](#usando-dentro-de-outro-código)
- [Testes](#testes)
- [Referência](#referência)

## Teste em 1 minuto

Pra testar não precisa de banco nem de conta no Google. Deixei um CSV de exemplo na pasta `examples/`, com alunos de uma escola de música inventada (tem cadastro repetido, e-mail errado e um plano que não existe):

```bash
npm install
npm run example
```

Ele lê o `examples/alunos.csv` e gera dois arquivos em `examples/saida/`. O `resultado.csv` fica com os cadastros já juntados:

| matricula | nome        | nome_2 | email            | instrumento 1 | instrumento 2 | plano  | cidade        | outros instrumentos |
| --------- | ----------- | ------ | ---------------- | ------------- | ------------- | ------ | ------------- | ------------------- |
| 2024-0042 | Lia Martins | Lia M. | `lia@email.com`  | violão        | ukulele       | Mensal | Pelotas       | piano               |
| 2024-0051 | Theo Souza  |        | `theo@email.com` | bateria       |               | anual  | Rio Grande    |                     |
| 2024-0077 | Duda Alves  |        | `duda@email.com` | voz           | violino       | mensal | não informada |                     |

E o `resultado.pendencias.csv` fica com o que precisa de alguém dar uma olhada:

| Motivo                        | matricula | nome       | email            | instrumento 1 | instrumento 2 | plano      | cidade  |
| ----------------------------- | --------- | ---------- | ---------------- | ------------- | ------------- | ---------- | ------- |
| e-mail fora do formato        | 2024-0060 | Nina Rocha | nina.email.com   | piano         |               | trimestral | Pelotas |
| sem matrícula                 |           | Caio Lima  | `caio@email.com` | voz           |               | mensal     | Canguçu |
| plano com valor não permitido | 2024-0077 | Duda Alves | `duda@email.com` | flauta        | voz           | semanal    | Pelotas |

Quem faz tudo isso é a `examples/config.csv.json`. Vale abrir ela do lado dos arquivos. Dá pra ver que `2024-0042` e `20240042` viraram a mesma aluna por causa do normalizador `digitsOnly`, que os instrumentos foram espalhados em colunas pelo `distribute` e que a cidade vazia virou `não informada` por causa do `fillEmpty`.

Se você prefere ver em Excel, roda `npm run example:excel`. Ele faz a mesma coisa mas gera um `examples/saida/resultado.xlsx`, com os alunos numa aba e as pendências em outra. E pra ver com XML, roda `npm run example:xml`, que lê o `examples/alunos.xml` (os mesmos alunos, só que em XML) e gera um `examples/saida/resultado.xml`.

## Instalação

```bash
npm install
```

Depois é configurar. Os campos todos estão em [Configuração](configuracao.md).

## Rodando

```bash
npm start
```

Ele lê da fonte, aplica o que está na config e escreve no destino.

Pra só conferir a config, sem ler nem gravar nada:

```bash
npm run validate -- ./config.json
```

Ele avisa se o JSON tem erro, se falta algum campo ou tem valor que não existe, e se algum arquivo citado (a fonte, as credenciais, os normalizadores e os adapters) não está no lugar. Os caminhos contam a partir da pasta da config, igual na hora de rodar. Se tiver problema, ele termina com código 1, então dá pra usar num script antes de rodar de verdade. As variáveis do `.env` não entram nessa conferência.

Pra trocar o modo sem mexer no `config.json`:

```bash
npm start -- --mode dedupe
```

Pra usar outro arquivo de config:

```bash
npm start -- --config ./outro-config.json
```

Os caminhos que estão dentro da config (arquivos, credenciais, normalizadores) contam a partir da pasta onde a config está. Por isso a `examples/config.csv.json` usa só `./alunos.csv`.

Se você quer ver o que vai sair antes de mexer na planilha de verdade, usa o `--dry-run`. Ele faz tudo igualzinho, só que não grava nada, e no fim mostra as primeiras linhas do resultado numa tabelinha:

```bash
npm start -- --dry-run
```

Com o exemplo dá pra testar assim: `npm run example -- --dry-run`.

No final de toda execução aparece um resumo com quantas linhas entraram e saíram de cada etapa. Esse é o do exemplo:

```text
Resumo da execução
  Modo: merge
  Linhas lidas: 7
  fillEmpty: de 7 para 7 (0 ms)
  validation: de 7 para 4, 3 pendências (1 ms)
  merge: de 4 para 3 (0 ms)
  Linhas no resultado: 3
  Pendências: 3
  Tempo total: 5 ms
```

Isso ajuda bastante quando o resultado vem estranho, porque dá pra ver em qual etapa as linhas sumiram.

Se der erro, ele mostra a mensagem e termina com código 1. Então dá pra colocar num script ou num agendador sem ele fingir que deu tudo certo.

Uma coisa importante: toda vez que roda, ele limpa a aba antes de escrever (a primeira aba e a de pendências, se tiver `validation`). Assim não sobra linha velha. Então não deixa anotação sua nessas abas, usa outra aba.

### O comando `datera`

Dá pra instalar o Datera como um comando do sistema, pra rodar de qualquer pasta sem `npm start` e sem o `tsx`:

```bash
npm run build
npm link
```

O `build` compila o TypeScript pra JavaScript na pasta `dist/`, e o `npm link` registra o comando `datera` no seu computador apontando pra essa pasta. Depois disso, em qualquer terminal:

```bash
datera run ./escola/config.json
datera run ./escola/config.json --dry-run
datera validate ./escola/config.json
datera --help
```

O `run` pode ficar de fora (`datera ./escola/config.json` faz a mesma coisa), e sem caminho nenhum ele usa a `config.json` da pasta onde você está. O `--mode` e o `--dry-run` funcionam igual ao `npm start`. Ele também lê o `.env` que estiver do lado da config, então dá pra ter uma pasta por projeto, cada uma com a sua config e o seu `.env`.

Quando mudar o código, roda `npm run build` de novo pro comando pegar a mudança. Pra desinstalar, `npm unlink -g datera`.

Além do `run` e do `validate`, ele tem comandos que não precisam de config nenhuma: `convert` (troca o formato de um arquivo), `dedupe` (tira repetidos), `merge` (junta cadastros), `columns` (raio-x das colunas), `preview` (primeiras linhas), `init` (cria uma config pra começar) e `normalize` (testa um normalizador). Estão todos explicados, com exemplos, em [Comandos e API](api.md).

## Os dois apps

Os dois apps ficam em `apps/` e usam o mesmo motor e o mesmo `config.json` do terminal. A config que você faz num serve no outro.

### Datera (o app para gestores)

```bash
npm run desktop
```

É o app com passo a passo, regras em frases, gráficos e histórico. O que ele faz pela tela está no [guia para gestores](gestores.md). Ele fica em `apps/desktop` e é feito com Electron e React.

Umas coisas que valem pra quem programa:

- o merge com estratégia por coluna e as regras por grupo ainda só dão pra configurar no arquivo, e o app não estraga essas partes quando salva
- no app instalado, normalizador em `.ts` não funciona, só em `.cjs` ou `.js`. O que o próprio app cria já é `.cjs`
- os normalizadores são lidos de novo a cada execução, então dá pra editar o arquivo sem fechar o app

### Datera Dev

Tem uma segunda versão do app, pensada pra quem programa. Ela usa o mesmo motor e o mesmo `config.json`, mas no lugar dos gráficos e do passo a passo tem um editor da configuração e a saída detalhada, tudo no teclado.

```bash
npm run desktop:dev
```

O que tem nele:

- editor do `config.json` com cores, número de linha e erro marcado na linha certa enquanto você digita (se faltar um campo ou o valor não existir, ele mostra onde e por quê, em português)
- prévia com `Ctrl+Enter`, usando o que está no editor mesmo sem salvar
- saída em abas: Resultado, Pendências (com a contagem por motivo), Log (com o tempo de cada etapa) e Problemas
- os arquivos de normalizador abrem em outra aba, com um testador do lado: você digita uns valores e vê na hora o que cada um vira
- paleta de comandos com `Ctrl+K`, com tudo que o app faz, inclusive trechos prontos de configuração pra inserir (fonte, destino, regra, merge...)
- um comando que copia o comando equivalente do terminal

Os atalhos principais: `Ctrl+Enter` prévia, `Ctrl+Shift+Enter` exportar, `Ctrl+S` salvar, `Shift+Alt+F` formatar o JSON, `Ctrl+1` a `Ctrl+4` trocam a aba da saída e `Ctrl+Shift+L` troca o tema.

O visual é escuro por padrão e segue a identidade do Datera de um jeito mais seco. Deixei explicado em `apps/dev/IDENTIDADE.md`. O instalador sai com `npm run dist -w apps/dev`.

### Gerando os instaladores

```bash
npm run dist -w apps/desktop
npm run dist -w apps/dev
```

Eles saem em `apps/desktop/release/Datera-Setup-0.1.0.exe` e `apps/dev/release/Datera-Dev-Setup-0.1.0.exe`. É bom pra testar o instalador antes de publicar. Como ele não é assinado (assinatura custa caro), o Windows pode mostrar "O Windows protegeu o computador". Aí é clicar em "Mais informações" e depois em "Executar assim mesmo".

### Publicando uma versão

Ninguém precisa gerar o instalador na mão pra publicar. Quando chega uma tag que começa com `v` no GitHub, a action `.github/workflows/release.yml` roda num Windows, confere a versão, roda os testes, gera os dois instaladores e cria a release na aba [Releases](https://github.com/alessandravieiradev-blip/datera/releases) com os dois `.exe` e a lista do que mudou.

O passo a passo:

1. Troca o `version` do `package.json` da raiz, do `apps/desktop/package.json` e do `apps/dev/package.json` pro número novo (os três iguais, porque o `datera --version` também mostra esse número)
2. Faz o commit e o push
3. Cria a tag com o mesmo número e manda ela:

```bash
git tag v0.2.0
git push origin v0.2.0
```

Leva uns 10 minutos, e dá pra acompanhar na aba Actions. Se a versão da tag não bater com a dos dois `package.json`, ele para antes de gerar qualquer coisa e explica o que ajustar. Tag com hífen, tipo `v0.2.0-beta.1`, sai marcada como pré-lançamento.

O texto que aparece no começo de toda release (qual arquivo baixar e o aviso do Windows) fica em `.github/release-notes.md`.

## Usando dentro de outro código

Também dá pra chamar o Datera de dentro de outro projeto, sem ser pelo terminal. Tem funções prontas pra ler e gravar qualquer formato, limpar dados que já estão na memória, tirar repetidos e juntar cadastros, todas em [Comandos e API](api.md). Aqui fica o jeito de rodar uma config inteira, que é o mesmo código que o `npm start` usa por baixo:

```ts
import { formatReport, loadConfig, runEtl } from "./src";

async function rodar() {
    const config = loadConfig("./config.json");
    const report = await runEtl(config, { dryRun: true });

    console.log(formatReport(report).join("\n"));
    console.log(report.preview);
}

rodar();
```

O `runEtl` devolve um relatório com as mesmas informações do resumo (`rowsRead`, `rowsOut`, `pendingRows`, `steps` e `durationMs`). No dry-run ele também traz as primeiras linhas do resultado em `preview`.

As opções que ele aceita:

| Opção            | O que faz                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `mode`           | troca o modo, igual o `--mode`                                                                                                       |
| `dryRun`         | faz tudo mas não grava nada                                                                                                          |
| `logger`         | pra onde vão as mensagens. O padrão é o console, o `silentLogger` não mostra nada e dá pra passar o seu com `info`, `warn` e `error` |
| `source`, `sink` | uma fonte e um destino prontos, no lugar dos que viriam da config. Eu uso isso nos testes pra ler e escrever na memória              |
| `previewSize`    | quantas linhas vêm no `preview` (o padrão é 5)                                                                                       |
| `onStep`         | uma função chamada no fim de cada etapa, com o nome e quantas linhas entraram e saíram. Serve pra mostrar progresso                  |

Se alguma coisa der errado ele lança o erro, então vale colocar num `try/catch`.

## Testes

| Comando                   | O que faz                                                            |
| ------------------------- | -------------------------------------------------------------------- |
| `npm run example`         | Roda o exemplo com CSV, sem precisar de banco nem Google             |
| `npm run example:excel`   | O mesmo exemplo, mas gerando um arquivo do Excel                     |
| `npm run example:xml`     | O mesmo exemplo, lendo e gerando XML                                 |
| `npm test`                | Testes unitários (Vitest), sem precisar de banco ou planilha reais   |
| `npm run test:watch`      | Os mesmos testes, rodando de novo a cada arquivo salvo (Q para sair) |
| `npm run test:config`     | Carrega e valida o `config.json`                                     |
| `npm run validate`        | Confere a config e os arquivos citados, sem rodar nada               |
| `npm run build`           | Compila pra `dist/`, que é o que o comando `datera` usa              |
| `npm run test:connection` | Conecta no banco real e mostra as 3 primeiras linhas                 |
| `npm run test:sheet`      | Escreve duas linhas de teste numa planilha real                      |

## Referência

| Guia                                                  | O que tem                                                            |
| ----------------------------------------------------- | -------------------------------------------------------------------- |
| [Comandos e API](api.md)                              | todos os comandos do terminal e as funções pra usar no código        |
| [Configuração](configuracao.md)                       | todos os campos do `config.json`, os modos e as estratégias do merge |
| [Fontes e destinos](fontes-e-destinos.md)             | cada formato que ele lê e escreve, e como criar o seu                |
| [Exemplos](exemplos.md)                               | dez configs, do mais simples ao mais completo                        |
| [Preparação e pendências](preparacao-e-pendencias.md) | `fillEmpty`, `combineColumns`, `distribute` e `validation`           |
| [Normalizadores](normalizadores.md)                   | os prontos e como criar o seu                                        |
| [Estrutura do projeto](estrutura.md)                  | o que tem em cada pasta                                              |

<p align="center">
  <a href="../README.md"><img src="https://img.shields.io/badge/In%C3%ADcio-475569?style=for-the-badge" alt="Início"></a>
  <a href="gestores.md"><img src="https://img.shields.io/badge/Para%20gestores-2563EB?style=for-the-badge" alt="Guia para gestores"></a>
  <a href="devs.md"><img src="https://img.shields.io/badge/Para%20devs-16181D?style=for-the-badge" alt="Guia para devs"></a>
</p>
