import { useState, useEffect } from 'react'
import { supabase, fromRow } from '../lib/supabase'

export default function AdminPanel({ user, onClose, onApproved, onRestaurantDeleted, onRestaurantEdit }) {
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('pending') // 'pending' | 'manage'
  const [restaurants, setRestaurants] = useState([])
  const [actionId, setActionId] = useState(null) // id being processed

  useEffect(() => {
    if (tab === 'pending') loadPending()
    else loadAllRestaurants()
  }, [tab])

  async function loadPending() {
    setLoading(true)
    const { data } = await supabase
      .from('pending_places')
      .select('*')
      .order('created_at', { ascending: false })
    setPending(data ?? [])
    setLoading(false)
  }

  async function loadAllRestaurants() {
    setLoading(true)
    const { data } = await supabase
      .from('restaurants')
      .select('*')
      .order('name')
    setRestaurants((data ?? []).map(r => fromRow(r)))
    setLoading(false)
  }

  async function approve(place) {
    setActionId(place.id)
    const { data, error } = await supabase.from('restaurants').insert([{
      name: place.name,
      address: place.address,
      lat: place.lat,
      lon: place.lon,
      type: place.type,
      cuisine: place.cuisine,
      avg_check: place.avg_check,
      firm_id: place.firm_id,
      rating: place.rating,
      status: 'open',
      source: 'approved',
      user_id: user.id,
    }]).select().single()

    if (!error && data) {
      await supabase.from('pending_places').delete().eq('id', place.id)
      setPending(prev => prev.filter(p => p.id !== place.id))
      onApproved(fromRow(data))
    }
    setActionId(null)
  }

  async function reject(id) {
    setActionId(id)
    await supabase.from('pending_places').delete().eq('id', id)
    setPending(prev => prev.filter(p => p.id !== id))
    setActionId(null)
  }

  async function deleteRestaurant(id) {
    if (!window.confirm('Удалить это место из списка?')) return
    setActionId(id)
    const { error } = await supabase.from('restaurants').delete().eq('id', id)
    if (!error) {
      setRestaurants(prev => prev.filter(r => r.id !== id))
      onRestaurantDeleted(id)
    }
    setActionId(null)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal admin-panel">
        <div className="modal-header">
          <span className="modal-title">Панель администратора</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="admin-tabs">
          <button
            className={`admin-tab ${tab === 'pending' ? 'active' : ''}`}
            onClick={() => setTab('pending')}
          >
            Заявки {pending.length > 0 && <span className="badge">{pending.length}</span>}
          </button>
          <button
            className={`admin-tab ${tab === 'manage' ? 'active' : ''}`}
            onClick={() => setTab('manage')}
          >
            Все места
          </button>
        </div>

        {loading ? (
          <div className="loading" style={{ padding: '40px 0' }}>
            <div className="spinner" /><p>Загружаю…</p>
          </div>
        ) : tab === 'pending' ? (
          pending.length === 0 ? (
            <div className="admin-empty">Нет новых заявок</div>
          ) : (
            <div className="admin-list">
              {pending.map(p => (
                <div key={p.id} className="admin-item">
                  <div className="admin-item-info">
                    <strong>{p.name}</strong>
                    <span className="admin-item-meta">{p.type} · {p.address}</span>
                    {p.cuisine?.length > 0 && (
                      <span className="admin-item-meta">{p.cuisine.join(', ')}</span>
                    )}
                    {p.avg_check && (
                      <span className="admin-item-meta">~{p.avg_check.toLocaleString('ru-RU')} ₸</span>
                    )}
                    {p.firm_id && (
                      <a
                        href={`https://2gis.kz/astana/firm/${p.firm_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="admin-item-link"
                      >
                        2ГИС ↗
                      </a>
                    )}
                    <span className="admin-item-submitter">от {p.submitter_name || 'пользователя'}</span>
                  </div>
                  <div className="admin-item-actions">
                    <button
                      className="btn-approve"
                      onClick={() => approve(p)}
                      disabled={actionId === p.id}
                    >
                      ✓ Добавить
                    </button>
                    <button
                      className="btn-reject"
                      onClick={() => reject(p.id)}
                      disabled={actionId === p.id}
                    >
                      ✕ Отклонить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="admin-list">
            {restaurants.map(r => (
              <div key={r.id} className="admin-item">
                <div className="admin-item-info">
                  <strong>{r.name}</strong>
                  <span className="admin-item-meta">{r.type} · {r.address}</span>
                </div>
                <div className="admin-item-actions">
                  <button
                    className="btn-edit-sm"
                    onClick={() => { onClose(); onRestaurantEdit(r) }}
                  >
                    ✎ Ред.
                  </button>
                  <button
                    className="btn-reject"
                    onClick={() => deleteRestaurant(r.id)}
                    disabled={actionId === r.id}
                  >
                    ✕ Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
