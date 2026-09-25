!macro customHeader
  !ifndef BUILD_UNINSTALLER
  !define MUI_FINISHPAGE_TITLE "Tudo pronto!"
  !define MUI_FINISHPAGE_TEXT "O Datera foi instalado no seu computador.$\r$\n$\r$\nNo primeiro acesso, um passo a passo vai te ajudar a dizer de onde vêm os seus dados e onde salvar o resultado. Leva só alguns minutinhos."
  !endif
!macroend

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Boas-vindas ao Datera"
  !define MUI_WELCOMEPAGE_TEXT "O Datera organiza planilhas bagunçadas: junta os cadastros repetidos, separa numa lista de Pendências o que precisa de atenção e entrega o resultado limpinho.$\r$\n$\r$\nA planilha original nunca é alterada, e dá pra ver uma prévia antes de salvar qualquer coisa.$\r$\n$\r$\nA instalação é rapidinha, são só alguns cliques."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customUnWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Desinstalar o Datera"
  !define MUI_WELCOMEPAGE_TEXT "O aplicativo vai ser removido do computador.$\r$\n$\r$\nSeus arquivos de configuração e as planilhas que ele gerou continuam onde estão."
  !insertmacro MUI_UNPAGE_WELCOME
!macroend
