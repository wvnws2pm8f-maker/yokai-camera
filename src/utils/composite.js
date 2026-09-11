// 撮影した写真に妖怪を写りこませる処理。
//
// VITE_WORKER_URL が設定されていれば、Cloudflare Workers経由でGeminiの
// 画像編集AIを呼び出して本物の合成画像を作る(本番動作)。
// 未設定の場合は、Workerが用意できるまでの「仮あわせ」として、
// canvasで写真の上に妖怪の絵文字を大きく重ねるだけのモック合成を行う。
const WORKER_URL = import.meta.env.VITE_WORKER_URL

export async function compositeYokaiOntoPhoto(photoDataUrl, yokai) {
  if (WORKER_URL) {
    try {
      return await compositeViaWorker(photoDataUrl, yokai)
    } catch (err) {
      console.error('Worker合成に失敗、モック合成にフォールバックします', err)
    }
  }
  return await mockComposite(photoDataUrl, yokai)
}

async function compositeViaWorker(photoDataUrl, yokai) {
  const res = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      photoDataUrl,
      yokaiName: yokai.name,
      appearance: yokai.appearance
    })
  })
  if (!res.ok) {
    throw new Error(`Worker応答エラー: ${res.status}`)
  }
  const json = await res.json()
  if (!json.imageDataUrl) {
    throw new Error('Workerの応答にimageDataUrlが含まれていません')
  }
  return { imageDataUrl: json.imageDataUrl, isMock: false }
}

function mockComposite(photoDataUrl, yokai) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)

      // 妖怪の絵文字を、写真のどこかにランダムな位置・大きさ・傾きで重ねる
      const size = canvas.width * (0.28 + Math.random() * 0.14)
      const x = canvas.width * (0.2 + Math.random() * 0.6)
      const y = canvas.height * (0.3 + Math.random() * 0.4)
      const angle = (Math.random() - 0.5) * 0.4

      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(angle)
      ctx.font = `${size}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowColor = 'rgba(0,0,0,0.45)'
      ctx.shadowBlur = size * 0.08
      ctx.fillText(yokai.emoji || '👻', 0, 0)
      ctx.restore()

      // 「仮あわせ」であることを示す小さなラベル
      ctx.font = `${Math.max(14, canvas.width * 0.03)}px sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'bottom'
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(0, canvas.height - canvas.width * 0.055, canvas.width, canvas.width * 0.055)
      ctx.fillStyle = '#ffffff'
      ctx.fillText('仮あわせ(AI合成は準備中)', canvas.width * 0.02, canvas.height - canvas.width * 0.012)

      resolve({ imageDataUrl: canvas.toDataURL('image/jpeg', 0.9), isMock: true })
    }
    img.onerror = () => reject(new Error('写真の読み込みに失敗しました'))
    img.src = photoDataUrl
  })
}
