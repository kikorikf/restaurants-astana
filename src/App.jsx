import { useState, useEffect, useMemo } from 'react'
import { supabase, fromRow, toRow } from './lib/supabase'
import { useTelegramAuth, isTelegramEnv } from './tma/useTelegramAuth'
import seedData from './data/restaurants.json'
import FilterPanel from './components/FilterPanel'
import RestaurantCard from './components/RestaurantCard'
import MapView from './components/MapView'
import AddPlaceModal from './components/AddPlaceModal'
import AdminPanel from './components/AdminPanel'
import AuthModal from './components/AuthModal'
import './App.css'

const IS_TMA = isTelegramEnv()

// ── TMA entry point ──────────────────────────────────
function TmaRoot() {
  const { user, tgUser, loading, error } = useTelegramAuth()
  if (loading) return <Splash />
  if (error) return <Splash error={error} />
  return <AppContent user={user} tgUser={tgUser} />
}

// ── Web entry point ──────────────────────────────────
function WebRoot() {
  const [user, setUser] = useState(undefined)
  const [showAuth, setShowAuth] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null))
    return () => subscription.unsubscribe()
  }, [])

  if (user === undefined) return <Splash />

  return (
    <>
      <AppContent
        user={user}
        onLoginNeeded={() => setShowAuth(true)}
        onLogout={async () => { await supabase.auth.signOut(); setUser(null) }}
      />
      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onAuth={u => { setUser(u); setShowAuth(false) }}
        />
      )}
    </>
  )
}

function Splash({ error } = {}) {
  return (
    <div className="loading" style={{ height: '100vh' }}>
      <div className="spinner" />
      <p style={error ? { color: 'var(--danger)' } : {}}>
        {error ? `Ошибка: ${error}` : 'Загружаю…'}
      </p>
    </div>
  )
}

export default function App() {
  return IS_TMA ? <TmaRoot /> : <WebRoot />
}

