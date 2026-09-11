import { openDB } from 'idb'

const DB_NAME = 'yokai-camera-db'
const STORE_NAME = 'catches'

async function getDb() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      store.createIndex('by-yokaiId', 'yokaiId')
      store.createIndex('by-capturedAt', 'capturedAt')
    }
  })
}

// 1体の妖怪を「はじめてゲットした記録」＋撮影写真の履歴、を1レコードとして保存する。
// 同じ妖怪を再度ゲットした場合は写真履歴に追加するだけ(記録自体は1件に集約)。
export async function saveCatch({ yokai, prefName, resultImageDataUrl, lat, lon }) {
  const db = await getDb()
  const existing = await db.get(STORE_NAME, yokai.id)
  const now = new Date().toISOString()

  if (existing) {
    existing.photos.push({ imageDataUrl: resultImageDataUrl, capturedAt: now, prefName, lat, lon })
    existing.catchCount += 1
    await db.put(STORE_NAME, existing)
    return existing
  }

  const record = {
    id: yokai.id,
    yokaiId: yokai.id,
    name: yokai.name,
    prefecture: yokai.prefecture,
    type: yokai.type,
    emoji: yokai.emoji,
    description: yokai.description,
    voice: yokai.voice,
    origin: yokai.origin,
    catchCount: 1,
    capturedAt: now,
    photos: [{ imageDataUrl: resultImageDataUrl, capturedAt: now, prefName, lat, lon }]
  }
  await db.put(STORE_NAME, record)
  return record
}

export async function getAllCatches() {
  const db = await getDb()
  const all = await db.getAll(STORE_NAME)
  return all.sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt))
}
