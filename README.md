# Bedrock Server Manager

A completely free desktop application for Windows / Linux that allows anyone to set up a Minecraft Bedrock Edition home server with just a few clicks and play with friends.

It wraps the official `bedrock_server` and covers everything up to external connections via `playit.gg` (no port forwarding required).

## Key Features

* Server start / stop / restart, console (real-time logs & command execution), and automatic crash recovery
* Automatic downloading & updating of official BDS (refers to the latest stable version from Bedrock-OSS/BDS-Versions)
* GUI editor for `server.properties` + detailed raw editor
* Multiple world creation, switching, `.mcworld` import, and auto-backup + restore on server stop
* Player management: online player list (kick/op), `allowlist.json`, and `permissions.json` (XUID)
* Resource monitoring: CPU / Memory / Uptime graphs (last 5 minutes, updated every 1 second)
* External connection (playit.gg): secret key pasting method to manage daemon internally / local network address guidance / 1-click copy for friend invitation text
* Scheduled start/stop (Day of week + HH:MM, start / stop / restart)
* Add-on management (`.mcpack` / `.mcaddon` import, enabling/disabling via `world_*_packs.json` toggles)

## System Requirements

* Windows 10 / 11 (x64)
* Linux x64 (verified on a separate environment. Distributed as a portable `tar.gz`)

## Installation / Setup

### Windows

