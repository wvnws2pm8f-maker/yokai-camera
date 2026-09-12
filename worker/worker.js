// 妖怪カメラ AI合成用 Cloudflare Worker
//
// フロントエンド(GitHub Pages上の静的サイト)から、撮影した写真と選ばれた妖怪の
// 情報(名前・見た目の特徴)を受け取り、GeminiのAPIキーはここ(サーバー側)だけで
// 保持したまま、Gemini 3.1 Flash Image(画像編集モデル)を呼び出して妖怪を写真に
// 自然に合成し、結果画像をフロントに返す。
//
// 使い方: Cloudflareダッシュボードの Workers & Pages で新規Workerを作成し、
// このファイルの中身を丸ごと貼り付けてデプロイする(Quick Edit)。
// wranglerコマンドやCLIは不要。
//
// 必要な環境変数(Cloudflareダッシュボードの Settings > Variables and Secrets で設定):
//   GEMINI_API_KEY : Google AI Studio(https://aistudio.google.com/)で発行した
//                    Geminiの無料APIキー
//   APP_SECRET     : 家族専用アプリなので、第三者がこのURLを直接叩いてAPI枠を
//                    消費できないようにするための合言葉(何でもよい)。
//                    フロント側の環境変数 VITE_APP_SECRET と同じ値にすること
//
// 【モデル名についての注意】(2026-09時点での調査結果)
// 画像編集モデルは gemini-2.5-flash-image(通称Nano Banana)が2026年10月2日で
// 提供終了予定のため、後継の gemini-3.1-flash-image-preview(通称Nano Banana 2、
// 2026年2月リリース)を使用する。過去にテキストモデルでも
// gemini-2.0-flash → gemini-3.6-flash への移行で同様のハマりがあったので、
// この合成が動かなくなったら、まずGoogleの公式ドキュメントで最新のモデル名を
// 確認すること(https://ai.google.dev/gemini-api/docs/models)。

const GEMINI_MODEL = 'gemini-3.1-flash-image-preview'
const GEMINI_URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

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

    // 合言葉チェック(第三者による無断利用・API枠消費を防ぐ簡易ガード)
    if (env.APP_SECRET) {
      const provided = request.headers.get('X-App-Secret')
      if (provided !== env.APP_SECRET) {
        return json({ error: '合言葉が違います' }, 401)
      }
    }

    if (!env.GEMINI_API_KEY) {
      return json({ error: 'GEMINI_API_KEYが設定されていません(Cloudflareダッシュボードで設定してください)' }, 500)
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

    const prompt =
      `この写真に、次の妖怪を自然に写り込ませてください。\n` +
      `妖怪の名前: ${yokaiName}\n` +
      `見た目の特徴: ${appearance}\n` +
      `写真の背景・光の当たり方・遠近感・被写体との距離感に合わせて、` +
      `妖怪がその場に本当にいるかのように違和感なく合成してください。` +
      `写真に写っている人物や風景など、妖怪以外の部分はできるだけ変えないでください。` +
      `子ども向けアプリなので、怖すぎない・親しみやすい雰囲気で描いてください。`

    let geminiRes
    try {
      geminiRes = await fetch(
        `${GEMINI_URL_BASE}/${GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64Data } }]
              }
            ],
            generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
          })
        }
      )
    } catch (err) {
      return json({ error: `Gemini APIへの接続に失敗しました: ${err.message}` }, 502)
    }

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      console.error('Gemini API error', geminiRes.status, errText)
      return json({ error: `Gemini APIエラー: ${geminiRes.status} ${errText}` }, 502)
    }

    const geminiJson = await geminiRes.json()
    const parts = geminiJson?.candidates?.[0]?.content?.parts || []
    const imagePart = parts.find((p) => p.inlineData || p.inline_data)
    const inline = imagePart?.inlineData || imagePart?.inline_data

    if (!inline?.data) {
      console.error('Gemini returned no image', JSON.stringify(geminiJson).slice(0, 2000))
      return json({ error: 'Geminiが画像を生成しませんでした(安全フィルタ等で拒否された可能性があります)' }, 502)
    }

    const outMime = inline.mimeType || inline.mime_type || 'image/png'
    const imageDataUrl = `data:${outMime};base64,${inline.data}`

    return json({ imageDataUrl })
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  })
}