// ── Main content (shared) ────────────────────────────
function AppContent({ user, tgUser, onLoginNeeded, onLogout }) {
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [view, setView] = useState('cards')
  const [showAdd, setShowAdd] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [editingRestaurant, setEditingRestaurant] = useState(null)
  const [filters, setFilters] = useState({ cuisine: '', type: '', maxCheck: '', status: '', visited: '' })

  useEffect(() => { loadAll() }, [user])
  useEffect(() => { if (isAdmin) loadPendingCount() }, [isAdmin])

  async function loadAll() {
    setLoading(true)

    // Check admin status
    let adminUser = false
    if (user) {
      const { data: adminRow } = await supabase.from('admins').select('user_id').eq('user_id', user.id).maybeSingle()
      adminUser = !!adminRow
      setIsAdmin(adminUser)
    } else {
      setIsAdmin(false)
    }

    const { data: base } = await supabase
      .from('restaurants').select('*').order('rating', { ascending: false })

    // Seed if empty (initial setup only)
    let rows = base ?? []
    if (rows.length === 0 && adminUser) {
      const { data: seeded } = await supabase
        .from('restaurants').insert(seedData.map(r => toRow(r, user.id))).select()
      rows = seeded ?? []
    }

    let userDataMap = {}
    if (user) {
      const { data: ud } = await supabase.from('user_data').select('*').eq('user_id', user.id)
      if (ud) ud.forEach(d => { userDataMap[d.restaurant_id] = d })
    }

    setRestaurants(rows.map(r => fromRow(r, userDataMap[r.id] ?? {})))
    setLoading(false)
  }

  async function loadPendingCount() {
    const { count } = await supabase
      .from('pending_places').select('id', { count: 'exact', head: true })
    setPendingCount(count ?? 0)
  }

  async function updateRestaurant(id, patch) {
    if (!user) { onLoginNeeded?.(); return }
    setRestaurants(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
    const cur = restaurants.find(r => r.id === id)

    if (cur?.isOwn && isAdmin) {
      const dbPatch = {}
      if ('myVisited' in patch) dbPatch.my_visited = patch.myVisited
      if ('myRating' in patch) dbPatch.my_rating = patch.myRating
      await supabase.from('restaurants').update(dbPatch).eq('id', id)
    } else {
      await supabase.from('user_data').upsert({
        user_id: user.id, restaurant_id: id,
        my_visited: patch.myVisited ?? cur?.myVisited ?? false,
        my_rating: patch.myRating !== undefined ? patch.myRating : cur?.myRating ?? null,
      }, { onConflict: 'user_id,restaurant_id' })
    }
  }

  async function addRestaurant(newPlace) {
    if (!user || !isAdmin) return
    const { data, error } = await supabase
      .from('restaurants').insert([toRow(newPlace, user.id)]).select().single()
    if (!error && data) setRestaurants(prev => [...prev, fromRow(data)])
  }

  async function submitRequest(place) {
    if (!user) { onLoginNeeded?.(); return }
    const submitterName = tgUser?.first_name ?? user?.email?.split('@')[0] ?? 'Пользователь'
    await supabase.from('pending_places').insert([{
      submitted_by: user.id,
      submitter_name: submitterName,
      name: place.name,
      address: place.address,
      lat: place.lat,
      lon: place.lon,
      type: place.type,
      cuisine: place.cuisine,
      avg_check: place.avgCheck,
      firm_id: place.firmId,
      rating: place.rating,
    }])
  }

  async function editRestaurantData(id, updatedPlace) {
    if (!isAdmin) return
    const dbPatch = {
      name: updatedPlace.name,
      address: updatedPlace.address,
      type: updatedPlace.type,
      cuisine: updatedPlace.cuisine,
      avg_check: updatedPlace.avgCheck,
      lat: updatedPlace.lat,
      lon: updatedPlace.lon,
      firm_id: updatedPlace.firmId,
    }
    const { error } = await supabase.from('restaurants').update(dbPatch).eq('id', id)
    if (!error) {
      setRestaurants(prev => prev.map(r => r.id === id ? { ...r, ...updatedPlace } : r))
    }
  }

  async function deleteRestaurant(id) {
    if (!isAdmin) return
    if (!window.confirm('Удалить это место?')) return
    const { error } = await supabase.from('restaurants').delete().eq('id', id)
    if (!error) setRestaurants(prev => prev.filter(r => r.id !== id))
  }

  function handleApproved(newRestaurant) {
    setRestaurants(prev => [...prev, newRestaurant])
    setPendingCount(c => Math.max(0, c - 1))
  }

  function handleAdminDeleted(id) {
    setRestaurants(prev => prev.filter(r => r.id !== id))
  }

  const allCuisines = useMemo(() => {
    const set = new Set()
    restaurants.forEach(r => r.cuisine.forEach(c => set.add(c)))
    return [...set].sort()
  }, [restaurants])

  const allTypes = useMemo(() => {
    const set = new Set(restaurants.map(r => r.type).filter(Boolean))
    return [...set].sort()
  }, [restaurants])

  const filtered = useMemo(() => restaurants.filter(r => {
    if (filters.cuisine && !r.cuisine.includes(filters.cuisine)) return false
    if (filters.type && r.type !== filters.type) return false
    if (filters.maxCheck) {
      if (r.avgCheck === null) return false
      if (r.avgCheck > Number(filters.maxCheck)) return false
    }
    if (filters.status && r.status !== filters.status) return false
    if (filters.visited === 'yes' && !r.myVisited) return false
    if (filters.visited === 'no' && r.myVisited) return false
    return true
  }), [restaurants, filters])

  const displayName = tgUser?.first_name ?? user?.email?.split('@')[0] ?? null

  return (
    <div className={`app${IS_TMA ? ' tma' : ''}`}>
      <header className="header">
        <div className="header-inner">
          <div className="header-title">
            <span className="header-emoji">🍽</span>
            <h1>Рестораны Астаны</h1>
            {!loading && <span className="header-count">{filtered.length} из {restaurants.length}</span>}
          </div>
          <div className="header-actions">
            <div className="view-toggle">
              <button className={`view-btn ${view === 'cards' ? 'active' : ''}`} onClick={() => setView('cards')}>⊞ Карточки</button>
              <button className={`view-btn ${view === 'map' ? 'active' : ''}`} onClick={() => setView('map')}>🗺 Карта</button>
            </div>

            {isAdmin && (
              <button className="btn-admin" onClick={() => setShowAdminPanel(true)}>
                ⚙ Админ
                {pendingCount > 0 && <span className="btn-badge">{pendingCount}</span>}
              </button>
            )}

            <button className="btn-add" onClick={() => setShowAdd(true)}>
              {isAdmin ? '+ Добавить' : '+ Предложить'}
            </button>

            {user ? (
              <div className="user-menu">
                <span className="user-email">{displayName}</span>
                {!IS_TMA && (
                  <button className="btn-logout" onClick={onLogout} title="Выйти">↩</button>
                )}
              </div>
            ) : !IS_TMA ? (
              <button className="btn-login" onClick={onLoginNeeded}>Войти</button>
            ) : null}
          </div>
        </div>
      </header>

      <FilterPanel filters={filters} onChange={setFilters} cuisines={allCuisines} types={allTypes} />

      <main className="main">
        {loading ? (
          <div className="loading"><div className="spinner" /><p>Загружаю рестораны…</p></div>
        ) : view === 'cards' ? (
          filtered.length > 0 ? (
            <div className="grid">
              {filtered.map(r => (
                <RestaurantCard
                  key={r.id}
                  restaurant={r}
                  onUpdate={patch => updateRestaurant(r.id, patch)}
                  loggedIn={!!user}
                  onLoginNeeded={onLoginNeeded}
                  isAdmin={isAdmin}
                  onEdit={setEditingRestaurant}
                  onDelete={deleteRestaurant}
                />
              ))}
            </div>
          ) : (
            <div className="empty"><p>Ничего не найдено — попробуй изменить фильтры</p></div>
          )
        ) : (
          <MapView restaurants={filtered} />
        )}
      </main>

      {(showAdd || editingRestaurant) && (
        <AddPlaceModal
          onClose={() => { setShowAdd(false); setEditingRestaurant(null) }}
          onAdd={addRestaurant}
          onSuggest={submitRequest}
          onEdit={editRestaurantData}
          editRestaurant={editingRestaurant}
          isAdmin={isAdmin}
          loggedIn={!!user}
          onLoginNeeded={() => { setShowAdd(false); onLoginNeeded?.() }}
        />
      )}

      {showAdminPanel && (
        <AdminPanel
          user={user}
          onClose={() => { setShowAdminPanel(false); loadPendingCount() }}
          onApproved={handleApproved}
          onRestaurantDeleted={handleAdminDeleted}
          onRestaurantEdit={r => { setShowAdminPanel(false); setEditingRestaurant(r) }}
        />
      )}
    </div>
  )
}
