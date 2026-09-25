!macro customHeader
  !ifndef BUILD_UNINSTALLER
  !define MUI_FINISHPAGE_TITLE "Datera Dev instalado"
  !define MUI_FINISHPAGE_TEXT "Abra o app e use Ctrl+O para abrir um config.json ou Ctrl+Shift+N para criar um novo.$\r$\n$\r$\nCtrl+K abre a paleta com todos os comandos."
  !endif
!macroend

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Datera Dev"
  !define MUI_WELCOMEPAGE_TEXT "A versão do Datera para quem prefere editar a configuração direto.$\r$\n$\r$\nEditor com validação em tempo real, prévia com Ctrl+Enter, log com o tempo de cada etapa e teste de normalizadores. Usa o mesmo motor e o mesmo config.json do Datera."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customUnWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Desinstalar o Datera Dev"
  !define MUI_WELCOMEPAGE_TEXT "O aplicativo vai ser removido. Suas configurações, normalizadores e arquivos gerados continuam onde estão."
  !insertmacro MUI_UNPAGE_WELCOME
!macroend
