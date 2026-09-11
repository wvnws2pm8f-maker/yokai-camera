import { useEffect, useRef, useState } from 'react'
import { getCurrentPosition, reverseGeocodeToPrefecture } from './utils/reverseGeocode.js'
import { pickRandomYokai } from './utils/pickYokai.js'
import { compositeYokaiOntoPhoto } from './utils/composite.js'
import { saveCatch, getAllCatches } from './utils/db.js'
import { prefNameFromCode } from './utils/prefectures.js'
import YokaiResultCard from './components/YokaiResultCard.jsx'
import ZukanList from './components/ZukanList.jsx'
import PrefecturePicker from './components/PrefecturePicker.jsx'

// screen: home | locating | compositing | result | manualPref | zukan
export default function App() {
  const [screen, setScreen] = useState('home')
  const [statusText, setStatusText] = useState('')
  const [errorText, setErrorText] = useState('')
  const [photoDataUrl, setPhotoDataUrl] = useState(null)
  const [prefInfo, setPrefInfo] = useState(null) // { prefCode, prefName }
  const [yokai, setYokai] = useState(null)
  const [resultImageDataUrl, setResultImageDataUrl] = useState(null)
  const [isMock, setIsMock] = useState(false)
  const [saved, setSaved] = useState(false)
  const [catches, setCatches] = useState([])
  const fileInputRef = useRef(null)

  function handleTakePhotoClick() {
    setErrorText('')
    fileInputRef.current?.click()
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // 同じ写真でも次回また選べるようにする
    if (!file) return

    const dataUrl = await readFileAsDataUrl(file)
    setPhotoDataUrl(dataUrl)
    setSaved(false)
    await locateAndProceed(dataUrl)
  }

  async function locateAndProceed(dataUrl) {
    setScreen('locating')
    setStatusText('今どこにいるか調べています…')
    try {
      const { lat, lon } = await getCurrentPosition()
      const geo = await reverseGeocodeToPrefecture(lat, lon)
      await huntYokai(dataUrl, geo.prefCode, geo.prefName, lat, lon)
    } catch (err) {
      console.error(err)
      setErrorText('現在地から都道府県を判定できませんでした。手動で選んでね。')
      setScreen('manualPref')
    }
  }

  async function huntYokai(dataUrl, prefCode, prefName, lat, lon) {
    setScreen('compositing')
    setStatusText(`${prefName}の妖怪をさがしています…`)
    const picked = pickRandomYokai(prefCode)
    if (!picked) {
      setErrorText('この都道府県の妖怪データがまだありません。')
      setScreen('home')
      return
    }
    setYokai(picked)
    setPrefInfo({ prefCode, prefName, lat, lon })

    const { imageDataUrl, isMock: mock } = await compositeYokaiOntoPhoto(dataUrl, picked)
    setResultImageDataUrl(imageDataUrl)
    setIsMock(mock)
    setScreen('result')
  }

  async function handleManualPrefConfirm(prefCode) {
    const prefName = prefNameFromCode(prefCode)
    await huntYokai(photoDataUrl, prefCode, prefName, null, null)
  }

  async function handleSave() {
    if (!yokai || !resultImageDataUrl || !prefInfo) return
    await saveCatch({
      yokai,
      prefName: prefInfo.prefName,
      resultImageDataUrl,
      lat: prefInfo.lat,
      lon: prefInfo.lon
    })
    setSaved(true)
  }

  async function openZukan() {
    const all = await getAllCatches()
    setCatches(all)
    setScreen('zukan')
  }

  function goHome() {
    setScreen('home')
    setErrorText('')
  }

  return (
    <div className="app">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />

      {screen === 'home' && (
        <div className="home">
          <h1>👻 妖怪カメラ</h1>
          <p className="lead">写真を撮ると、その土地にちなんだ妖怪が写りこむよ</p>
          {errorText && <p className="error">{errorText}</p>}
          <button className="primary big" onClick={handleTakePhotoClick}>📷 妖怪をさがす</button>
          <button className="secondary" onClick={openZukan}>📖 図鑑を見る</button>
        </div>
      )}

      {(screen === 'locating' || screen === 'compositing') && (
        <div className="loading">
          <div className="spinner" />
          <p>{statusText}</p>
        </div>
      )}

      {screen === 'manualPref' && (
        <PrefecturePicker
          message={errorText || '都道府県を選んでね'}
          onConfirm={handleManualPrefConfirm}
          onCancel={goHome}
        />
      )}

      {screen === 'result' && yokai && resultImageDataUrl && (
        <YokaiResultCard
          yokai={yokai}
          prefName={prefInfo?.prefName}
          resultImageDataUrl={resultImageDataUrl}
          isMock={isMock}
          saved={saved}
          onSave={handleSave}
          onRetry={handleTakePhotoClick}
          onGoHome={goHome}
        />
      )}

      {screen === 'zukan' && <ZukanList catches={catches} onGoHome={goHome} />}
    </div>
  )
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
