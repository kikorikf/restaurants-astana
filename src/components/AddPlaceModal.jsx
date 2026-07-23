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

function guessType(rubrics = []) {
  const names = rubrics.map(r => (r.name || '').toLowerCase())
  if (names.some(n => n.includes('кофейн') || n.includes('coffee'))) return 'кофейня'
  if (names.some(n => n.includes('пекарн') || n.includes('bakery'))) return 'кафе-пекарня'
  if (names.some(n => n.includes('ресторан') || n.includes('restaurant'))) return 'ресторан'
  if (names.some(n => n.includes('кафе') || n.includes('cafe'))) return 'кафе'
  if (names.some(n => n.includes('бар') || n.includes('bar'))) return 'бар'
  return ''
}

function emptyForm(restaurant = null) {
  if (!restaurant) return { url: '', name: '', cuisine: '', type: '', avgCheck: '', address: '' }
  return {
    url: restaurant.firmId ? `https://2gis.kz/astana/firm/${restaurant.firmId}` : '',
    name: restaurant.name ?? '',
    cuisine: restaurant.cuisine?.[0] ?? '',
    type: restaurant.type ?? '',
    avgCheck: restaurant.avgCheck ? String(restaurant.avgCheck) : '',
    address: restaurant.address ?? '',
  }
}

export default function AddPlaceModal({
  onClose,
  onAdd,          // admin: add directly
  onSuggest,      // user: submit pending request
  onEdit,         // admin: edit existing
  editRestaurant, // restaurant object being edited (edit mode)
  isAdmin,
  loggedIn,
  onLoginNeeded,
}) {
  const isEditMode = !!editRestaurant
  const [form, setForm] = useState(() => emptyForm(editRestaurant))
  const [fetching, setFetching] = useState(false)
  const [fetchedOk, setFetchedOk] = useState(false)
  const [submitted, setSubmitted] = useState(false) // user request sent
  const [error, setError] = useState('')
  const [gisData, setGisData] = useState(null)
  const prevFirmId = useRef(null)

  const firmId = parseFirmId(form.url)

  useEffect(() => {
    if (!firmId || firmId === prevFirmId.current) return
    prevFirmId.current = firmId
    setFetching(true)
    setFetchedOk(false)
    setGisData(null)

    fetch(`https://catalog.api.2gis.com/3.0/items/byid?id=${firmId}&key=${GISKEY}&fields=items.point,items.address_name,items.rubrics,items.name_ex,items.reviews`)
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

  function set(key, value) { setForm(prev => ({ ...prev, [key]: value })); setError('') }

  function buildPlace() {
    const point = gisData?.point
    const rating = gisData?.reviews?.general_rating ?? (isEditMode ? editRestaurant.rating : null)
    return {
      name: form.name.trim(),
      cuisine: form.cuisine ? [form.cuisine] : [],
      type: form.type,
      rating,
      avgCheck: form.avgCheck ? Number(form.avgCheck) : null,
      address: form.address.trim(),
      lat: point?.lat ?? (isEditMode ? editRestaurant.lat : 51.163),
      lon: point?.lon ?? (isEditMode ? editRestaurant.lon : 71.418),
      firmId: firmId ?? (isEditMode ? editRestaurant.firmId : null),
      source: isEditMode ? editRestaurant.source : 'own',
      status: 'open',
    }
  }

  function validate() {
    if (!isEditMode && !form.url.trim()) { setError('Вставь ссылку на 2ГИС'); return false }
    if (!isEditMode && !firmId) { setError('Не удалось распознать firmId из ссылки'); return false }
    if (!form.name.trim()) { setError('Введи название'); return false }
    if (!form.cuisine) { setError('Выбери кухню'); return false }
    if (!form.type) { setError('Выбери тип'); return false }
    return true
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    const place = buildPlace()

    if (isEditMode) {
      onEdit(editRestaurant.id, place)
      onClose()
    } else if (isAdmin) {
      onAdd({ id: `own-${Date.now()}`, ...place, myVisited: false, myRating: null })
      onClose()
    } else {
      onSuggest(place)
      setSubmitted(true)
    }
  }

  if (!loggedIn) {
    return (
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ maxWidth: 360, textAlign: 'center' }}>
          <div className="modal-header">
            <span className="modal-title">Предложить место</span>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
          <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
            Нужно войти через Telegram чтобы предложить место
          </p>
          <button className="btn-primary" style={{ width: '100%' }} onClick={onLoginNeeded}>
            Войти
          </button>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ maxWidth: 380, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
          <h2 style={{ marginBottom: 8, fontSize: 17 }}>Заявка отправлена!</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: 14 }}>
            Администратор проверит место и добавит его в список
          </p>
          <button className="btn-primary" style={{ width: '100%' }} onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    )
  }

  const title = isEditMode ? 'Редактировать место' : isAdmin ? 'Добавить место' : 'Предложить место'
  const submitLabel = isEditMode ? 'Сохранить' : isAdmin ? 'Добавить' : 'Отправить заявку'

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {!isAdmin && !isEditMode && (
          <p className="suggest-hint">
            💡 Заявка отправится администратору на проверку
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Ссылка 2ГИС {isEditMode ? '' : '*'}</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                placeholder="https://2gis.kz/astana/firm/..."
                value={form.url}
                onChange={e => set('url', e.target.value)}
              />
              {fetching && <span className="fetch-spinner" />}
            </div>
            {fetchedOk && <div className="fetch-ok">✓ Данные загружены из 2ГИС</div>}
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
              <select className="form-input" value={form.cuisine} onChange={e => set('cuisine', e.target.value)}>
                <option value="">Выбрать</option>
                {CUISINE_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Тип *</label>
              <select className="form-input" value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="">Выбрать</option>
                {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
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

          {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn-primary" disabled={fetching}>
              {fetching ? 'Загружаю…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
