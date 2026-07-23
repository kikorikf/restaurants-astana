import { useState, useEffect, useMemo } from 'react'
import { supabase, fromRow, toRow } from './lib/supabase'
import seedData from './data/restaurants.json'
import FilterPanel from './components/FilterPanel'
import RestaurantCard from './components/RestaurantCard'
import MapView from './components/MapView'
import AddPlaceModal from './components/AddPlaceModal'
import './App.css'

export default function App() {
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('cards')
  const [showAddModal, setShowAddModal] = useState(false)
  const [filters, setFilters] = useState({
    cuisine: '',
    type: '',
    maxCheck: '',
    status: '',
    visited: '',
  })

  // Load from Supabase on mount; seed if empty
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .order('rating', { ascending: false })

      if (error) {
        console.error('Supabase error:', error)
        setLoading(false)
        return
      }

      if (data.length === 0) {
        // First run — seed initial data
        const rows = seedData.map(toRow)
        const { data: inserted, error: insertError } = await supabase
          .from('restaurants')
          .insert(rows)
          .select()

        if (!insertError && inserted) {
          setRestaurants(inserted.map(fromRow))
        }
      } else {
        setRestaurants(data.map(fromRow))
      }
      setLoading(false)
    }
    load()
  }, [])

  async function updateRestaurant(id, patch) {
    // Optimistic update
    setRestaurants(prev =>
      prev.map(r => (r.id === id ? { ...r, ...patch } : r))
    )

    const dbPatch = {}
    if ('myVisited' in patch) dbPatch.my_visited = patch.myVisited
    if ('myRating' in patch) dbPatch.my_rating = patch.myRating

    const { error } = await supabase
      .from('restaurants')
      .update(dbPatch)
      .eq('id', id)

    if (error) console.error('Update error:', error)
  }

  async function addRestaurant(newPlace) {
    const { data, error } = await supabase
      .from('restaurants')
      .insert([toRow(newPlace)])
      .select()
      .single()

    if (error) {
      console.error('Insert error:', error)
      return
    }
    setRestaurants(prev => [...prev, fromRow(data)])
  }

  const allCuisines = useMemo(() => {
    const set = new Set()
    restaurants.forEach(r => r.cuisine.forEach(c => set.add(c)))
    return [...set].sort()
  }, [restaurants])

  const allTypes = useMemo(() => {
    const set = new Set(restaurants.map(r => r.type))
    return [...set].sort()
  }, [restaurants])

  const filtered = useMemo(() => {
    return restaurants.filter(r => {
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
    })
  }, [restaurants, filters])

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
              <button
                className={`view-btn ${view === 'cards' ? 'active' : ''}`}
                onClick={() => setView('cards')}
              >
                ⊞ Карточки
              </button>
              <button
                className={`view-btn ${view === 'map' ? 'active' : ''}`}
                onClick={() => setView('map')}
              >
                🗺 Карта
              </button>
            </div>
            <button className="btn-add" onClick={() => setShowAddModal(true)}>
              + Добавить место
            </button>
          </div>
        </div>
      </header>

      <FilterPanel
        filters={filters}
        onChange={setFilters}
        cuisines={allCuisines}
        types={allTypes}
      />

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
                />
              ))}
            </div>
          ) : (
            <div className="empty">
              <p>Ничего не найдено — попробуй изменить фильтры</p>
            </div>
          )
        ) : (
          <MapView restaurants={filtered} />
        )}
      </main>

      {showAddModal && (
        <AddPlaceModal
          onClose={() => setShowAddModal(false)}
          onAdd={addRestaurant}
        />
      )}
    </div>
  )
}
