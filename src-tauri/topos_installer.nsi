!include "MUI2.nsh"
!include "x64.nsh"
!include "FileFunc.nsh"

Unicode true
ManifestDPIAware true
RequestExecutionLevel admin

!define PRODUCT_NAME "Topos GIS"
!define PRODUCT_VERSION "1.1.0"
!define PRODUCT_PUBLISHER "Topos Tactical Systems"
!define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\topos.exe"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\ToposGIS"

Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "..\dist_release\Setup_Topos_v1.1.0.exe"
InstallDir "$PROGRAMFILES64\Topos GIS"
InstallDirRegKey HKLM "${PRODUCT_UNINST_KEY}" "UninstallString"

!define MUI_ICON "icons\icon.ico"
!define MUI_UNICON "icons\icon.ico"
!define MUI_HEADERIMAGE
!define MUI_ABORTWARNING

!define MUI_WELCOMEPAGE_TITLE "Установка Topos GIS v${PRODUCT_VERSION}"
!define MUI_WELCOMEPAGE_TEXT "Вас приветствует мастер установки отечественной тактической геоинформационной системы Topos GIS.$\r$\n$\r$\nРекомендуется закрыть все работающие приложения перед началом установки.$\r$\n$\r$\nНажмите «Далее» для продолжения."
!insertmacro MUI_PAGE_WELCOME

!insertmacro MUI_PAGE_DIRECTORY

!insertmacro MUI_PAGE_INSTFILES

!define MUI_FINISHPAGE_RUN "$INSTDIR\topos.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Запустить Topos GIS"
!define MUI_FINISHPAGE_SHOWREADME "$INSTDIR\TOPOS_USER_MANUAL.html"
!define MUI_FINISHPAGE_SHOWREADME_TEXT "Открыть руководство пользователя"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "Russian"

Section "MainSection" SEC01
  ${If} ${RunningX64}
    SetRegView 64
  ${EndIf}

  SetOutPath "$INSTDIR"
  SetOverwrite on

  File /oname=topos.exe "target\release\app.exe"
  File "..\TOPOS_USER_MANUAL.html"

  SetOutPath "$INSTDIR\sidecar-renderer"
  File /r "sidecar-renderer\*.*"

  SetOutPath "$INSTDIR\assets"
  ${If} ${FileExists} "$EXEDIR\assets\*.*"
    CopyFiles /SILENT "$EXEDIR\assets\*.*" "$INSTDIR\assets"
  ${ElseIf} ${FileExists} "$EXEDIR\..\assets\*.*"
    CopyFiles /SILENT "$EXEDIR\..\assets\*.*" "$INSTDIR\assets"
  ${ElseIf} ${FileExists} "F:\Vanya\topos\src-tauri\assets\*.*"
    CopyFiles /SILENT "F:\Vanya\topos\src-tauri\assets\*.*" "$INSTDIR\assets"
  ${EndIf}

  SetOutPath "$INSTDIR"
  CreateDirectory "$SMPROGRAMS\Topos GIS"
  CreateShortcut "$SMPROGRAMS\Topos GIS\Topos GIS.lnk" "$INSTDIR\topos.exe" "" "$INSTDIR\topos.exe" 0
  CreateShortcut "$SMPROGRAMS\Topos GIS\Руководство пользователя.lnk" "$INSTDIR\TOPOS_USER_MANUAL.html"
  CreateShortcut "$SMPROGRAMS\Topos GIS\Удалить Topos GIS.lnk" "$INSTDIR\uninstall.exe"
  CreateShortcut "$DESKTOP\Topos GIS.lnk" "$INSTDIR\topos.exe" "" "$INSTDIR\topos.exe" 0

  WriteUninstaller "$INSTDIR\uninstall.exe"

  WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "" "$INSTDIR\topos.exe"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayName" "${PRODUCT_NAME} v${PRODUCT_VERSION}"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\uninstall.exe"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\topos.exe"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKLM "${PRODUCT_UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKLM "${PRODUCT_UNINST_KEY}" "NoRepair" 1
  WriteRegDWORD HKLM "${PRODUCT_UNINST_KEY}" "EstimatedSize" 2600000
SectionEnd

Section Uninstall
  ${If} ${RunningX64}
    SetRegView 64
  ${EndIf}

  Delete "$DESKTOP\Topos GIS.lnk"
  Delete "$SMPROGRAMS\Topos GIS\Topos GIS.lnk"
  Delete "$SMPROGRAMS\Topos GIS\Руководство пользователя.lnk"
  Delete "$SMPROGRAMS\Topos GIS\Удалить Topos GIS.lnk"
  RMDir "$SMPROGRAMS\Topos GIS"

  Delete "$INSTDIR\topos.exe"
  Delete "$INSTDIR\TOPOS_USER_MANUAL.html"
  Delete "$INSTDIR\uninstall.exe"
  RMDir /r "$INSTDIR\assets"
  RMDir /r "$INSTDIR\sidecar-renderer"
  RMDir "$INSTDIR"

  DeleteRegKey HKLM "${PRODUCT_UNINST_KEY}"
  DeleteRegKey HKLM "${PRODUCT_DIR_REGKEY}"
SectionEnd
