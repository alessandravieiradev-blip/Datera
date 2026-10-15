<p align="center">
  <a href="../README.md"><img src="https://img.shields.io/badge/In%C3%ADcio-475569?style=for-the-badge" alt="Início"></a>
  <a href="gestores.md"><img src="https://img.shields.io/badge/Para%20gestores-2563EB?style=for-the-badge" alt="Guia para gestores"></a>
  <a href="devs.md"><img src="https://img.shields.io/badge/Para%20devs-16181D?style=for-the-badge" alt="Guia para devs"></a>
</p>

[Guia para devs](devs.md) › Ambiente local no Windows

# Ambiente local no Windows

Aqui fica o que você precisa pra rodar o projeto no Windows, desde o primeiro exemplo até a conexão com um banco ou uma planilha do Google. Precisa do Node 22.13 ou mais novo.

## Pra começar

Dentro da pasta do repositório:

```powershell
npm.cmd ci
npm.cmd run example
```

O exemplo usa os alunos da escola de música inventada e gera o resultado e as pendências em `examples/saida/`. Não precisa de banco nem de conta no Google.

No PowerShell, o `npm` pode tentar abrir o `npm.ps1` e parar porque a execução de scripts está bloqueada. Se isso acontecer, usa `npm.cmd`, como nos comandos deste guia. Não precisa mudar a política do Windows.

Se o npm travar antes de começar a instalação, dá pra tentar `npm.cmd ci --logs-max=0`. Essa opção desliga a gravação dos logs do npm. O `.npmrc` do projeto já deixa ela ligada.

## Sua configuração

O `config.json.example` já vem pronto pra ler `examples/alunos.csv` e gravar `saida/alunos.xlsx`, com os dados organizados numa aba e as pendências em outra. Se ainda não tiver um `config.json`, copie o exemplo:

```powershell
if (-not (Test-Path ./config.json)) {
    Copy-Item ./config.json.example ./config.json
}
```

Depois, confere a config e vê uma prévia antes de gravar:

```powershell
npm.cmd run validate -- ./config.json
npm.cmd start -- --dry-run
```

Se estiver tudo certo, `npm.cmd start` grava o resultado no destino da config. O `--dry-run` lê os dados da fonte, mas não grava nada.

Pra abrir o app com passo a passo, roda `npm.cmd run desktop`. Se prefere o editor de configuração e a saída detalhada, é `npm.cmd run desktop:dev`. Os dois estão no [guia para devs](devs.md#os-dois-apps).

## Banco e Google Sheets

Pra trabalhar com CSV, JSON, XML, Excel, Parquet ou SQLite, não precisa de servidor de banco nem de conta no Google. Os pacotes que os formatos usam já entram na instalação de desenvolvimento.

Se for usar MySQL, PostgreSQL ou SQL Server, você vai precisar do endereço do servidor, porta, usuário, senha, nome do banco e tabela ou view. Quem cuida do banco pode passar esses dados. Crie um `.env` do lado do `config.json`, usando o [`.env.example`](../.env.example) como referência, e preencha só as variáveis que vai usar.

O `DB_HOST` precisa ficar junto do `DB_PASSWORD`: assim a senha fica associada ao servidor certo. As variáveis `DEST_DB_*` servem pra configurar outro banco como destino. Os campos de `source` e `destination` estão em [Fontes e destinos](fontes-e-destinos.md).

Pra usar Google Sheets, você precisa de uma conta de serviço num projeto do Google Cloud com a API Google Sheets habilitada. Baixe a chave JSON dessa conta, salve como `credentials.json` e compartilhe a planilha com o e-mail que aparece em `client_email`.

No `.env`, coloque o ID da planilha em `GOOGLE_SPREADSHEET_ID` e o caminho da chave em `GOOGLE_SERVICE_ACCOUNT_KEY_PATH`. O ID é o trecho da URL entre `/d/` e `/edit`. O `credentials.json.example` mostra o formato do arquivo; a chave de verdade vem do Google Cloud.

O Git ignora `.env`, `config.json` e `credentials.json` pra esses dados ficarem só na sua máquina. O comando `npm.cmd run test:sheet` escreve numa planilha real, então só roda ele depois de conferir qual planilha está configurada.

## Testes

Os comandos e o que cada um confere estão no [guia para devs](devs.md#testes). Se a máquina demorar pra carregar os pacotes e os testes pararem por tempo limite, dá pra usar menos processos e dar mais tempo pra cada teste:

```powershell
npm.cmd test -- --maxWorkers=2 --testTimeout=120000
```

Pra testar as telas, instale o Chromium uma vez e depois rode o Playwright:

```powershell
npm.cmd exec -- playwright install chromium
npm.cmd run test:telas -- --workers=2 --timeout=120000
```

Esses testes abrem as telas dos dois apps no navegador, com dados de exemplo e a ponte do Electron simulada. Pra conferir o app completo, vale abrir ele também.

---

[← Guia para devs](devs.md)
