# Bedrock Server Manager

Minecraft 統合版（Bedrock Edition）の自宅サーバーを、Windows / Linux で誰でも数クリックで立てて友達と遊べるようにする、完全無料のデスクトップアプリです。

公式 `bedrock_server` をラップし、`playit.gg` を介した外部接続（ポート開放不要）まで一通りカバーします。

## 主な機能

- サーバーの起動/停止/再起動、コンソール（リアルタイムログ・コマンド送信）、クラッシュ自動再起動
- 公式 BDS の自動ダウンロード／アップデート（Bedrock-OSS/BDS-Versions の最新安定版を参照）
- `server.properties` の GUI 編集＋詳細 raw エディタ
- 複数ワールドの作成・切替・`.mcworld` インポート、停止時自動バックアップ＋復元
- プレイヤー管理：オンライン一覧（kick/op）、`allowlist.json`、`permissions.json`（XUID）
- リソース監視：CPU / メモリ / 稼働時間グラフ（直近5分・1秒更新）
- 外部接続（playit.gg）：シークレット貼付方式でデーモンを自前管理／LAN内アドレス案内／友達への案内文を1クリックコピー
- スケジュール起動/停止（曜日 + HH:MM、start / stop / restart）
- アドオン管理（`.mcpack`/`.mcaddon` インポート、`world_*_packs.json` の有効化トグル）

## 動作環境

- Windows 10 / 11（x64）
- Linux x64（実機検証は別環境にて。`tar.gz` 可搬版を配布）

## インストール / 起動

### Windows

1. `release/Bedrock Server Manager-Setup-0.1.0.exe` を実行（NSIS インストーラ）
2. インストール先を選択して進める
3. 初回起動：利用規約 / Microsoft EULA に同意 → 公式 BDS を自動ダウンロード → Dashboard 着地
4. **▶ サーバーを起動**

