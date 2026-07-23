const CHECK_OPTIONS = [
  { label: 'Любой чек', value: '' },
  { label: 'до 5 000 ₸', value: '5000' },
  { label: 'до 10 000 ₸', value: '10000' },
  { label: 'до 15 000 ₸', value: '15000' },
  { label: 'до 30 000 ₸', value: '30000' },
]

export default function FilterPanel({ filters, onChange, cuisines, types }) {
  const isActive = Object.values(filters).some(v => v !== '')

  function set(key, value) {
    onChange(prev => ({ ...prev, [key]: value }))
  }

  function reset() {
    onChange({ cuisine: '', type: '', maxCheck: '', status: '', visited: '' })
  }

  return (
    <div className="filters">
      <div className="filters-inner">
        <select
          className="filter-select"
          value={filters.cuisine}
          onChange={e => set('cuisine', e.target.value)}
        >
          <option value="">Все кухни</option>
          {cuisines.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          className="filter-select"
          value={filters.type}
          onChange={e => set('type', e.target.value)}
        >
          <option value="">Все типы</option>
          {types.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select
          className="filter-select"
          value={filters.maxCheck}
          onChange={e => set('maxCheck', e.target.value)}
        >
          {CHECK_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          className="filter-select"
          value={filters.status}
          onChange={e => set('status', e.target.value)}
        >
          <option value="">Любой статус</option>
          <option value="open">Открыты</option>
          <option value="temporarily_closed">Временно закрыты</option>
        </select>

        <select
          className="filter-select"
          value={filters.visited}
          onChange={e => set('visited', e.target.value)}
        >
          <option value="">Все места</option>
          <option value="yes">Я была</option>
          <option value="no">Не была</option>
        </select>

        {isActive && (
          <button className="filter-reset" onClick={reset}>
            ✕ Сбросить
          </button>
        )}
      </div>
    </div>
  )
}
