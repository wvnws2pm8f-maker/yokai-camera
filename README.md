# 妖怪カメラ（Phase 1）

写真を撮ると、その土地(都道府県)にちなんだ妖怪が写真に写りこむ、
子ども向けの妖怪図鑑アプリ（PWA）です。

設計のねらいやフェーズ計画は、MulmoClaude側の
`artifacts/documents/2026/09/yokai-camera-plan-*.md` にまとめてあります。

## このPhase 1でできること

- 📷 写真を撮ると、GPSから自動で都道府県を判定（GPSが取れない/失敗した場合は手動で選べる）
- 🎲 その都道府県の伝承妖怪＋全国共通の「身近なものおばけ」の中からランダムに1体を抽選
- 🎨 写真に妖怪を自然に合成して表示（Cloudflare Workers経由でGeminiの画像編集AIを呼び出す。**未設定の場合は自動で「仮あわせ」モック合成にフォールバック**するので、Worker未設定でも動作確認はできる）
- 📖 ゲットした妖怪を図鑑として記録（IndexedDBにローカル保存、都道府県・鳴き声・説明つき）
- 🌐 Service Workerでアプリ自体はオフラインでも起動できる

## まだ入っていない機能（次のフェーズで追加予定）

- 47都道府県ぜんぶの妖怪データ（今は東京都・岩手県のみ）
- 演出の磨き込み（鳴き声の再生、ゲット時のアニメーションなど）

## 開発者向け: ローカルで動かす

```bash
npm install
npm run dev
```

`http://localhost:5173` が起動します。カメラ・位置情報を試すにはスマホの実機が必要なので、
`npm run dev -- --host` にして同じWi-Fi内のiPhoneなどからアクセスしてください
（ブラウザがカメラ/位置情報の許可を求めるので「許可」を選んでください）。

## ビルド

```bash
npm run build
npm run preview
```

## AI合成(Cloudflare Workers)を有効にするための設定

Worker本体のコードは `worker/worker.js` に用意してあります。**wranglerコマンドやCLIは不要**、
Cloudflareのダッシュボード(ブラウザ)だけで設定できます。

### 1. Cloudflareアカウントを作る

https://dash.cloudflare.com/sign-up で無料アカウントを作成(クレジットカード不要)。

### 2. Workerを作成する

1. ダッシュボード左メニューの `Workers & Pages` → `Create` (または `Create application`)
2. `Create Worker` を選び、名前を `yokai-camera-worker` などにして `Deploy`
   (最初は「Hello World」のサンプルコードがデプロイされる)
3. デプロイ後、`Edit code`(Quick Edit)を開く
4. エディタの中身を全部消して、このリポジトリの `worker/worker.js` の中身を
   丸ごとコピー＆ペースト
5. `Save and deploy`(または `Deploy`)を押す
6. 画面上部に表示される Worker の URL(例: `https://yokai-camera-worker.<自分のsubdomain>.workers.dev`)を控えておく

### 3. 環境変数(APIキー・合言葉)を設定する

1. GeminiのAPIキーがまだ無ければ https://aistudio.google.com/ で無料発行(御蔵島図鑑のときと同じ手順)
2. Worker画面の `Settings` → `Variables and Secrets` を開く
3. `Add` で以下の2つを追加(どちらも「Secret」推奨):
   - `GEMINI_API_KEY`: 発行したGeminiのAPIキー
   - `APP_SECRET`: 好きな合言葉(何でもよい。第三者がこのURLを直接叩けないようにするためのガード)
4. 保存(Deploy)する

### 4. GitHub側にWorkerのURLと合言葉を登録する

1. GitHubのリポジトリ画面 → `Settings` → `Secrets and variables` → `Actions` を開く
2. 「New repository secret」を2回押して、それぞれ登録:
   - Name: `WORKER_URL` / Secret: 手順2で控えたWorkerのURL
   - Name: `APP_SECRET` / Secret: 手順3で決めた合言葉(Worker側と完全に同じ値にする)
3. `main` ブランチに何かpushする(または `Actions` タブから `Deploy to GitHub Pages` を `Re-run all jobs`)と、
   次のビルドからAI合成が有効になる

これで「仮あわせ」表示だった部分が、本物のAI合成画像に切り替わります。

## GitHub Pagesへの公開手順

1. このフォルダの中身を、GitHub上に作成したリポジトリ（例: `yokai-camera`）にpushする
2. GitHubのリポジトリ画面 → `Settings` → `Pages` を開く
3. 「Build and deployment」の `Source` を **GitHub Actions** にする
4. `main` ブランチにpushすると、`.github/workflows/deploy.yml` が自動でビルド＆公開してくれる
5. 数分後、`https://<ユーザー名>.github.io/yokai-camera/` でアプリが開けるようになる

まずは家族専用アプリとして運用する想定なので、`public/robots.txt` で検索エンジンには
非表示にしてあります（URLを知っている人だけがアクセスできます）。

## iPhoneへのインストール（ホーム画面に追加）

1. 公開されたURLをiPhoneのSafariで開く
2. 共有ボタン（□に↑のアイコン）をタップ
3. 「ホーム画面に追加」を選ぶ
4. ホーム画面のアイコンから起動すると、Safariのバーが無いアプリのような見た目で動く

⚠️ 妖怪合成はその場でAIを呼び出す仕様のため、撮影時はオンライン(Wi-Fiやモバイル回線)が必要です。
