function Stars({ rating, onChange, disabled }) {
  return (
    <div className="stars">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          className={`star-btn ${rating !== null && n <= rating ? 'lit' : ''}`}
          onClick={() => !disabled && onChange(n === rating ? null : n)}
          title={`${n} из 5`}
          disabled={disabled}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export default function RestaurantCard({ restaurant: r, onUpdate, loggedIn, onLoginNeeded }) {
  const gisUrl = `https://2gis.kz/astana/firm/${r.firmId}`

  function toggleVisited() {
    if (!loggedIn) { onLoginNeeded(); return }
    const visited = !r.myVisited
    onUpdate({ myVisited: visited, myRating: visited ? r.myRating : null })
  }

  return (
    <div className={`card ${r.status === 'temporarily_closed' ? 'closed' : ''}`}>
      <div className="card-header">
        <a className="card-name" href={gisUrl} target="_blank" rel="noreferrer">
          {r.name}
        </a>
        <span className="card-rating">⭐ {r.rating}</span>
      </div>

      <div className="card-tags">
        <span className="tag tag-type">{r.type}</span>
        {r.cuisine.map(c => (
          <span key={c} className="tag">{c}</span>
        ))}
      </div>

      <div className="card-meta">
        <div className="card-meta-row">
          <span className="meta-icon">📍</span>
          <span>{r.address}</span>
        </div>
        {r.avgCheck !== null && (
          <div className="card-meta-row">
            <span className="meta-icon">💳</span>
            <span>~{r.avgCheck.toLocaleString('ru-RU')} ₸</span>
          </div>
        )}
        <div className="card-meta-row">
          <span
            className={`status-badge ${r.status === 'open' ? 'status-open' : 'status-closed'}`}
          >
            {r.status === 'open' ? '● Открыто' : '◌ Временно закрыто'}
          </span>
        </div>
      </div>

      <div className="card-source">
        {r.source === 'rostislav' ? (
          <span className="source-rostislav">📋 Подборка Ростислава</span>
        ) : (
          <span className="source-own">✦ Моя находка</span>
        )}
      </div>

      <div className="card-actions">
        <label className={`visited-toggle ${r.myVisited ? 'active' : ''}`}>
          <input
            type="checkbox"
            checked={r.myVisited}
            onChange={toggleVisited}
          />
          {r.myVisited ? 'Был/а' : 'Не был/а'}
        </label>

        <Stars
          rating={r.myRating}
          onChange={val => onUpdate({ myRating: val })}
          disabled={!r.myVisited}
        />
      </div>
    </div>
  )
}
