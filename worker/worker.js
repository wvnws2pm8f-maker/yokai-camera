// 妖怪カメラ Cloudflare Worker (Workers AI版)
//
// 2つの役割がある:
//
// 1. イラスト生成モード ( body.action === "illustrate" )
//    妖怪1体につき1回だけ呼び出す管理用エンドポイント。軽量なテキスト→画像モデル
//    (FLUX.1 schnell)で、その妖怪の立ち絵イラストを生成して返す。生成した画像は
//    アプリのリポジトリに静的ファイルとして保存し(public/yokai-art/<id>.jpg)、
//    以後は毎回このAPIを呼ばずに使い回す。
//
// 2. (旧)写真編集モード (デフォルト、photoDataUrl/yokaiName/appearanceを渡す)
//    撮影した写真そのものにAIで妖怪を描き込む方式。FLUX.2 [dev]という重い
//    画像編集モデルを毎回呼ぶ必要があり、Workers AI側の混雑で
//    「Capacity temporarily exceeded」「Request timeout」が頻発したため、
//    2026-09-19に本番のアプリからは呼ばなくなった(かわりに1のイラストを
//    写真にクライアント側で重ねる方式に変更)。コードは万一の切り戻し用に残してある。
//
// 必要な設定:
//   1. このWorkerに「Workers AI」のバインディングを追加し、変数名を `AI` にする
//      (Cloudflareダッシュボード > このWorker > Bindings タブ > Add binding)
//   2. 環境変数(Settings > Variables and Secrets)に APP_SECRET を設定
//      (無料枠を他人に消費されないための合言葉。フロント側の VITE_APP_SECRET と同じ値)

const ILLUSTRATION_MODEL = '@cf/black-forest-labs/flux-1-schnell'
const IMAGE_EDIT_MODEL = '@cf/black-forest-labs/flux-2-dev' // 旧・写真編集モード用

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

    if (body && body.action === 'illustrate') {
      return handleIllustrate(env, body)
    }
    return handleLegacyPhotoEdit(env, body)
  }
}

// --- 1. イラスト生成モード ---
// body.model / body.steps / body.multipart で挙動を差し替えられるようにしてある。
// (モデルやパラメータを試行錯誤する際に、Workerを再デプロイしなくて済むようにするため)
async function handleIllustrate(env, body) {
  const { prompt, model, steps, multipart } = body || {}
  if (!prompt) {
    return json({ error: 'promptが必要です' }, 400)
  }
  const chosenModel = model || ILLUSTRATION_MODEL
  const chosenSteps = steps || 6

  const result = await runWithRetry(async () => {
    if (multipart) {
      const form = new FormData()
      form.append('prompt', prompt)
      form.append('steps', String(chosenSteps))
      const encodedRequest = new Request('https://dummy.local/', { method: 'POST', body: form })
      const contentType = encodedRequest.headers.get('content-type')
      return env.AI.run(chosenModel, { multipart: { body: encodedRequest.body, contentType } })
    }
    return env.AI.run(chosenModel, { prompt, steps: chosenSteps })
  })

  if (result.error) {
    return json({ error: `イラスト生成に失敗しました: ${result.error}` }, 502)
  }

  const outBase64 =
    typeof result.value === 'string' ? result.value : result.value?.image || result.value?.result?.image
  if (!outBase64) {
    console.error('Workers AI returned no image', JSON.stringify(result.value).slice(0, 2000))
    return json({ error: 'イラストを生成できませんでした' }, 502)
  }

  return json({ imageDataUrl: `data:image/jpeg;base64,${outBase64}` })
}

// --- 2. (旧)写真編集モード ---
async function handleLegacyPhotoEdit(env, body) {
  const { photoDataUrl, yokaiName, appearance } = body || {}
  if (!photoDataUrl || !yokaiName || !appearance) {
    return json({ error: 'photoDataUrl / yokaiName / appearance がすべて必要です' }, 400)
  }

  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(photoDataUrl)
  if (!match) {
    return json({ error: '写真データの形式が正しくありません(data URLではありません)' }, 400)
  }
  const [, mimeType, base64Data] = match

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

  const result = await runWithRetry(async () => {
    const form = new FormData()
    form.append('input_image_0', imageBlob, 'photo')
    form.append('prompt', prompt)
    form.append('steps', '15')
    const encodedRequest = new Request('https://dummy.local/', { method: 'POST', body: form })
    const multipartContentType = encodedRequest.headers.get('content-type')
    return env.AI.run(IMAGE_EDIT_MODEL, {
      multipart: { body: encodedRequest.body, contentType: multipartContentType }
    })
  })

  if (result.error) {
    return json({ error: `Workers AIの呼び出しに失敗しました: ${result.error}` }, 502)
  }

  const outBase64 =
    typeof result.value === 'string' ? result.value : result.value?.image || result.value?.result?.image
  if (!outBase64) {
    console.error('Workers AI returned no image', JSON.stringify(result.value).slice(0, 2000))
    return json({ error: 'AIが画像を生成しませんでした' }, 502)
  }

  return json({ imageDataUrl: `data:image/png;base64,${outBase64}` })
}

// Workers AI側が「Capacity temporarily exceeded」「Request timeout」のような一時的な
// エラーを返すことがあるため、最大2回まで試す共通ヘルパー。
// 戻り値は { value } か { error } のどちらか。
async function runWithRetry(fn, maxAttempts = 2) {
  let lastErr
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const value = await fn()
      return { value }
    } catch (err) {
      lastErr = err
      const msg = err && err.message ? err.message : String(err)
      console.error(`Workers AI error (試行${attempt}/${maxAttempts})`, msg)
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1200))
      }
    }
  }
  return { error: lastErr && lastErr.message ? lastErr.message : String(lastErr) }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  })
}
