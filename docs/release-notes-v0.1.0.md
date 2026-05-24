# v0.1.0 — 初回リリース

Minecraft 統合版（Bedrock Edition）の自宅サーバーを、Windows / Linux で誰でも数クリックで立てて友達と遊べるようにする無料デスクトップアプリです。**完全無料・ポート開放不要**（playit.gg 連携内蔵）。

## ハイライト

- 公式 `bedrock_server` を自動ダウンロード・更新（再配布なし）
- サーバー起動/停止/再起動・リアルタイムコンソール・コマンド送信
- `server.properties` の GUI 編集（コメント保持）＋ raw エディタ
- 複数ワールド作成・切替・**`.mcworld` インポート**・**自動バックアップ＋復元**
- ホワイトリスト / オペレーター管理（allowlist.json / permissions.json）
- CPU / メモリ / 稼働時間グラフ
- **playit.gg 連携**でポート開放なしの外部接続（シークレット貼付方式）
- **「友達への案内文をコピー」** ボタンで共有が1クリック
- **スケジュール起動 / 停止**（曜日 + 時刻）
- **アドオン管理**（.mcpack / .mcaddon インポート、有効化トグル）
- Windows / Linux 両対応

## ダウンロード

| プラットフォーム | ファイル | サイズ |
|---|---|---|
| Windows（インストーラ） | `Bedrock Server Manager-Setup-0.1.0.exe` | ~101 MB |
| Windows（可搬版） | `Bedrock-Server-Manager-portable-0.1.0.zip` | ~146 MB |
| Linux（x64 tar.gz） | `Bedrock Server Manager-0.1.0.tar.gz` | ~116 MB |
| チェックサム | `checksums.sha256` | — |

## インストール手順

### Windows

1. インストーラ `.exe` をダウンロード
2. 実行時に **「Windows によってPCが保護されました」** と出たら **「詳細情報」→「実行」**（コード署名なしのため警告は出ますが、SHA256 を上のチェックサムで照合できます）
3. インストール先を選んで進める
4. 初回起動：利用規約 / Microsoft EULA に同意 → 自動ダウンロード → Dashboard 着地
5. **▶ サーバーを起動**

### Linux

```bash
tar -xzf "Bedrock Server Manager-0.1.0.tar.gz"
cd "Bedrock Server Manager-0.1.0"
./bedrock-server-manager
# サンドボックスエラーが出たら:
sudo chown root:root chrome-sandbox && sudo chmod 4755 chrome-sandbox
# または: ./bedrock-server-manager --no-sandbox
```

## 外部接続（friends に渡すアドレスを取得）

1. [playit.gg](https://playit.gg/) でアカウント作成
2. Agent を作り、**Bedrock（UDP）トンネル**を `127.0.0.1:19132` 向けに設定
3. アプリの **Config → 外部接続** にシークレットキーと外部アドレスを保存
4. **「外部接続を有効にする」** → アプリが playit を起動
5. **「友達への案内文をコピー」** で定型文を1クリック取得 → LINE 等で共有

## 既知の問題 / 制限

- **Windows SmartScreen 警告**：コード署名なし。SHA256 で改ざんなしを確認できます
- **macOS 未対応**（次バージョン候補）
- **Linux AppImage 未配布**：Windows ホストでのビルドが symlink 権限で失敗するため、当面は tar.gz のみ。AppImage 版が必要な場合は Linux 環境または Docker でセルフビルドしてください
- 外部接続の自動アドレス検出（playitd ログ解析）は best-effort。確実な表示はダッシュボードからのアドレス手入力で

## SHA256 チェックサム

```
e06c4028d22123b449a5dfcb40927e00e61dd68b257d6672046f5bbcd5cabef0  Bedrock Server Manager-Setup-0.1.0.exe
29cf25777a853d5c6b63cc4c3d478adb398deef23f231c05ff82d8e09077c237  Bedrock-Server-Manager-portable-0.1.0.zip
e0d51ef6a50e711c91d784157336c107fcfaf2ab52cffa1eadb5f1df77c1ce6d  Bedrock Server Manager-0.1.0.tar.gz
```

Windows での照合: PowerShell で `Get-FileHash <file> -Algorithm SHA256`
Linux での照合: `sha256sum -c checksums.sha256`

---

ライセンス: MIT
