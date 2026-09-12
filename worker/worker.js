// 妖怪カメラ AI合成用 Cloudflare Worker (Workers AI版)
//
// フロントエンド(GitHub Pages上の静的サイト)から、撮影した写真と選ばれた妖怪の
// 情報(名前・見た目の特徴)を受け取り、Cloudflare Workers AI の画像編集モデル
// (FLUX.2 [dev])を使って妖怪を写真に合成し、結果画像をフロントに返す。
//
// 【2026-09-12 方針変更の経緯】
// 当初はGoogle GeminiのAPI(gemini-3.1-flash-image-preview)を使う設計だったが、
// 実際に呼び出したところ「無料枠の上限が0」(課金設定が無いと1回も使えない)
// ことが判明し断念した。代わりにCloudflare自身のWorkers AI
// (1日10,000ニューロンまで無料・カード登録不要・上限に達しても課金されず
// 単に使えなくなるだけ)にある画像編集モデル @cf/black-forest-labs/flux-2-dev
// に切り替えた。これによりGEMINI_API_KEYは不要になった。
//
// 必要な設定:
//   1. このWorkerに「Workers AI」のバインディングを追加し、変数名を
//      `AI` にする
//      (Cloudflareダッシュボード > このWorker > Bindings タブ > Add binding)
//   2. 環境変数(Settings > Variables and Secrets)に APP_SECRET を設定
//      (家族専用アプリを守る合言葉。フロント側の環境変数 VITE_APP_SECRET と
//      同じ値にすること。無料枠を他人に消費されないためのガード)
//
// 【モデル名についての注意】
// Cloudflare Workers AIのモデルカタログは今後も更新される可能性がある。
// このモデルが使えなくなったら、まず以下でカタログを確認すること:
// https://developers.cloudflare.com/workers-ai/models/ (image-to-imageカテゴリ)

const IMAGE_MODEL = '@cf/black-forest-labs/flux-2-dev'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-App-Secret'
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS })
    }
    if (request.method !== 'POST') {
      return json({ error: 'POSTのみ対応しています' }, 405)
    }

    // 合言葉チェック(第三者による無断利用・無料枠消費を防ぐ簡易ガード)
    if (env.APP_SECRET) {
      const provided = request.headers.get('X-App-Secret')
      if (provided !== env.APP_SECRET) {
        return json({ error: '合言葉が違います' }, 401)
      }
    }

    if (!env.AI) {
      return json(
        { error: 'Workers AIのバインディング(AI)が設定されていません。CloudflareダッシュボードのBindingsタブで追加してください' },
        500
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return json({ error: 'リクエストの形式が正しくありません(JSONとして読めません)' }, 400)
    }

    const { photoDataUrl, yokaiName, appearance } = body || {}
    if (!photoDataUrl || !yokaiName || !appearance) {
      return json({ error: 'photoDataUrl / yokaiName / appearance がすべて必要です' }, 400)
    }

    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(photoDataUrl)
    if (!match) {
      return json({ error: '写真データの形式が正しくありません(data URLではありません)' }, 400)
    }
    const [, mimeType, base64Data] = match

    // base64 → バイナリ(Uint8Array)に変換して、multipart送信用のBlobを作る
    let imageBlob
    try {
      const binary = atob(base64Data)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      imageBlob = new Blob([bytes], { type: mimeType })
    } catch (err) {
      return json({ error: `写真データのデコードに失敗しました: ${err.message}` }, 400)
    }

    const prompt =
      `Add the following yokai (Japanese folklore creature) naturally into this photo, ` +
      `matching the background, lighting, perspective and scale so it looks like it is really ` +
      `standing/floating there. Keep everything else in the photo (people, background, objects) ` +
      `unchanged. Yokai name: ${yokaiName}. Appearance: ${appearance}. ` +
      `This is for a children's app, so keep the mood friendly and not too scary.`

    const form = new FormData()
    form.append('input_image_0', imageBlob, 'photo')
    form.append('prompt', prompt)
    form.append('steps', '25')

    let aiResult
    try {
      aiResult = await env.AI.run(IMAGE_MODEL, {
        multipart: { body: form, contentType: 'multipart/form-data' }
      })
    } catch (err) {
      console.error('Workers AI error', err && err.message ? err.message : String(err))
      return json({ error: `Workers AIの呼び出しに失敗しました: ${err && err.message ? err.message : err}` }, 502)
    }

    const outBase64 =
      typeof aiResult === 'string' ? aiResult : aiResult?.image || aiResult?.result?.image

    if (!outBase64) {
      console.error('Workers AI returned no image', JSON.stringify(aiResult).slice(0, 2000))
      return json({ error: 'AIが画像を生成しませんでした' }, 502)
    }

    return json({ imageDataUrl: `data:image/png;base64,${outBase64}` })
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  })
}
