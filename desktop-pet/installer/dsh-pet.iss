; 小肥鱼桌面宠物：Inno Setup 安装脚本
; 先用 build-installer.ps1 生成 artifacts/installer/dist/DSH-Pet，再编译本脚本。
#define MyAppName "小肥鱼桌面宠物"
#define MyAppVersion "0.1.5"
#define MyAppPublisher "EternalNight"
#define MyAppExeName "DSH-Pet.exe"

[Setup]
AppId={{8F3C1B2A-7D4E-4A65-9C2B-1E5D6F7A8B90}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\DSH Pet
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\..\artifacts\installer
OutputBaseFilename=DSH-Pet-Setup-{#MyAppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupIconFile=..\assets\dsh-pet.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName}

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加任务："; Flags: checkedonce
Name: "startupicon"; Description: "开机自动启动"; GroupDescription: "附加任务："; Flags: unchecked

[Files]
Source: "..\..\artifacts\installer\dist\DSH-Pet\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{userprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{userdesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: startupicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "启动小肥鱼"; Flags: nowait postinstall skipifsilent
