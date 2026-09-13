import { typeClassName } from '../utils/yokaiType.js'

export default function YokaiResultCard({ yokai, prefName, resultImageDataUrl, isMock, onSave, onRetry, onGoHome, saved }) {
  return (
    <div className="result-card">
      <img className="result-photo" src={resultImageDataUrl} alt={`${prefName}で撮れた${yokai.name}`} />
      {isMock && (
        <p className="mock-notice">
          ※ これは仮あわせ画像です。AI合成用のCloudflare Workerを設定すると、本物の妖怪が写真に写りこむようになります。
        </p>
      )}
      <div className="result-info">
        <span className="badge">{prefName} で出現</span>
        <span className={`badge type-${typeClassName(yokai.type)}`}>{yokai.type}</span>
        <h2>{yokai.emoji} {yokai.name}</h2>
        <p className="description">{yokai.description}</p>
        {yokai.voice && <p className="voice">「{yokai.voice}」</p>}
        {yokai.origin && <p className="origin">由来: {yokai.origin}</p>}
      </div>
      <div className="result-actions">
        {!saved ? (
          <button className="primary" onClick={onSave}>図鑑に追加する</button>
        ) : (
          <p className="saved-notice">✅ 図鑑に追加したよ！</p>
        )}
        <button className="secondary" onClick={onRetry}>もう一度さがす</button>
        <button className="link" onClick={onGoHome}>ホームに戻る</button>
      </div>
    </div>
  )
}
