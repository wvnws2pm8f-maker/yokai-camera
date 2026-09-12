// カメラで撮った写真を、AI合成に送る前に扱いやすい形へ正規化する。
//
// - iPhoneの写真はセンサーの向きのままのピクセルデータ＋「本当はこう回転して
//   表示してね」というEXIF情報、という形で保存されている。今回のように
//   バイナリのまま外部のAIモデルに渡す経路だとEXIF情報が無視されてしまい、
//   横向き/逆さまの写真になってしまうことがあった。createImageBitmapの
//   imageOrientation:'from-image'オプションでEXIFを反映してから
//   canvasに描き直すことで、正しい向きのまま送れるようにする。
// - ついでに長辺を最大1280pxまで縮小する。iPhoneの写真は数MBあり、
//   そのまま送るとアップロード・AI処理の両方に時間がかかるため。
const MAX_EDGE = 1280

export async function normalizePhoto(file) {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0, width, height)

    return canvas.toDataURL('image/jpeg', 0.85)
  } catch (err) {
    console.error('写真の正規化に失敗、そのままの写真を使います', err)
    return await readFileAsDataUrl(file)
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
