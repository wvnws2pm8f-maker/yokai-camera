import { prefNameFromCode } from './prefectures.js'

// ブラウザのGeolocation APIで現在地(緯度経度)を取得する。
export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('この端末は位置情報に対応していません'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000, ...options }
    )
  })
}

// 国土地理院(GSI)の逆ジオコーディングAPI(無料・APIキー不要)で
// 緯度経度から都道府県を判定する。
// https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress
export async function reverseGeocodeToPrefecture(lat, lon) {
  const url = `https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=${lat}&lon=${lon}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`逆ジオコーディングAPIエラー: ${res.status}`)
  }
  const json = await res.json()
  const muniCd = json?.results?.muniCd
  if (!muniCd) {
    throw new Error('この場所の都道府県を特定できませんでした(海の上など)')
  }
  const prefCode = String(muniCd).padStart(5, '0').slice(0, 2)
  const prefName = prefNameFromCode(prefCode)
  if (!prefName) {
    throw new Error('都道府県コードの変換に失敗しました')
  }
  return { prefCode, prefName, townName: json.results.lv01Nm || '' }
}
