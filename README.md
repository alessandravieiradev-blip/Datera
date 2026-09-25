<p align="center">
  <img src="docs/assets/datera-banner.png" alt="Datera: dados bagunçados entrando de um lado e saindo organizados do outro">
</p>

<p align="center">Ferramenta pra limpar e juntar dados bagunçados de planilha, banco e arquivo.</p>

<p align="center">
  <a href="https://github.com/alessandravieiradev-blip/datera/actions/workflows/ci.yml"><img src="https://github.com/alessandravieiradev-blip/datera/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
</p>

<p align="center">
  <a href="docs/gestores.md"><img src="https://img.shields.io/badge/Para%20gestores-2563EB?style=for-the-badge" alt="Guia para gestores"></a>
  <a href="docs/devs.md"><img src="https://img.shields.io/badge/Para%20devs-16181D?style=for-the-badge" alt="Guia para devs"></a>
</p>

## O que é

O Datera é um ETL que eu fiz em TypeScript. Ele lê dados de um MySQL, do Google Sheets, de uma planilha do Excel, de um CSV ou de um JSON, arruma o que dá e escreve tudo no Google Sheets, no Excel, num CSV ou num JSON.

Ele começou bem simples, era só pra copiar uma tabela do MySQL pra uma planilha. Só que aí eu fui vendo que dado de verdade vem uma bagunça: a mesma pessoa cadastrada duas vezes, e-mail com maiúscula num lugar e minúscula no outro, campo vazio, informação espalhada em várias colunas. Então fui colocando coisa nova até conseguir resolver quase tudo mexendo só no `config.json`.

## A ideia

Quem mais sofre com planilha bagunçada normalmente não é quem programa. É quem precisa da lista certinha pra mandar um e-mail, fechar um relatório ou ligar pra alguém. E essa pessoa não deveria ter que pedir ajuda toda vez que precisa dos dados limpos.

Então o Datera funciona assim: as regras ficam num arquivo de configuração (o `config.json`), que pode ser montado com calma uma vez só. Depois disso qualquer pessoa roda com um clique e recebe duas coisas: o resultado organizado e uma lista separada do que precisa de alguém dar uma olhada, com o motivo escrito do lado. Nada some sem explicação.

Por isso ele tem três jeitos de usar, todos com o mesmo motor e a mesma configuração:

| Jeito          | Pra quem                                      | O que tem                                                                 |
| -------------- | --------------------------------------------- | ------------------------------------------------------------------------- |
| **Datera**     | quem cuida dos dados mas não programa         | app com tela, passo a passo, regras em frases, gráficos e histórico       |
| **Datera Dev** | quem programa                                 | app escuro com editor da config, prévia na hora, log e paleta de comandos |
| **Terminal**   | quem quer automatizar ou usar em outro código | `npm start`, `--dry-run` e a função `runEtl`                              |

## Como funciona

```text
fonte ──► prepara ──► separa o que tem problema ──► tira ou junta repetidos ──► destino
                               │
                               └──► pendências (com o motivo de cada uma)
```

1. **Fonte:** lê de onde os dados estão (MySQL, Google Sheets, Excel, CSV ou JSON).
2. **Prepara:** preenche célula vazia e junta colunas, se você pedir.
3. **Pendências:** as linhas que quebram alguma regra (e-mail inválido, campo vazio, valor fora da lista...) vão pra uma aba ou arquivo à parte.
4. **Repetidos:** deixa como está, tira as linhas repetidas ou junta as linhas da mesma pessoa sem perder nada.
5. **Destino:** escreve o resultado (Google Sheets, Excel, CSV ou JSON).

Hoje ele consegue:

- tirar linhas repetidas (`dedupe`) ou juntar as linhas da mesma pessoa sem perder nada (`merge`)
- usar normalizadores pra `Lia@Email.com` e ` lia@email.com` contarem como a mesma pessoa
- ter regras diferentes dependendo do tipo da chave
- decidir o que fazer com as linhas que não têm chave, sem elas sumirem nem se misturarem
- espalhar valores em várias colunas sem jogar nenhum fora
- ler e escrever em formatos diferentes sem mudar nada das regras

