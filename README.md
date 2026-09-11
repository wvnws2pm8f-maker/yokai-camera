# 妖怪カメラ（Phase 1）

写真を撮ると、その土地(都道府県)にちなんだ妖怪が写真に写りこむ、
子ども向けの妖怪図鑑アプリ（PWA）です。

設計のねらいやフェーズ計画は、MulmoClaude側の
`artifacts/documents/2026/09/yokai-camera-plan-*.md` にまとめてあります。

## このPhase 1でできること

- 📷 写真を撮ると、GPSから自動で都道府県を判定（GPSが取れない/失敗した場合は手動で選べる）
- 🎲 その都道府県の伝承妖怪＋全国共通の「身近なものおばけ」の中からランダムに1体を抽選
- 🖼️ 写真に妖怪を重ねて表示（**仮あわせ版**：AI合成用のCloudflare Workerが未設定のあいだは、絵文字を写真に重ねるだけのモック合成で動作確認できます）
- 📖 ゲットした妖怪を図鑑として記録（IndexedDBにローカル保存、都道府県・鳴き声・説明つき）
- 🌐 Service Workerでアプリ自体はオフラインでも起動できる

## まだ入っていない機能（次のフェーズで追加予定）

- 🎨 **本物のAI合成**：Cloudflare Workersを立てて、Geminiの画像編集APIで本当に妖怪が写真に写りこむようにする（Phase 1後半）
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

## AI合成(Cloudflare Workers)を有効にするための設定 ※準備中

Worker側の実装がまだ無いため、現時点では未設定でOKです（仮あわせモックで動作します）。
Workerを用意したら、以下の手順でつなぎこみます。

1. Cloudflare Workersでエンドポイントを作成し、GeminiのAPIキーをシークレットとして登録
2. GitHubのリポジトリ画面 → `Settings` → `Secrets and variables` → `Actions` を開く
3. 「New repository secret」を押し、
   - Name: `WORKER_URL`
   - Secret: CloudflareのWorkerのURL
   を入力して保存する
4. `main` ブランチに何かpushすると、次のビルドからAI合成が有効になる

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