データ・ワールド・設定は `%LOCALAPPDATA%\BedrockServerManager\` に保存されます。

### Linux

```bash
tar -xzf "Bedrock Server Manager-0.1.0.tar.gz"
cd "Bedrock Server Manager-0.1.0"
./bedrock-server-manager
```

`Failed to move to new namespace`（chrome-sandbox）が出た場合：

```bash
sudo chown root:root chrome-sandbox && sudo chmod 4755 chrome-sandbox
# あるいは
./bedrock-server-manager --no-sandbox
```

データ・ワールド・設定は `$XDG_DATA_HOME/BedrockServerManager`（既定 `~/.local/share/BedrockServerManager`）に保存されます。

## 外部接続（playit.gg）

1. [playit.gg](https://playit.gg/) でアカウント作成
2. Agent を追加し、**Minecraft Bedrock（UDP）トンネル**を `127.0.0.1:19132` 向けに作成
3. 公式インストーラ版で接続した PC では `C:\ProgramData\playit_gg\playit.toml`（Linux は `~/.config/playit_gg/playit.toml` 等）に `secret_key` が保存されています。それを取り出してアプリの **Config → 外部接続 → シークレットキー** に貼って保存
4. playit ダッシュボードに表示される外部アドレス（例 `xxx.gl.at.ply.gg:12345`）を Config → 外部接続 → 外部アドレス欄に保存
5. **外部接続を有効にする** → アプリが `playit.exe --secret <KEY>`（Linux は `playit --secret <KEY>`）でデーモンを起動
6. Dashboard で **▶ サーバーを起動**
7. **「友達への案内文をコピー」** ボタンで定型文をコピー → LINE 等に貼って友達に送る

> 公式 playit サービス（`playitd`）が既に常駐している場合、アプリが同じシークレットで起動すると同一エージェントの2重起動になります。アプリで管理するなら先に公式サービスを停止してください（Windows: 管理者で `net stop playitd`、自動起動も無効化推奨）。

## Windows でログオン時に自動起動

Bedrock サーバーと playit はアプリが起動している間だけ動きます。PC 起動時にアプリを自動起動するには：

1. `Win + R` → `taskschd.msc` → タスクスケジューラを開く
2. 「**基本タスクの作成**」→ 名前: `Bedrock Server Manager`
3. トリガー: **ログオン時**
4. 操作: **プログラムの開始** → プログラム/スクリプト：インストールした `Bedrock Server Manager.exe` を指定
5. 「最上位の特権で実行する」にチェック（プロセス管理を安定させたい場合）
6. 完了

スケジュール起動/停止（Config → スケジュール）と組み合わせると、PC 起動 → アプリ起動 → 指定時刻にサーバー自動起動、まで自動化できます。

## 開発

```bash
npm install
npm run dev     # vite + electron 起動（ホットリロード）
npm run typecheck
npm run build   # tsc --noEmit && vite build（renderer + main + preload を dist/, dist-electron/ に生成）
npm run dist    # build → electron-builder で OS 別パッケージ
```

リポジトリ構成：

```
src/
├── main/            Electron Main プロセス
│   ├── index.ts
│   ├── server-manager.ts   bedrock_server プロセス管理
│   ├── playit-manager.ts   playit デーモン管理（シークレット方式）
│   ├── config-manager.ts   server.properties 読み書き
│   ├── world-manager.ts    ワールド作成/切替/.mcworld インポート/デフォルト準備
│   ├── backup-manager.ts   ワールドバックアップ zip 化＋復元
│   ├── addon-manager.ts    .mcpack/.mcaddon 取り込み・有効化
│   ├── player-manager.ts   allowlist/permissions/known-players
│   ├── downloader.ts       BDS 自動DL（プラットフォーム別 URL）
│   ├── log-parser.ts       ログレベル判定・入退室イベント抽出
│   ├── metrics.ts          pidusage で CPU/メモリ
│   ├── scheduler.ts        曜日+時刻のジョブ判定
│   ├── platform.ts         OS差異抽象化（バイナリ名・DLパス・chmod）
│   ├── paths.ts            データルート（Win: LOCALAPPDATA / Linux: XDG_DATA_HOME）
│   ├── settings.ts         app-settings.json 読み書き
│   ├── ipc.ts              IPC ハンドラ集約
│   └── preload.ts          contextBridge で限定公開
├── renderer/        Electron Renderer (React + Vite + Tailwind v4)
└── shared/          Main/Renderer 共通型
```

## ビルド時の既知の問題

### Windows: `winCodeSign` 抽出で symlink エラー

`electron-builder` が `winCodeSign` バンドルを展開する際、macOS 用シンボリックリンク（.dylib）を作ろうとして失敗することがあります（`Cannot create symbolic link`）。**Windows の開発者モード ON**、または **管理者で実行**すれば解消します。今回の暫定回避：

```bash
# Cache/winCodeSign に手動で展開済みフォルダを置く（darwin 除外）
node_modules/7zip-bin/win/x64/7za.exe x <hash>.7z -o<HOME>/AppData/Local/electron-builder/Cache/winCodeSign/winCodeSign-2.6.0 -xr'!darwin' -y
```

### Linux AppImage は Windows ホストから生成不可

`AppImage` 生成も symlink 作成権限が必要なため、Windows からは失敗します。`tar.gz` ターゲットなら成功します。完全な AppImage が必要なら Linux ホスト（または Docker）でビルドしてください。

### Linux: chrome-sandbox

Electron アプリ全般の制約で、`chrome-sandbox` に setuid root が必要です。tar.gz 展開後に上記の `chmod 4755` で対応するか、`--no-sandbox` で起動してください。

## ライセンス / 利用上の注意

- 本アプリは `bedrock_server` および `playit.exe` を**同梱しません**。初回起動時に公式から取得します
- `bedrock_server` の利用には Microsoft EULA への同意が必要です（アプリの初回フローで提示）
- `playit.exe` は `playit-cloud/playit-agent`（GPL）の公式リリースから自動取得します
