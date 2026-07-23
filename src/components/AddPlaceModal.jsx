import { useState, useEffect, useRef } from 'react'

const GISKEY = '881ebe3c-59ce-4921-87d8-71609a0054f9'

const CUISINE_OPTIONS = [
  'европейская', 'итальянская', 'мексиканская', 'грузинская',
  'бразильская', 'завтраки', 'авторская', 'азиатская',
  'японская', 'казахская', 'другая',
]

const TYPE_OPTIONS = [
  'ресторан', 'кафе', 'кафе-пекарня', 'кофейня', 'бар', 'другое',
]

function parseFirmId(url) {
  const match = url.match(/\/firm\/(\d+)/)
  return match ? match[1] : null
}

// Map 2GIS rubric names → our type options
function guessType(rubrics = []) {
  const names = rubrics.map(r => (r.name || '').toLowerCase())
  if (names.some(n => n.includes('кофейн') || n.includes('coffee'))) return 'кофейня'
  if (names.some(n => n.includes('пекарн') || n.includes('bakery'))) return 'кафе-пекарня'
  if (names.some(n => n.includes('ресторан') || n.includes('restaurant'))) return 'ресторан'
  if (names.some(n => n.includes('кафе') || n.includes('cafe'))) return 'кафе'
  if (names.some(n => n.includes('бар') || n.includes('bar'))) return 'бар'
  return ''
}

const empty = { url: '', name: '', cuisine: '', type: '', avgCheck: '', address: '' }

export default function AddPlaceModal({ onClose, onAdd, loggedIn, onLoginNeeded }) {
  const [form, setForm] = useState(empty)
  const [fetching, setFetching] = useState(false)
  const [fetchedOk, setFetchedOk] = useState(false)
  const [error, setError] = useState('')
  const [gisData, setGisData] = useState(null) // raw 2GIS response
  const prevFirmId = useRef(null)

  const firmId = parseFirmId(form.url)

  // Auto-fetch from 2GIS when firmId appears
  useEffect(() => {
    if (!firmId || firmId === prevFirmId.current) return
    prevFirmId.current = firmId

    if (GISKEY === 'REPLACE_WITH_API_KEY') return // key not set yet

    setFetching(true)
    setFetchedOk(false)
    setGisData(null)

    const url = `https://catalog.api.2gis.com/3.0/items/byid?id=${firmId}&key=${GISKEY}&fields=items.point,items.address_name,items.rubrics,items.name_ex,items.reviews`

    fetch(url)
      .then(r => r.json())
      .then(json => {
        const item = json?.result?.items?.[0]
        if (!item) throw new Error('Место не найдено в 2ГИС')

        setGisData(item)
        setForm(prev => ({
          ...prev,
          name: item.name_ex?.primary || item.name || prev.name,
          address: item.address_name || prev.address,
          type: guessType(item.rubrics) || prev.type,
        }))
        setFetchedOk(true)
      })
      .catch(e => setError(`Ошибка 2ГИС: ${e.message}`))
      .finally(() => setFetching(false))
  }, [firmId])

  function set(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
    setError('')
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.url.trim()) { setError('Вставь ссылку на 2ГИС'); return }
    if (!firmId) { setError('Не удалось распознать firmId из ссылки'); return }
    if (!form.name.trim()) { setError('Введи название'); return }
    if (!form.cuisine) { setError('Выбери кухню'); return }
    if (!form.type) { setError('Выбери тип'); return }

    const point = gisData?.point
    const rating = gisData?.reviews?.general_rating ?? null

    onAdd({
      id: `own-${Date.now()}`,
      name: form.name.trim(),
      cuisine: [form.cuisine],
      type: form.type,
      rating,
      avgCheck: form.avgCheck ? Number(form.avgCheck) : null,
      address: form.address.trim(),
      lat: point?.lat ?? 51.163,
      lon: point?.lon ?? 71.418,
      firmId,
      source: 'own',
      status: 'open',
      myVisited: false,
      myRating: null,
    })
    onClose()
  }

  if (!loggedIn) {
    return (
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ maxWidth: 360, textAlign: 'center' }}>
          <div className="modal-header">
            <span className="modal-title">Добавить место</span>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
          <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
            Чтобы добавлять места, нужно войти в аккаунт
          </p>
          <button className="btn-primary" style={{ width: '100%' }} onClick={onLoginNeeded}>
            Войти / Зарегистрироваться
          </button>
        </div>
      </div>
    )
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
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                placeholder="https://2gis.kz/astana/firm/..."
                value={form.url}
                onChange={e => set('url', e.target.value)}
              />
              {fetching && <span className="fetch-spinner" />}
            </div>
            {fetchedOk && (
              <div className="fetch-ok">✓ Данные загружены из 2ГИС</div>
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
              placeholder="Заполнится автоматически"
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Адрес</label>
            <input
              className="form-input"
              placeholder="Заполнится автоматически"
              value={form.address}
              onChange={e => set('address', e.target.value)}
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
              <label className="form-label">Тип</label>
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

          {error && (
            <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>
              {error}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn-primary" disabled={fetching}>
              {fetching ? 'Загружаю…' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
