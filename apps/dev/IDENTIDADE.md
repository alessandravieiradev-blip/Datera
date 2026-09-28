# Identidade visual do Datera Dev

O Datera Dev é a versão do Datera pra quem programa. Ele usa a mesma marca, mas o visual segue a cara de um editor de código, porque dev em geral não quer gráfico bonitinho, quer ver o dado e ir rápido no teclado.

## De onde vem

Tudo parte da identidade do Datera (o ícone, as cores e a Inter). O que muda:

|                 | Datera                              | Datera Dev                                                         |
| --------------- | ----------------------------------- | ------------------------------------------------------------------ |
| Tema padrão     | claro                               | escuro                                                             |
| Fundo           | azulado e com ondas                 | grafite neutro, sem decoração                                      |
| Cor de destaque | várias, com gráficos                | uma só (azul), mais verde, amarelo e vermelho só pra estado        |
| Fonte           | Poppins nos títulos, Inter no texto | Inter na interface, JetBrains Mono no código, nas tabelas e no log |
| Separação       | cards com sombra                    | bordas finas de 1 px                                               |
| Ícone           | D sobre fundo azul                  | D claro sobre fundo quase preto, com fluxos ciano, verde e roxo    |

## Paleta (tema escuro)

| Uso              | HEX       |
| ---------------- | --------- |
| Fundo            | `#0E1015` |
| Painel           | `#13161C` |
| Painel 2         | `#181C24` |
| Borda            | `#252A35` |
| Borda de campo   | `#5F687A` |
| Texto            | `#D5DAE3` |
| Texto secundário | `#8690A3` |
| Destaque         | `#5B9DFF` |
| Botão principal  | `#2F6FE0` |
| Sucesso          | `#4CC38A` |
| Aviso            | `#E0B341` |
| Erro             | `#F2665F` |

O texto principal sobre o fundo dá contraste de 13,6:1, e o secundário dá 5,9:1, os dois passam no WCAG AA. A borda de campo dá 3,4:1, que é o mínimo pra quem precisa enxergar onde digitar. O tema claro existe (Ctrl+Shift+L) e usa as mesmas regras com as cores do Datera.

## Cores do código

| Token                                    | HEX       |
| ---------------------------------------- | --------- |
| Chave do JSON                            | `#8AB4FF` |
| Texto                                    | `#9FD89A` |
| Número                                   | `#F0B36B` |
| `true`, `false`, `null` e palavras do JS | `#D49BF0` |
| Comentário                               | `#7D8597` |

## Texto, medidas e destaque

O texto tem três níveis:

| Nível  | Fonte                                  | Uso                                           |
| ------ | -------------------------------------- | --------------------------------------------- |
| Dado   | JetBrains Mono 12 a 13px, cor de texto | código, células, log, caminhos                |
| Rótulo | Inter 12px, texto secundário           | cabeçalho de coluna, legenda, título de seção |
| Ação   | Inter 13px                             | botões e abas                                 |

Os espaçamentos são sempre 4, 8, 12, 16 ou 24px. A barra do topo tem 44px, as abas 34px e a barra de status 26px, pra os dois painéis começarem e terminarem na mesma linha.

O azul aparece em um lugar por vez: onde o teclado está. O editor com foco ganha uma linha azul em cima, e a aba ativa do painel com foco fica sublinhada de azul. No outro painel, a aba ativa fica sublinhada de cinza.

Atalho escrito dentro de botão fica só em texto secundário. Fora dos botões (paleta, tela inicial) ele aparece como tecla, com borda e fundo, sempre no mesmo formato.

As tabelas seguem um estilo só: cabeçalho fixo, linhas separadas por divisória fina, números alinhados à direita e textos longos cortados com reticências. A coluna de motivo das pendências é marcada por uma barra amarela fina, não pela cor do texto.

## Regras

- nada de emoji, ilustração, saudação ou gráfico
- tudo que é dado aparece em fonte monoespaçada
- todo comando tem atalho, e todos aparecem na paleta (Ctrl+K)
- o texto é curto e direto, sem "clique aqui"
- tudo funciona só com teclado. No editor o Tab faz recuo, então pra sair dele é Esc e depois Tab, igual no VS Code
- janela aberta (paleta, confirmação) segura o foco até fechar
