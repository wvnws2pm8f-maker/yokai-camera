# 妖怪カメラ（Phase 1）

写真を撮ると、その土地(都道府県)にちなんだ妖怪が写真に写りこむ、
子ども向けの妖怪図鑑アプリ（PWA）です。

設計のねらいやフェーズ計画は、MulmoClaude側の
`artifacts/documents/2026/09/yokai-camera-plan-*.md` にまとめてあります。

## このPhase 1でできること

- 📷 写真を撮ると、GPSから自動で都道府県を判定（GPSが取れない/失敗した場合は手動で選べる）
- 🎲 その都道府県の伝承妖怪＋全国共通の「身近なものおばけ」の中からランダムに1体を抽選
- 🎨 写真に妖怪のイラストを重ねて表示（妖怪ごとに事前生成した立ち絵イラストを、撮影した写真の上にクライアント側のcanvasで合成。**撮影のたびにAIを呼ばないので、通信が混雑していても速く・確実に表示できる**）
- 📖 ゲットした妖怪を図鑑として記録（IndexedDBにローカル保存、都道府県・鳴き声・説明つき）
- 🌐 Service Workerでアプリ自体・妖怪イラストもオフラインでキャッシュされ、電波が無い場所でも動作する

## まだ入っていない機能（次のフェーズで追加予定）

- 47都道府県ぜんぶの妖怪データ（今は東京都・岩手県＋全国共通プールのみ）
- 演出の磨き込み（鳴き声の再生、ゲット時のアニメーションなど）

## 妖怪データの管理（MulmoClaudeの「コレクション」機能を使用）

`src/data/yokaiMaster.json` は手で直接編集する「原本」ではなく、
MulmoClaudeワークスペースの妖怪データベース（コレクション、`/collections/yokai`）
から自動生成される**ビルド成果物**です。

- 妖怪の追加・編集は `/collections/yokai` の画面（表形式）で行う
- 編集したら、このリポジトリで以下を実行して反映する:

```bash
node scripts/sync-yokai-from-collection.mjs
npm run build   # 反映確認
```

- コレクションには `referenceImage`（デザイン確認用に生成したイラストのプレビュー画像）
  というフィールドもあり、見た目のイメージを確認・調整できる
- 妖怪を追加・変更した後は、下記の「妖怪イラストの生成」も忘れずに実行すること

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

## 妖怪イラストの合成方式(2026-09-19〜)

**撮影のたびにAIを呼ぶのではなく、妖怪ごとに1回だけ生成した立ち絵イラスト
(`public/yokai-art/<id>.jpg`)を、撮影した写真の上にクライアント側のcanvasで
重ね合わせる方式**にしています。

以前は撮影のたびにCloudflare Workers AI(画像編集モデル `flux-2-dev`)へ
その場でリクエストしていましたが、Workers AI側の混雑で
「Capacity temporarily exceeded」「Request timeout」が頻発し、失敗率が
高いという問題がありました。妖怪の見た目は毎回変わる必要が無い(同じ妖怪なら
同じ姿でよい)ため、イラストを事前生成してアプリに同梱する方式に切り替え、
これにより:

- 撮影→表示が一瞬（ライブAI呼び出しの待ち時間が無い）
- Cloudflare側の混雑の影響を受けない
- オフラインでも動作する(Service Workerでイラストごとキャッシュ済み)

というメリットがあります。イラストは単色背景で生成し、実行時に
`src/utils/composite.js` がその背景色を自動検出して透過処理してから
写真に重ねています(単純なクロマキー処理)。

### 妖怪イラストの生成(妖怪を追加・変更したとき)

Cloudflare Worker(`worker/worker.js`、`action: "illustrate"`)経由で
軽量なテキスト→画像モデル(`@cf/black-forest-labs/flux-1-schnell`)を呼び出す。
Worker自体のセットアップ手順は次の節を参照。

```bash
# 未生成のものだけ作る(新しく追加した妖怪など)
node scripts/generate-yokai-art.mjs

# 既存のものも含めて全部作り直す
node scripts/generate-yokai-art.mjs --force

# 特定の妖怪だけ作り直す(見た目を直したとき)
node scripts/generate-yokai-art.mjs --force --only=iwate-kappa
```

`public/yokai-art/<id>.jpg` に保存されるので、`git add` してコミットする。

### Cloudflare Workerのセットアップ

**wranglerコマンドやCLIは不要**、Cloudflareのダッシュボード(ブラウザ)だけで設定できます。
1日10,000ニューロンまで無料・クレジットカード登録不要・上限に達しても課金されず
単に使えなくなるだけ、という安心設計です(Workers AI)。

1. https://dash.cloudflare.com/sign-up で無料アカウントを作成(クレジットカード不要)
2. ダッシュボード左メニューの `Workers & Pages` → `Create` → `Create Worker`
   → 名前を `yokai-camera-worker` などにして `Deploy`
3. デプロイ後、`Edit code`(Quick Edit)を開き、中身を全部消して
   このリポジトリの `worker/worker.js` の中身を丸ごとコピー＆ペースト → `Deploy`
4. `Bindings` タブ → `Add binding` → `Workers AI` を選び、変数名を
   **`AI`** にして保存(コード側と合わせる必要があるので必ず`AI`にする)
5. `Settings` → `Variables and Secrets` → `Add` で `APP_SECRET`(好きな合言葉、
   第三者がこのURLを直接叩いて無料枠を消費できないようにするためのガード)を追加
6. 画面上部に表示されるWorkerのURルを控えておく
   (例: `https://yokai-camera-worker.<自分のsubdomain>.workers.dev`)

このWorker URLと合言葉は、`scripts/generate-yokai-art.mjs` を実行する端末の
環境変数 `WORKER_URL` / `WORKER_APP_SECRET` で渡す(未設定時はコード内の
デフォルト値を使う)。**アプリ本体(フロントエンド)のビルドにはWorkerの情報は
不要**(妖怪イラスト生成の管理用途にしか使わないため)。

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

妖怪合成は事前生成イラストをその場でcanvas合成するだけなので、電波が無い場所でも動作します
(初回アクセス時にService Workerがアプリ本体・妖怪イラストをキャッシュしていれば)。
GPSでの都道府県判定だけはオンラインの逆ジオコーディングAPIを使うため、そこだけ通信が必要です。
