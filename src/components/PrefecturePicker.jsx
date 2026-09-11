import { useState } from 'react'
import { ALL_PREFECTURES } from '../utils/prefectures.js'

export default function PrefecturePicker({ message, onConfirm, onCancel }) {
  const [code, setCode] = useState('13')

  return (
    <div className="pref-picker">
      <p className="notice">{message}</p>
      <select value={code} onChange={(e) => setCode(e.target.value)}>
        {ALL_PREFECTURES.map((p) => (
          <option key={p.code} value={p.code}>{p.name}</option>
        ))}
      </select>
      <div className="result-actions">
        <button className="primary" onClick={() => onConfirm(code)}>この都道府県でさがす</button>
        <button className="link" onClick={onCancel}>やめる</button>
      </div>
    </div>
  )
}
