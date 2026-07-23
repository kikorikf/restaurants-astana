import { useState } from 'react'

function parseFirmId(url) {
  const match = url.match(/\/firm\/(\d+)/)
  return match ? match[1] : null
}

const CUISINE_OPTIONS = [
  'европейская', 'итальянская', 'мексиканская', 'грузинская',
  'бразильская', 'завтраки', 'авторская', 'азиатская',
  'японская', 'казахская', 'другая',
]

const TYPE_OPTIONS = [
  'ресторан', 'кафе', 'кафе-пекарня', 'кофейня', 'бар', 'другое',
]

const empty = {
  url: '',
  name: '',
  cuisine: '',
  type: '',
  avgCheck: '',
  address: '',
}

export default function AddPlaceModal({ onClose, onAdd }) {
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')

  const firmId = parseFirmId(form.url)

  function set(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
    setError('')
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Введи название'); return }
    if (!form.url.trim()) { setError('Вставь ссылку на 2ГИС'); return }
    if (!firmId) { setError('Не удалось распознать firmId из ссылки'); return }
    if (!form.cuisine) { setError('Выбери кухню'); return }
    if (!form.type) { setError('Выбери тип'); return }

    const newPlace = {
      id: `own-${Date.now()}`,
      name: form.name.trim(),
      cuisine: [form.cuisine],
      type: form.type,
      rating: null,
      avgCheck: form.avgCheck ? Number(form.avgCheck) : null,
      address: form.address.trim(),
      lat: 51.163,
      lon: 71.418,
      firmId,
      source: 'own',
      status: 'open',
      myVisited: false,
      myRating: null,
    }

    onAdd(newPlace)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Добавить место</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Ссылка 2ГИС *</label>
            <input
              className="form-input"
              placeholder="https://2gis.kz/astana/firm/..."
              value={form.url}
              onChange={e => set('url', e.target.value)}
            />
            {firmId && (
              <div className="firm-id-preview">firmId: {firmId}</div>
            )}
            {form.url && !firmId && (
              <div className="form-hint" style={{ color: 'var(--danger)' }}>
                Не распознана ссылка — скопируй из адресной строки 2ГИС
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Название *</label>
            <input
              className="form-input"
              placeholder="Например: Noodle House"
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Кухня *</label>
              <select
                className="form-input"
                value={form.cuisine}
                onChange={e => set('cuisine', e.target.value)}
              >
                <option value="">Выбрать</option>
                {CUISINE_OPTIONS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Тип *</label>
              <select
                className="form-input"
                value={form.type}
                onChange={e => set('type', e.target.value)}
              >
                <option value="">Выбрать</option>
                {TYPE_OPTIONS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Средний чек, ₸</label>
              <input
                className="form-input"
                type="number"
                placeholder="5000"
                min="0"
                value={form.avgCheck}
                onChange={e => set('avgCheck', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Адрес</label>
              <input
                className="form-input"
                placeholder="ул. Кенесары, 1"
                value={form.address}
                onChange={e => set('address', e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>
              {error}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn-primary">
              Добавить
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
