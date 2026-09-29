<p align="center">
  <a href="../README.md"><img src="https://img.shields.io/badge/In%C3%ADcio-475569?style=for-the-badge" alt="Início"></a>
  <a href="gestores.md"><img src="https://img.shields.io/badge/Para%20gestores-2563EB?style=for-the-badge" alt="Guia para gestores"></a>
  <a href="devs.md"><img src="https://img.shields.io/badge/Para%20devs-16181D?style=for-the-badge" alt="Guia para devs"></a>
</p>

# Guia para gestores

Esse é o guia do Datera com tela, o app para quem cuida dos dados e não quer mexer em terminal nem em código. Com ele você escolhe de onde vêm os dados, diz o que conta como problema e recebe tudo organizado, com uma lista separada do que precisa de atenção.

## Sumário

- [Instalando](#instalando)
- [Primeira vez: o passo a passo](#primeira-vez-o-passo-a-passo)
- [As telas](#as-telas)
- [Regras](#regras)
- [Cadastros repetidos](#cadastros-repetidos)
- [Prévia e exportação](#prévia-e-exportação)
- [Atalhos](#atalhos)
- [Cuidados](#cuidados)
- [Quando precisar de ajuda](#quando-precisar-de-ajuda)

## Instalando

1. Abra a [página da versão mais recente](https://github.com/alessandravieiradev-blip/datera/releases/latest).
2. Lá embaixo, em **Assets**, clique no arquivo que começa com `Datera-Setup` (por exemplo `Datera-Setup-0.1.0.exe`). Cuidado para não pegar o `Datera-Dev-Setup`, que é o app para quem programa.
3. Abra o arquivo baixado e siga as telas. Não precisa instalar mais nada.

Como o instalador ainda não é assinado, o Windows pode mostrar a mensagem "O Windows protegeu o computador". Nesse caso, clique em **Mais informações** e depois em **Executar assim mesmo**.

Depois de instalado, o Datera aparece no menu Iniciar e ganha um atalho na área de trabalho.

## Primeira vez: o passo a passo

Na primeira vez o app monta a configuração com você, em quatro passos:

1. **Fonte dos dados:** arquivo Excel, arquivo CSV, arquivo XML, Google Planilhas, arquivo SQLite ou um banco de dados (MySQL, PostgreSQL ou SQL Server). A origem só é lida, nunca alterada.
2. **Destino:** arquivo Excel, arquivo CSV, arquivo XML, Google Planilhas, um banco de dados (MySQL, PostgreSQL ou SQL Server) ou um arquivo SQLite. As pendências ficam do lado: numa aba separada, num segundo arquivo ou numa segunda tabela.
3. **Detalhes:** o arquivo, o link da planilha ou os dados do banco, e onde salvar o resultado. Se o destino for um banco, você escolhe o nome de uma tabela nova. Quando a fonte também é um banco, dá para marcar **Salvar no mesmo servidor e banco de onde ele lê** e só escrever o nome da tabela.
4. **Pronto:** um resumo das escolhas. Ao clicar em **Salvar configuração**, você escolhe onde guardar o arquivo com essas escolhas. Guarde numa pasta sua, porque é ele que o app abre das próximas vezes.

Depois de salvar, o app leva você para a tela de Regras.

Se alguém já te mandou uma configuração pronta, é só escolher o arquivo em vez de criar uma nova.

## As telas

| Tela              | Para que serve                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Início**        | os números da última exportação, os gráficos e como as pendências foram mudando com o tempo |
| **Exportar**      | ver uma prévia (sem gravar nada) e depois exportar de verdade                               |
| **Regras**        | dizer o que conta como problema e o que fazer com os cadastros repetidos                    |
| **Histórico**     | todas as vezes que o Datera rodou, com data, resultado e erro, se teve                      |
| **Configurações** | trocar o arquivo de configuração e escolher o tema (claro, escuro ou igual ao Windows)      |
| **Atalhos**       | a lista de atalhos de teclado, que dá para trocar                                           |

## Regras

As regras são frases do tipo:

> Quando **email** estiver **com e-mail inválido**, mandar para **Pendências**.

Toda linha que se encaixar numa regra sai do resultado e vai para as pendências, com o motivo escrito do lado (por exemplo `E-mail inválido em "email"`). Assim nada some sem explicação.

As condições prontas:

| Condição                             | Quando a linha vai para pendências                       |
| ------------------------------------ | -------------------------------------------------------- |
| Vazio                                | o campo está em branco                                   |
| Com e-mail inválido                  | não parece um e-mail (falta `@`, tem espaço...)          |
| Com algo além de dígitos (0 a 9)     | tem letra, espaço ou símbolo num campo que é só número   |
| Com número inválido (aceita vírgula) | não é um número, como `12,5` ou `1.200`                  |
| Com data inválida (dd/mm/aaaa)       | a data não está no formato `25/09/2026`                  |
| Com CEP inválido                     | não é um CEP como `96010-000`                            |
| Com números ou símbolos (só letras)  | num campo que deveria ter só letras, como nome ou cidade |
| Curto demais (menos de 3 caracteres) | o valor é pequeno demais para ser de verdade             |
| Fora da lista                        | o valor não está entre os que você permitiu              |

### Outra regra

Quando nenhuma das prontas serve, escolha **Outra regra...** na lista. Tem três caminhos:

- **Formato próprio:** você descreve o formato (tem modelos como CEP e horário) e testa na hora o que passa e o que não passa.
- **Normalizador:** para regras com lógica, tipo "o código precisa começar com duas letras". O app cria um arquivo de exemplo do lado da configuração e explica como mexer. Precisa de um pouco de lógica de programação.
- **Não sei fazer:** o app monta uma mensagem pronta para você mandar para alguém que programe.

Depois de mexer nas regras, clique em **Salvar** (ou `Ctrl+S`).

## Cadastros repetidos

No fim da tela de Regras você escolhe o que fazer quando a mesma pessoa aparece mais de uma vez:

- **Deixar como estão:** não mexe em nada.
- **Tirar os repetidos, olhando a coluna:** fica só a primeira linha de cada valor da coluna escolhida (por exemplo, uma linha por matrícula).
- **Juntar os repetidos numa linha só, sem perder nada:** as informações das linhas repetidas viram uma só. Essa opção precisa ser montada no arquivo de configuração por alguém que programe. Depois de pronta, ela aparece marcada aqui e continua funcionando normalmente.

## Prévia e exportação

Antes de gravar, use a **prévia** (`Ctrl+P`). Ela faz tudo igual, só que não grava nada, e mostra:

- quantas linhas entraram e quantas saíram
- as etapas, com quantas linhas passaram por cada uma
- as pendências agrupadas por motivo
- as primeiras linhas do resultado

Se estiver tudo certo, clique em **Exportar agora** (`Ctrl+E`) e confirme. O resultado e as pendências são gravados no destino que você escolheu, e a exportação entra no Histórico e nos gráficos do Início.

## Atalhos

Os principais (todos podem ser trocados na tela Atalhos):

| Atalho              | O que faz                            |
| ------------------- | ------------------------------------ |
| `Ctrl+1` a `Ctrl+6` | vai para cada tela, na ordem do menu |
| `Ctrl+P`            | ver prévia                           |
| `Ctrl+E`            | exportar agora                       |
| `Ctrl+N`            | adicionar regra                      |
| `Ctrl+S`            | salvar as regras                     |
| `Ctrl+Shift+Z`      | desfazer as alterações nas regras    |
| `Ctrl+O`            | trocar o arquivo de configuração     |
| `Ctrl+Shift+N`      | criar uma configuração nova          |
| `Ctrl+Shift+L`      | alternar entre tema claro e escuro   |
| `F5`                | atualizar as informações             |
| `F1`                | abrir este guia                      |

## Cuidados

- **O destino é apagado e escrito de novo toda vez.** Use um arquivo ou uma aba só para o Datera e não deixe anotações suas ali.
- **No banco, o Datera só mexe nas tabelas que ele mesmo criou.** Se o nome escolhido for de uma tabela que já existe e não é dele, ele avisa e não grava nada. Quem cuida do banco precisa dar ao usuário permissão para criar e apagar tabelas.
- **Na primeira exportação, o app mostra de onde ele lê e onde vai gravar.** Confira, principalmente se a configuração veio de outra pessoa. Ele só pergunta de novo se a fonte ou o destino mudarem.
- **A origem nunca é alterada.** O app não deixa escolher o mesmo arquivo (ou a mesma aba) para ler e para gravar.
- **A senha do banco fica num arquivo `.env`, ao lado da configuração.** Assim a configuração pode ser enviada para outra pessoa sem a senha. Nunca mande o `.env`.
- **Configurações podem trazer arquivos de código.** Quando isso acontece, o Datera mostra quais são e pergunta se você confia neles antes de executar. Só confirme se você sabe de onde eles vieram.
- **Rode a prévia antes da primeira exportação** de uma configuração nova.

## Quando precisar de ajuda

Se aparecer um erro, a mensagem fica na tela de Exportar e no Histórico. Vale copiar o texto e mandar para quem cuida do projeto junto com o arquivo de configuração (o `.env` fica de fora).

Para quem vai montar configurações mais avançadas ou gerar o instalador, o caminho é o [guia para devs](devs.md).

<p align="center">
  <a href="../README.md"><img src="https://img.shields.io/badge/In%C3%ADcio-475569?style=for-the-badge" alt="Início"></a>
  <a href="gestores.md"><img src="https://img.shields.io/badge/Para%20gestores-2563EB?style=for-the-badge" alt="Guia para gestores"></a>
  <a href="devs.md"><img src="https://img.shields.io/badge/Para%20devs-16181D?style=for-the-badge" alt="Guia para devs"></a>
</p>
