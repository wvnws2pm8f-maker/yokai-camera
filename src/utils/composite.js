// 撮影した写真に妖怪を写りこませる処理。
//
// 妖怪ごとに1枚だけ事前生成してある立ち絵イラスト(public/yokai-art/<id>.jpg、
// 単色背景)を、撮影した写真の上にクライアント側のcanvasで重ね合わせる。
//
// 【2026-09-19 方式変更】
// 以前は撮影のたびにCloudflare Workers経由でAIに写真編集を頼んでいたが、
// Workers AI側の混雑で「Capacity temporarily exceeded」「Request timeout」が
// 頻発し、失敗率が高かった。妖怪の見た目は毎回変わる必要が無い(同じ妖怪なら
// 同じ姿でよい)ため、立ち絵イラストを1体につき1回だけ事前生成してアプリに
// 同梱する方式に変更。撮影のたびのAI呼び出しが無くなり、混雑の影響を受けず、
// オフラインでも動作するようになった。
// イラストの生成は scripts/generate-yokai-art.mjs で行う(妖怪データベース更新時に再実行)。
export async function compositeYokaiOntoPhoto(photoDataUrl, yokai) {
  try {
    return await compositeWithIllustration(photoDataUrl, yokai)
  } catch (err) {
    console.error('イラスト合成に失敗、絵文字の仮あわせにフォールバックします', err)
    return await mockComposite(photoDataUrl, yokai)
  }
}

async function compositeWithIllustration(photoDataUrl, yokai) {
  const [photoImg, artImg] = await Promise.all([
    loadImage(photoDataUrl),
    loadImage(`yokai-art/${yokai.id}.jpg`)
  ])

  const artCanvas = makeTransparent(artImg)

  const canvas = document.createElement('canvas')
  canvas.width = photoImg.naturalWidth
  canvas.height = photoImg.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(photoImg, 0, 0)

  // 妖怪イラストを、写真のどこかにランダムな位置・大きさ・傾きで重ねる
  const artAspect = artCanvas.width / artCanvas.height
  const targetHeight = canvas.height * (0.32 + Math.random() * 0.16)
  const targetWidth = targetHeight * artAspect
  const x = canvas.width * (0.18 + Math.random() * 0.5)
  const y = canvas.height * (0.35 + Math.random() * 0.35)
  const angle = (Math.random() - 0.5) * 0.3

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.shadowColor = 'rgba(0,0,0,0.4)'
  ctx.shadowBlur = targetHeight * 0.06
  ctx.shadowOffsetY = targetHeight * 0.02
  ctx.drawImage(artCanvas, -targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight)
  ctx.restore()

  return { imageDataUrl: canvas.toDataURL('image/jpeg', 0.9), isMock: false }
}

// イラストの背景色(四隅の平均)に近いピクセルを透明にして、写真に重ねられる
// ようにする。単純なクロマキー処理(縁は少しフェザーしてギザギザを和らげる)。
function makeTransparent(img) {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)

  const { width, height } = canvas
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data

  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1]
  ]
  let bgR = 0
  let bgG = 0
  let bgB = 0
  for (const [cx, cy] of corners) {
    const i = (cy * width + cx) * 4
    bgR += data[i]
    bgG += data[i + 1]
    bgB += data[i + 2]
  }
  bgR /= corners.length
  bgG /= corners.length
  bgB /= corners.length

  const THRESHOLD = 60 // この距離以内を背景とみなす
  const FEATHER = 40 // 縁を滑らかにするための遷移幅

  for (let i = 0; i < data.length; i += 4) {
    const dr = data[i] - bgR
    const dg = data[i + 1] - bgG
    const db = data[i + 2] - bgB
    const dist = Math.sqrt(dr * dr + dg * dg + db * db)
    if (dist < THRESHOLD) {
      data[i + 3] = 0
    } else if (dist < THRESHOLD + FEATHER) {
      data[i + 3] = Math.round(255 * ((dist - THRESHOLD) / FEATHER))
    }
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`画像の読み込みに失敗しました: ${src}`))
    img.src = src
  })
}

// イラストファイルが無い/読み込めない場合の最終フォールバック(絵文字を重ねるだけ)
function mockComposite(photoDataUrl, yokai) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)

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

      ctx.font = `${Math.max(14, canvas.width * 0.03)}px sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'bottom'
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(0, canvas.height - canvas.width * 0.055, canvas.width, canvas.width * 0.055)
      ctx.fillStyle = '#ffffff'
      ctx.fillText('仮あわせ(イラスト読み込み失敗)', canvas.width * 0.02, canvas.height - canvas.width * 0.012)

      resolve({ imageDataUrl: canvas.toDataURL('image/jpeg', 0.9), isMock: true })
    }
    img.onerror = () => reject(new Error('写真の読み込みに失敗しました'))
    img.src = photoDataUrl
  })
}