## Escolha o seu caminho

<table>
<tr>
<td width="50%" valign="top">

### Para gestores

Você quer usar o app com tela: instalar, escolher de onde vêm os dados, montar as regras em frases e exportar. Não precisa saber programar.

<a href="docs/gestores.md"><img src="https://img.shields.io/badge/Abrir%20o%20guia%20para%20gestores-2563EB?style=for-the-badge" alt="Abrir o guia para gestores"></a>

</td>
<td width="50%" valign="top">

### Para devs

Você quer rodar pelo terminal, usar o Datera Dev, escrever a config na mão, criar normalizadores ou chamar o Datera de dentro de outro código.

<a href="docs/devs.md"><img src="https://img.shields.io/badge/Abrir%20o%20guia%20para%20devs-16181D?style=for-the-badge" alt="Abrir o guia para devs"></a>

</td>
</tr>
</table>

## Todos os guias

| Guia                                                       | O que tem                                                            |
| ---------------------------------------------------------- | -------------------------------------------------------------------- |
| [Para gestores](docs/gestores.md)                          | instalar e usar o app com tela                                       |
| [Para devs](docs/devs.md)                                  | teste em 1 minuto, terminal, Datera Dev, uso em código e testes      |
| [Configuração](docs/configuracao.md)                       | todos os campos do `config.json`, os modos e as estratégias do merge |
| [Fontes e destinos](docs/fontes-e-destinos.md)             | cada formato que ele lê e escreve, e como criar o seu                |
| [Exemplos](docs/exemplos.md)                               | dez configs, do mais simples ao mais completo                        |
| [Preparação e pendências](docs/preparacao-e-pendencias.md) | `fillEmpty`, `combineColumns`, `distribute` e `validation`           |
| [Normalizadores](docs/normalizadores.md)                   | os prontos e como criar o seu                                        |
| [Estrutura do projeto](docs/estrutura.md)                  | o que tem em cada pasta                                              |

## Próximos passos

O que eu quero fazer, mais ou menos na ordem:

**Formatos**

- ler e escrever XML
- ler e escrever Parquet e bancos além do MySQL (PostgreSQL e SQLite)

**Instalar com um clique**

- publicar os instaladores dos dois apps na aba Releases do GitHub, gerados sozinhos por uma action a cada tag de versão
- na primeira vez que abre, mostrar uma janelinha de boas-vindas com um botão que leva pro guia certo (`gestores.md` no Datera, `devs.md` no Datera Dev)
- avisar dentro do app quando sair versão nova, com o link da release
- assinar o instalador pra o Windows parar de avisar
- versão pra Mac e Linux

**Usar o Datera como biblioteca**

- publicar no npm, pra dar `npm install datera` e importar em qualquer projeto
- rodar direto em dados que já estão na memória, tipo `clean(linhas, regras)` devolvendo `{ resultado, pendencias }`, sem precisar de fonte nem destino
- expor as etapas separadas (`fillEmpty`, `validate`, `dedupe`, `merge`...) pra montar o próprio pipeline
- montar a config por código com tipos, tipo `defineConfig({ ... })`, com autocompletar no editor
- eventos de progresso (`onStep`, `onRow`) pra mostrar barra de carregamento em outros apps
- ler e escrever em stream, pra arquivo grande não precisar caber inteiro na memória
- um servidor HTTP opcional (`POST /run` com a config e os dados) pra usar de outras linguagens
- documentar tudo isso num `docs/api.md`, com exemplos

**Terminal e automação**

- build de produção do terminal (os apps já têm, mas o `npm start` ainda roda pelo `tsx`)
- um comando `datera` instalado no sistema, tipo `datera run config.json`
- agendar execução (todo dia às 8h, por exemplo) direto pelo app
- `datera validate config.json` pra conferir a config sem rodar nada

**Mais tarde**

- versão pro celular do app de gestores