1. Run `Bedrock Server Manager-Setup-0.1.0.exe` (NSIS installer)
2. **SmartScreen Warning**: "Windows protected your PC" may appear. This is normal because this app is not code-signed. Click **"More info" -> "Run anyway"** to proceed. To verify file integrity, compare the SHA256 checksum in [checksums.sha256](https://www.google.com/search?q=release/checksums.sha256) (`Get-FileHash <file> -Algorithm SHA256`)
3. Choose the installation directory and proceed
4. First launch: Agree to the Terms of Service / Microsoft EULA -> Automatically download the official BDS -> Arrive at the Dashboard
5. **▶ Start Server**

Data, worlds, and settings are saved in `%LOCALAPPDATA%\BedrockServerManager\`.

### Linux

```bash
tar -xzf "Bedrock Server Manager-0.1.0.tar.gz"
cd "Bedrock Server Manager-0.1.0"
./bedrock-server-manager

```

If `Failed to move to new namespace` (chrome-sandbox) occurs:

```bash
sudo chown root:root chrome-sandbox && sudo chmod 4755 chrome-sandbox
# Or
./bedrock-server-manager --no-sandbox

```

Data, worlds, and settings are saved in `$XDG_DATA_HOME/BedrockServerManager` (default: `~/.local/share/BedrockServerManager`).

## External Connection (playit.gg)

1. Create an account at [playit.gg](https://playit.gg/)
2. Add an Agent and create a **Minecraft Bedrock (UDP) tunnel** pointing to `127.0.0.1:19132`
3. On PCs using the official installer version, the `secret_key` is stored in `C:\ProgramData\playit_gg\playit.toml` (or `~/.config/playit_gg/playit.toml` on Linux). Extract it, paste it into **Config -> External Connection -> Secret Key** in the app, and save
4. Copy the external address shown on the playit dashboard (e.g., `xxx.gl.at.ply.gg:12345`) and save it in Config -> External Connection -> External Address
5. **Enable External Connection** -> The app launches the daemon via `playit.exe --secret <KEY>` (or `playit --secret <KEY>` on Linux)
6. On the Dashboard, click **▶ Start Server**
7. Click the **"Copy invitation text for friends"** button to copy the template text -> Paste into messaging apps (e.g., LINE) and send to friends

> If the official playit service (`playitd`) is already running in the background, launching the app with the same secret key will result in duplicate instances of the same agent. If you want the app to manage it, stop the official service first (Windows: Run `net stop playitd` as administrator, disabling auto-start is recommended).

## Launching Automatically at Windows Logon

Bedrock Server and playit run only while the app is active. To launch the app automatically when your PC boots:

1. Press `Win + R` -> type `taskschd.msc` -> Open Task Scheduler
2. Click "**Create Basic Task...**" -> Name: `Bedrock Server Manager`
3. Trigger: **When I log on**
4. Action: **Start a program** -> Program/script: Select the installed `Bedrock Server Manager.exe`
5. Check "Run with highest privileges" (recommended for stable process management)
6. Finish

Combined with scheduled start/stop (Config -> Schedule), you can automate the entire workflow: PC startup -> App launch -> Automatic server start at the specified time.

## Development

```bash
npm install
npm run dev     # Starts vite + electron (hot reload)
npm run typecheck
npm run build   # tsc --noEmit && vite build (generates renderer + main + preload into dist/, dist-electron/)
npm run dist    # build -> OS-specific packaging via electron-builder

```

Repository Structure:

```
src/
├── main/            Electron Main process
│   ├── index.ts
│   ├── server-manager.ts   bedrock_server process management
│   ├── playit-manager.ts   playit daemon management (secret key method)
│   ├── config-manager.ts   server.properties read/write
│   ├── world-manager.ts    World creation/switching/.mcworld import/default preparation
│   ├── backup-manager.ts   World backup archiving to zip + restore
│   ├── addon-manager.ts    .mcpack/.mcaddon importing & enabling
│   ├── player-manager.ts   allowlist/permissions/known-players
│   ├── downloader.ts       BDS auto-download (platform-specific URL)
│   ├── log-parser.ts       Log level detection & player join/leave event extraction
│   ├── metrics.ts          CPU/Memory tracking via pidusage
│   ├── scheduler.ts        Day + time job scheduling
│   ├── platform.ts         OS difference abstraction (binary names, DL paths, chmod)
│   ├── paths.ts            Data root paths (Win: LOCALAPPDATA / Linux: XDG_DATA_HOME)
│   ├── settings.ts         app-settings.json read/write
│   ├── ipc.ts              IPC handler consolidation
│   └── preload.ts          Restricted exposure via contextBridge
├── renderer/        Electron Renderer (React + Vite + Tailwind v4)
└── shared/          Shared types for Main/Renderer

```

## Known Build Issues

### Windows: Symlink error during `winCodeSign` extraction

When `electron-builder` extracts the `winCodeSign` bundle, it may attempt to create macOS symbolic links (.dylib) and fail (`Cannot create symbolic link`). Enabling **Windows Developer Mode** or **running as Administrator** resolves this issue. Temporary workaround:

```bash
# Manually place the extracted folder into Cache/winCodeSign (excluding darwin)
node_modules/7zip-bin/win/x64/7za.exe x <hash>.7z -o<HOME>/AppData/Local/electron-builder/Cache/winCodeSign/winCodeSign-2.6.0 -xr'!darwin' -y

```

### Linux AppImage cannot be built from a Windows host

Generating an `AppImage` also requires symbolic link permissions, which causes builds from Windows to fail. Target `tar.gz` builds will succeed. If you need a complete AppImage, build it on a Linux host (or Docker).

### Linux: chrome-sandbox

Due to a general Electron constraint, `chrome-sandbox` requires setuid root. Apply `chmod 4755` as shown above after extracting the tar.gz file, or launch with `--no-sandbox`.

## Release Publishing (For Maintainers)

Steps to publish a new version to GitHub Releases:

```bash
# 1. Regenerate build artifacts
npm run build
npx electron-builder --win --linux tar.gz

# 2. Generate SHA256
node -e "const fs=require('fs'),c=require('crypto'),p=require('path');
const dir='release';
const files=['Bedrock Server Manager-Setup-0.1.0.exe','Bedrock-Server-Manager-portable-0.1.0.zip','Bedrock Server Manager-0.1.0.tar.gz'];
const o=files.map(f=>c.createHash('sha256').update(fs.readFileSync(p.join(dir,f))).digest('hex')+'  '+f).join('\n');
fs.writeFileSync(p.join(dir,'checksums.sha256'),o+'\n');console.log(o);"

# 3. Create tag & push
git tag v0.1.0
git push origin main --tags

# 4. Create Release via gh CLI (If gh is not installed, proceed to step 5)
gh release create v0.1.0 \
  "release/Bedrock Server Manager-Setup-0.1.0.exe" \
  "release/Bedrock-Server-Manager-portable-0.1.0.zip" \
  "release/Bedrock Server Manager-0.1.0.tar.gz" \
  "release/checksums.sha256" \
  --title "v0.1.0" --notes-file docs/release-notes-v0.1.0.md

```

**Browser Instructions (If `gh` CLI is unavailable):**

1. Go to the target repository on GitHub -> **Releases** -> **Draft a new release**
2. Tag: `v0.1.0` (pointing to main)
3. Title: `v0.1.0`, copy and paste the contents of `docs/release-notes-v0.1.0.md` into the description
4. Attach the 4 files in `release/` (installer / portable.zip / tar.gz / checksums.sha256)
5. **Publish release**

For promotional drafts (X posts, YouTube scripts, descriptions), refer to [`docs/promo.md`](https://www.google.com/search?q=docs/promo.md).

## License / Terms of Use

* The app core is licensed under the **MIT License** ([LICENSE](https://www.google.com/search?q=LICENSE))
* This app **does not bundle** `bedrock_server` or `playit.exe`. They are fetched from official sources on initial launch
* Use of `bedrock_server` requires agreement to the Microsoft EULA (presented during the app's initial launch flow)
* `playit.exe` is automatically downloaded from the official releases of `playit-cloud/playit-agent` (GPL)
