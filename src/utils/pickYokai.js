import yokaiMaster from '../data/yokaiMaster.json'

// 指定した都道府県コードの妖怪(伝承)＋全国共通(オリジナル)の妖怪の中から、
// ランダムに1体選ぶ。同じ場所でも毎回違う妖怪に出会えるようにする。
export function pickRandomYokai(prefCode) {
  const candidates = yokaiMaster.filter((y) => y.prefCode === prefCode || y.prefCode === '00')
  if (candidates.length === 0) {
    return null
  }
  const index = Math.floor(Math.random() * candidates.length)
  return candidates[index]
}

export function getYokaiById(id) {
  return yokaiMaster.find((y) => y.id === id) || null
}

export function listPrefecturesWithYokai() {
  const set = new Map()
  for (const y of yokaiMaster) {
    if (y.prefCode !== '00') set.set(y.prefCode, y.prefecture)
  }
  return [...set.entries()].map(([code, name]) => ({ code, name }))
}
