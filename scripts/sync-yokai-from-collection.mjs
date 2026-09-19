// 妖怪データベース(MulmoClaudeの「コレクション」機能、/collections/yokai)を
// 「原本」として、アプリが実際に読み込む src/data/yokaiMaster.json を再生成する。
//
// コレクションの実データは、このアプリのGitHubリポジトリの外側、
// MulmoClaudeワークスペースの data/yokai/items/*.json に置かれている
// (1レコード=1ファイル)。妖怪の追加・編集はコレクション側(manageCollection /
// /collections/yokai の画面)で行い、このスクリプトで反映すること。
//
// 使い方:
//   node scripts/sync-yokai-from-collection.mjs
//
// ワークスペースのルートは環境変数 MULMOCLAUDE_WORKSPACE で上書きできる
// (未設定時は、このリポジトリが github/yokai-camera に置かれている前提で
// 3つ上の階層をワークスペースルートとみなす)。

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..') // github/yokai-camera/
const workspaceRoot = process.env.MULMOCLAUDE_WORKSPACE || join(repoRoot, '..', '..')
const itemsDir = join(workspaceRoot, 'data', 'yokai', 'items')
const outPath = join(repoRoot, 'src', 'data', 'yokaiMaster.json')

// JIS X 0401 都道府県コード。src/utils/prefectures.js と同じ対応表
// (アプリ側は名前→コード変換をここでは行わないので、生成時に持たせる)
const PREF_NAME_TO_CODE = {
  '北海道': '01', '青森県': '02', '岩手県': '03', '宮城県': '04',
  '秋田県': '05', '山形県': '06', '福島県': '07', '茨城県': '08',
  '栃木県': '09', '群馬県': '10', '埼玉県': '11', '千葉県': '12',
  '東京都': '13', '神奈川県': '14', '新潟県': '15', '富山県': '16',
  '石川県': '17', '福井県': '18', '山梨県': '19', '長野県': '20',
  '岐阜県': '21', '静岡県': '22', '愛知県': '23', '三重県': '24',
  '滋賀県': '25', '京都府': '26', '大阪府': '27', '兵庫県': '28',
  '奈良県': '29', '和歌山県': '30', '鳥取県': '31', '島根県': '32',
  '岡山県': '33', '広島県': '34', '山口県': '35', '徳島県': '36',
  '香川県': '37', '愛媛県': '38', '高知県': '39', '福岡県': '40',
  '佐賀県': '41', '長崎県': '42', '熊本県': '43', '大分県': '44',
  '宮崎県': '45', '鹿児島県': '46', '沖縄県': '47',
  '全国': '00'
}

const files = readdirSync(itemsDir).filter((f) => f.endsWith('.json'))
if (files.length === 0) {
  console.error(`妖怪データが見つかりません: ${itemsDir}`)
  process.exit(1)
}

const records = files.map((f) => {
  const raw = JSON.parse(readFileSync(join(itemsDir, f), 'utf-8'))
  const prefCode = PREF_NAME_TO_CODE[raw.prefecture]
  if (!prefCode) {
    throw new Error(`${f}: 未知の都道府県名です: ${raw.prefecture}`)
  }
  const out = {
    id: raw.id,
    name: raw.name,
    prefecture: raw.prefecture,
    prefCode,
    type: raw.type,
    emoji: raw.emoji || '',
    appearance: raw.appearance,
    description: raw.description
  }
  if (raw.voice) out.voice = raw.voice
  if (raw.origin) out.origin = raw.origin
  if (raw.illustrationPrompt) out.illustrationPrompt = raw.illustrationPrompt
  return out
})

// 表示順は安定させるため 都道府県コード→id の順でソート(全国="00"が先頭)
records.sort((a, b) => (a.prefCode + a.id).localeCompare(b.prefCode + b.id))

writeFileSync(outPath, JSON.stringify(records, null, 2) + '\n')
console.log(`書き出しました: ${outPath} (${records.length}件)`)
