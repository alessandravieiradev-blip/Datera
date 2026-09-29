# Segurança

## Versões que recebem correção

Só a versão mais nova recebe correção de segurança. Quando sair uma correção, ela vai numa versão nova no [npm](https://www.npmjs.com/package/datera) e na aba [Releases](https://github.com/alessandravieiradev-blip/datera/releases), e aparece no [CHANGELOG](CHANGELOG.md).

## Como avisar de uma falha

**Não abra uma issue pública** pra falha de segurança, porque qualquer pessoa consegue ler antes da correção sair.

Use o aviso privado do GitHub: [https://github.com/alessandravieiradev-blip/datera/security/advisories/new](https://github.com/alessandravieiradev-blip/datera/security/advisories/new). Só eu consigo ver o que você escrever ali.

Ajuda muito se o aviso tiver:

- o que dá pra fazer com a falha
- onde ela está (app de gestores, Datera Dev, comando `datera` ou pacote do npm) e em qual versão
- o passo a passo pra repetir, com dados inventados

Eu respondo em até 7 dias dizendo se consegui repetir o problema e o que vou fazer. Quando a correção sair, o seu nome entra no CHANGELOG como quem avisou, se você quiser.

## O que o Datera já faz

Pra saber o que já é protegido (arquivos de código na config, senha no `.env`, XML com `<!DOCTYPE>`, entrada e saída no mesmo arquivo), veja a seção [Cuidados](docs/api.md#cuidados) do guia de comandos e API.
