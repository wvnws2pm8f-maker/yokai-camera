// 妖怪データベース(src/data/yokaiMaster.json)の各妖怪について、
// Cloudflare Worker経由でFLUX.1 schnell(軽量なテキスト→画像モデル)を呼び出し、
// 立ち絵イラストを1回だけ生成して public/yokai-art/<id>.jpg に保存する。
//
// 生成した画像は、撮影のたびにAIを呼ぶのではなく、アプリが静的ファイルとして
// 読み込み、クライアント側のcanvasで写真に重ねる用途で使う(背景は単色なので
// 実行時に色base差分でくり抜いて透過させる)。
//
// 使い方:
//   node scripts/generate-yokai-art.mjs            # 未生成のものだけ作る
//   node scripts/generate-yokai-art.mjs --force     # 既存ファイルも作り直す
//   node scripts/generate-yokai-art.mjs --only=iwate-kappa,tokyo-tengu-takao

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')
const yokaiMasterPath = join(repoRoot, 'src', 'data', 'yokaiMaster.json')
const outDir = join(repoRoot, 'public', 'yokai-art')

const WORKER_URL = process.env.WORKER_URL || 'https://yokai-camera-worker.eeggxgjsd85.workers.dev/'
const APP_SECRET = process.env.WORKER_APP_SECRET || 'gegegenoyokai'

const args = process.argv.slice(2)
const force = args.includes('--force')
const onlyArg = args.find((a) => a.startsWith('--only='))
const onlyIds = onlyArg ? onlyArg.slice('--only='.length).split(',') : null

mkdirSync(outDir, { recursive: true })

const yokaiList = JSON.parse(readFileSync(yokaiMasterPath, 'utf-8'))

function buildPrompt(yokai) {
  return (
    `Cute, friendly Japanese yokai character illustration for a children's app. ` +
    `${yokai.appearance} ` +
    `Full-body character centered on a plain solid magenta background (#FF00FF), ` +
    `simple flat cartoon illustration style, vivid colors, clean outlines, no shadow, ` +
    `no scenery, not scary, appealing to young children.`
  )
}

async function generateOne(yokai) {
  const prompt = buildPrompt(yokai)
  const res = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-Secret': APP_SECRET },
    body: JSON.stringify({ action: 'illustrate', prompt })
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`)
  }
  const json = await res.json()
  if (!json.imageDataUrl) {
    throw new Error(`imageDataUrlが返ってきませんでした: ${JSON.stringify(json).slice(0, 300)}`)
  }
  const m = /^data:image\/(\w+);base64,(.+)$/.exec(json.imageDataUrl)
  if (!m) throw new Error('imageDataUrlの形式が不正です')
  const [, ext, base64] = m
  const outPath = join(outDir, `${yokai.id}.${ext === 'jpeg' ? 'jpg' : ext}`)
  writeFileSync(outPath, Buffer.from(base64, 'base64'))
  return outPath
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const targets = yokaiList.filter((y) => !onlyIds || onlyIds.includes(y.id))

console.log(`対象: ${targets.length}件`)

const results = { ok: [], skipped: [], failed: [] }

for (const yokai of targets) {
  const existingJpg = join(outDir, `${yokai.id}.jpg`)
  if (!force && existsSync(existingJpg)) {
    results.skipped.push(yokai.id)
    console.log(`skip (既存): ${yokai.id}`)
    continue
  }

  let lastErr
  let done = false
  for (let attempt = 1; attempt <= 3 && !done; attempt++) {
    try {
      const outPath = await generateOne(yokai)
      console.log(`OK: ${yokai.id} -> ${outPath}`)
      results.ok.push(yokai.id)
      done = true
    } catch (err) {
      lastErr = err
      console.error(`  試行${attempt}/3 失敗: ${yokai.id}: ${err.message}`)
      if (attempt < 3) await sleep(2000)
    }
  }
  if (!done) {
    results.failed.push({ id: yokai.id, error: lastErr?.message })
  }

  // Workers AIの無料枠・混雑対策で少し間隔を空ける
  await sleep(800)
}

console.log('\n=== 結果 ===')
console.log(`成功: ${results.ok.length}件`)
console.log(`スキップ(既存): ${results.skipped.length}件`)
console.log(`失敗: ${results.failed.length}件`)
if (results.failed.length > 0) {
  console.log('失敗一覧:', results.failed)
  process.exitCode = 1
}
