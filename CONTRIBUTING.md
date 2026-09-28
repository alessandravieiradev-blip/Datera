# Contribuindo com o Datera

Que bom que você quer ajudar. Aqui fica o básico pra rodar o projeto, testar e mandar uma mudança.

## Preparando

Precisa do Node 22.13 ou mais novo.

```bash
git clone https://github.com/alessandravieiradev-blip/datera.git
cd datera
npm install
npm run example
```

Se o `npm run example` gerar os arquivos em `examples/saida/`, está tudo certo. O projeto é um monorepo: o motor fica em `src/` e os dois apps ficam em `apps/desktop` (para gestores) e `apps/dev` (Datera Dev). O que tem em cada pasta está em [docs/estrutura.md](docs/estrutura.md).

## Antes de mandar

Rode tudo que o CI roda:

```bash
npm run typecheck
npm run typecheck -w apps/desktop
npm run typecheck -w apps/dev
npm test
```

E se mexeu num app, abre ele e confere a tela que mudou (`npm run desktop` ou `npm run desktop:dev`), nos temas claro e escuro.

## Jeito do código

- TypeScript com `strict`, sem `any` quando dá pra evitar
- o código não tem comentários. Se precisou explicar, vale trocar o nome da variável ou quebrar a função
- o Prettier formata sozinho no commit, então não precisa se preocupar com espaço e quebra de linha
- toda mudança no motor vem com teste em `src/tests/`, na pasta do que foi mexido
- mensagens pra quem usa ficam em português. No app para gestores é "para" (não "pra"), sem emoji, com rótulo em maiúscula e linguagem neutra de gênero

## Dados de exemplo

Os exemplos e os testes usam uma escola de música inventada: matrícula, nome, e-mail, plano, instrumento e cidade. Não usa dado que pareça de gente de verdade, tipo CPF ou telefone.

## Commits

O projeto usa [Conventional Commits](https://www.conventionalcommits.org/pt-br/), com a mensagem em português. O commitlint confere na hora do commit.

```text
feat(pipeline): aceita XML como fonte
fix(desktop): corrige o foco da confirmação
docs: explica o validate
```

Um commit por mudança, e cada commit precisa passar no typecheck e nos testes sozinho.

## Mandando a mudança

1. Faz um fork e cria um branch a partir do `main`
2. Faz as mudanças e os commits
3. Abre um pull request dizendo o que mudou e como testar

Se for algo grande, abre uma issue antes pra gente conversar sobre o jeito de fazer.
