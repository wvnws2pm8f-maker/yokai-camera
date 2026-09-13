import { useState } from 'react'

export default function ZukanList({ catches, onGoHome }) {
  const [openId, setOpenId] = useState(null)

  return (
    <div className="zukan">
      <h2>妖怪図鑑</h2>
      <p className="zukan-count">これまでに {catches.length} 種類の妖怪をゲットしたよ</p>
      {catches.length === 0 && <p className="empty">まだ妖怪をゲットしていません。カメラでさがしにいこう！</p>}
      <div className="zukan-grid">
        {catches.map((c) => {
          const isOpen = openId === c.id
          return (
            <div key={c.id} className={`zukan-item ${isOpen ? 'open' : ''}`} onClick={() => setOpenId(isOpen ? null : c.id)}>
              <div className="zukan-item-head">
                <img
                  className="thumb"
                  src={c.photos[c.photos.length - 1].imageDataUrl}
                  alt={`${c.name}の写真`}
                />
                <div>
                  <div className="name">{c.emoji} {c.name}</div>
                  <div className="meta">{c.prefecture} ・ {c.catchCount}回ゲット</div>
                </div>
              </div>
              {isOpen && (
                <div className="zukan-item-body">
                  <p>{c.description}</p>
                  {c.voice && <p className="voice">「{c.voice}」</p>}
                  <div className="photo-strip">
                    {c.photos.map((p, i) => (
                      <img key={i} src={p.imageDataUrl} alt={`${c.name}の写真${i + 1}`} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <button className="link" onClick={onGoHome}>ホームに戻る</button>
    </div>
  )
}
