// 外部の画像生成/画像編集ツールが使えない環境向けの、
// 依存ライブラリなし(Node標準のzlibのみ)でPNGアイコンを描く簡易スクリプト。
// カメラのレンズ ＝ 妖怪の一つ目、というモチーフを紫〜濃紺の背景に描画する。
// あとで generateImage などでちゃんとしたイラストに差し替えてOK。
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { mkdirSync } from 'node:fs'

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function makeIcon(size) {
  const data = Buffer.alloc(size * size * 4)
  const cx = size / 2
  const cy = size / 2

  // 背景: 斜めグラデーション(左上=濃い紫, 右下=濃紺)
  const top = [90, 50, 130] // #5a3282
  const bottom = [30, 20, 55] // #1e1437

  // レンズ(＝妖怪の一つ目)の白目・虹彩・瞳
  const eyeRadius = size * 0.3
  const irisRadius = size * 0.15
  const pupilRadius = size * 0.07

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = (x + y) / (size * 2)
      let r = Math.round(top[0] + (bottom[0] - top[0]) * t)
      let g = Math.round(top[1] + (bottom[1] - top[1]) * t)
      let b = Math.round(top[2] + (bottom[2] - top[2]) * t)

      const dx = x - cx
      const dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < eyeRadius) {
        // 白目
        r = 245; g = 240; b = 250
      }
      if (dist < eyeRadius && dist > eyeRadius - size * 0.02) {
        // まぶたのふち(こい紫)
        r = 40; g = 20; b = 55
      }
      if (dist < irisRadius) {
        // 虹彩(オレンジ)
        r = 230; g = 120; b = 40
      }
      if (dist < pupilRadius) {
        // 瞳(ほぼ黒)
        r = 25; g = 15; b = 20
      }
      // 光の反射(小さい白丸)
      const hx = x - (cx - irisRadius * 0.4)
      const hy = y - (cy - irisRadius * 0.4)
      if (Math.sqrt(hx * hx + hy * hy) < size * 0.03) {
        r = 255; g = 255; b = 255
      }

      const idx = (y * size + x) * 4
      data[idx] = r
      data[idx + 1] = g
      data[idx + 2] = b
      data[idx + 3] = 255
    }
  }

  return encodePNG(size, size, data)
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  function chunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii')
    const lenBuf = Buffer.alloc(4)
    lenBuf.writeUInt32BE(data.length, 0)
    const crcBuf = Buffer.alloc(4)
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const idat = deflateSync(raw)

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

mkdirSync(new URL('../public/icons', import.meta.url), { recursive: true })
for (const size of [192, 512]) {
  const png = makeIcon(size)
  writeFileSync(new URL(`../public/icons/icon-${size}.png`, import.meta.url), png)
  console.log(`wrote icon-${size}.png (${png.length} bytes)`)
}
