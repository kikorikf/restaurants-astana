import { useState, useEffect, useMemo } from 'react'
import { supabase, fromRow, toRow } from './lib/supabase'
import seedData from './data/restaurants.json'
import FilterPanel from './components/FilterPanel'
import RestaurantCard from './components/RestaurantCard'
import MapView from './components/MapView'
import AddPlaceModal from './components/AddPlaceModal'
import AuthModal from './components/AuthModal'
import './App.css'

export default function App() {
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('cards')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [filters, setFilters] = useState({ cuisine: '', type: '', maxCheck: '', status: '', visited: '' })

  // Check session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setAuthChecked(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Load restaurants whenever auth state is known
  useEffect(() => {
    if (!authChecked) return
    loadAll()
  }, [authChecked, user])

  async function loadAll() {
    setLoading(true)

    // Always load base restaurants
    let { data: base } = await supabase
      .from('restaurants')
      .select('*')
      .is('user_id', null)
      .order('rating', { ascending: false })

    // Seed on first run
    if (!base || base.length === 0) {
      const { data: seeded } = await supabase
        .from('restaurants')
        .insert(seedData.map(r => toRow(r, null)))
        .select()
      base = seeded ?? []
    }

    let userDataMap = {}
    let userRestaurants = []

    if (user) {
      // Load per-user visited/rating for base restaurants
      const { data: ud } = await supabase
        .from('user_data')
        .select('*')
        .eq('user_id', user.id)
      if (ud) ud.forEach(d => { userDataMap[d.restaurant_id] = d })

      // Load user-added restaurants
      const { data: ownPlaces } = await supabase
        .from('restaurants')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      userRestaurants = ownPlaces ?? []
    }

    const merged = [
      ...(base ?? []).map(r => fromRow(r, userDataMap[r.id] ?? {})),
      ...userRestaurants.map(r => fromRow(r)),
    ]

    setRestaurants(merged)
    setLoading(false)
  }

  async function updateRestaurant(id, patch) {
    if (!user) { setShowAuthModal(true); return }

    setRestaurants(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))

    const isOwn = restaurants.find(r => r.id === id)?.isOwn

    if (isOwn) {
      // User-added restaurant — update the row directly
      const dbPatch = {}
      if ('myVisited' in patch) dbPatch.my_visited = patch.myVisited
      if ('myRating' in patch) dbPatch.my_rating = patch.myRating
      await supabase.from('restaurants').update(dbPatch).eq('id', id).eq('user_id', user.id)
    } else {
      // Base restaurant — upsert into user_data
      await supabase.from('user_data').upsert({
        user_id: user.id,
        restaurant_id: id,
        my_visited: patch.myVisited ?? restaurants.find(r => r.id === id)?.myVisited ?? false,
        my_rating: patch.myRating !== undefined ? patch.myRating : restaurants.find(r => r.id === id)?.myRating ?? null,
      }, { onConflict: 'user_id,restaurant_id' })
    }
  }

  async function addRestaurant(newPlace) {
    if (!user) { setShowAuthModal(true); return }
    const { data, error } = await supabase
      .from('restaurants')
      .insert([toRow(newPlace, user.id)])
      .select()
      .single()
    if (!error && data) {
      setRestaurants(prev => [...prev, fromRow(data)])
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setRestaurants([])
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

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="header-title">
            <span className="header-emoji">🍽</span>
            <h1>Рестораны Астаны</h1>
            {!loading && (
              <span className="header-count">{filtered.length} из {restaurants.length}</span>
            )}
          </div>
          <div className="header-actions">
            <div className="view-toggle">
              <button className={`view-btn ${view === 'cards' ? 'active' : ''}`} onClick={() => setView('cards')}>
                ⊞ Карточки
              </button>
              <button className={`view-btn ${view === 'map' ? 'active' : ''}`} onClick={() => setView('map')}>
                🗺 Карта
              </button>
            </div>

            {user ? (
              <>
                <button className="btn-add" onClick={() => setShowAddModal(true)}>
                  + Добавить место
                </button>
                <div className="user-menu">
                  <span className="user-email">{user.email.split('@')[0]}</span>
                  <button className="btn-logout" onClick={handleLogout} title="Выйти">↩</button>
                </div>
              </>
            ) : (
              <>
                <button className="btn-add" onClick={() => setShowAddModal(true)}>
                  + Добавить место
                </button>
                <button className="btn-login" onClick={() => setShowAuthModal(true)}>
                  Войти
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <FilterPanel filters={filters} onChange={setFilters} cuisines={allCuisines} types={allTypes} />

      <main className="main">
        {loading ? (
          <div className="loading">
            <div className="spinner" />
            <p>Загружаю рестораны…</p>
          </div>
        ) : view === 'cards' ? (
          filtered.length > 0 ? (
            <div className="grid">
              {filtered.map(r => (
                <RestaurantCard
                  key={r.id}
                  restaurant={r}
                  onUpdate={patch => updateRestaurant(r.id, patch)}
                  loggedIn={!!user}
                  onLoginNeeded={() => setShowAuthModal(true)}
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

      {showAddModal && (
        <AddPlaceModal
          onClose={() => setShowAddModal(false)}
          onAdd={addRestaurant}
          loggedIn={!!user}
          onLoginNeeded={() => { setShowAddModal(false); setShowAuthModal(true) }}
        />
      )}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onAuth={u => setUser(u)}
        />
      )}
    </div>
  )
}
