# Ghost (Raycast Extension)

[skanehira/ghost](https://github.com/skanehira/ghost)（バックグラウンドプロセスマネージャ）のプロセスを Raycast から管理する拡張。

## コマンド

- **Manage Processes** (`view`): `ghost list` の一覧表示。各プロセスを `🟢 running / ⚪ exited / 🔴 killed` のアイコンで表示し、停止・強制停止・ログ表示・Task ID コピー・終了済みクリーンアップができる。
- **Server Status** (`menu-bar`): preference の **Watch Command** に一致するプロセスの稼働状態をメニューバーアイコンで常時表示（🟢=起動中 / ⚪=停止中）。メニューから Start / Stop。Watch 未設定時は「実行中タスク数」を表示。

## Preferences

| 名前 | 説明 | 既定値 |
| --- | --- | --- |
| Ghost Binary Path | `ghost` バイナリのパス（空欄で自動検出） | （自動検出） |
| Watch Command | メニューバーで監視するコマンドの部分一致文字列 | `plamo-translate server` |
| Start Command | Start 実行時に `ghost run` で起動するコマンド | `plamo-translate server` |

> `ghost list` は長いコマンドを省略表示するため、Watch Command は 30 文字以内を推奨。

## 開発

依存管理は npm（Raycast Store の要件に合わせる）。

```sh
npm install
npm run dev     # = ray develop。Raycast に取り込まれ、ホットリロードで開発できる
npm run build   # ビルド検証
npm run lint    # lint
```

`npm run dev` を一度実行すると Raycast の拡張一覧に登録される。

## Store への公開

```sh
npm run publish  # = ray publish。raycast/extensions へ PR を自動作成する
```

公開前チェックリスト:

- [ ] `metadata/*.png` にスクリーンショットを追加（2000×1250、3〜6枚／Raycast 上で撮影）
- [ ] `package.json` の `author` を Raycast アカウントのユーザー名に一致させる
- [ ] description / preference / command の説明文を英語化（Store は英語が基本）
- [ ] `CHANGELOG.md` を更新
- [ ] `npm run build` / `npm run lint` がパスすること

## 実装メモ

- `ghost list` に JSON 出力がないため、ヘッダのカラム位置で固定幅テキストをパースしている（`src/ghost.ts` の `parseList`）。
- Raycast は最小限の PATH でプロセスを起動するため、`ghost` 本体と子コマンド（`plamo-translate` など）が解決できるよう PATH を補強している。
