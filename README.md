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

## Todos os guias

| Guia                                                       | O que tem                                                           |
| ---------------------------------------------------------- | ------------------------------------------------------------------- |
| [Para gestores](docs/gestores.md)                          | instalar e usar o app com tela                                      |
| [Para devs](docs/devs.md)                                  | teste em 1 minuto, terminal, Datera Dev, uso em código e testes     |
| [Configuração](docs/configuracao.md)                       | todos os campos do`config.json`, os modos e as estratégias do merge |
| [Fontes e destinos](docs/fontes-e-destinos.md)             | cada formato que ele lê e escreve, e como criar o seu               |
| [Exemplos](docs/exemplos.md)                               | dez configs, do mais simples ao mais completo                       |
| [Preparação e pendências](docs/preparacao-e-pendencias.md) | `fillEmpty`, `combineColumns`, `distribute` e `validation`          |
| [Normalizadores](docs/normalizadores.md)                   | os prontos e como criar o seu                                       |
| [Estrutura do projeto](docs/estrutura.md)                  | o que tem em cada pasta                                             |

## Contribuir e licença

Se quiser ajudar, o jeito de rodar, testar e mandar mudanças está no [CONTRIBUTING.md](CONTRIBUTING.md). O código é aberto, sob a [licença MIT](LICENSE).

## Próximos passos

O que eu quero fazer, nessa ordem. Cada item é uma issue, os riscados já foram feitos, e o andamento de cada etapa aparece nos [milestones](https://github.com/alessandravieiradev-blip/datera/milestones). Se quiser ajudar com alguma, dá uma olhada no [CONTRIBUTING.md](CONTRIBUTING.md).

**1. Visual do Datera Dev**

- [#1](https://github.com/alessandravieiradev-blip/datera/issues/1) ~~refinar o visual do Datera Dev~~ (feito)

**2. Formatos e bancos de dados**

- [#2](https://github.com/alessandravieiradev-blip/datera/issues/2) ler e escrever XML
- [#3](https://github.com/alessandravieiradev-blip/datera/issues/3) ler de PostgreSQL
- [#4](https://github.com/alessandravieiradev-blip/datera/issues/4) ler de SQL Server
- [#5](https://github.com/alessandravieiradev-blip/datera/issues/5) ler de SQLite
- [#6](https://github.com/alessandravieiradev-blip/datera/issues/6) ler e escrever Parquet

**3. Qualidade**

- [#7](https://github.com/alessandravieiradev-blip/datera/issues/7) testes das telas dos dois apps no CI
- [#8](https://github.com/alessandravieiradev-blip/datera/issues/8) trocar `clientes` por `alunos` nos testes de config

**4. Para quem cuida dos dados**

- [#9](https://github.com/alessandravieiradev-blip/datera/issues/9) pendências editáveis
- [#10](https://github.com/alessandravieiradev-blip/datera/issues/10) salvar o resumo da execução

**5. Versões**

- [#11](https://github.com/alessandravieiradev-blip/datera/issues/11) versões numeradas e CHANGELOG

**6. Instalar com um clique**

- [#12](https://github.com/alessandravieiradev-blip/datera/issues/12) publicar os instaladores na aba Releases
- [#13](https://github.com/alessandravieiradev-blip/datera/issues/13) janela de boas-vindas na primeira abertura
- [#14](https://github.com/alessandravieiradev-blip/datera/issues/14) avisar quando sair versão nova
- [#15](https://github.com/alessandravieiradev-blip/datera/issues/15) assinar o instalador
- [#16](https://github.com/alessandravieiradev-blip/datera/issues/16) versão para Mac e Linux

**7. Usar o Datera como biblioteca**

- [#17](https://github.com/alessandravieiradev-blip/datera/issues/17) publicar no npm
- [#18](https://github.com/alessandravieiradev-blip/datera/issues/18) limpar dados que já estão na memória
- [#19](https://github.com/alessandravieiradev-blip/datera/issues/19) expor as etapas separadas
- [#20](https://github.com/alessandravieiradev-blip/datera/issues/20) config por código com `defineConfig`
- [#21](https://github.com/alessandravieiradev-blip/datera/issues/21) eventos de progresso
- [#22](https://github.com/alessandravieiradev-blip/datera/issues/22) ler e escrever em stream
- [#23](https://github.com/alessandravieiradev-blip/datera/issues/23) servidor HTTP opcional
- [#24](https://github.com/alessandravieiradev-blip/datera/issues/24) documentar a API em `docs/api.md`

**8. Terminal e automação**

- [#25](https://github.com/alessandravieiradev-blip/datera/issues/25) build de produção do terminal
- [#26](https://github.com/alessandravieiradev-blip/datera/issues/26) comando `datera` instalado
- [#27](https://github.com/alessandravieiradev-blip/datera/issues/27) agendar execução pelo app

**Mais tarde**

- [#28](https://github.com/alessandravieiradev-blip/datera/issues/28) versão para celular do app de gestores
