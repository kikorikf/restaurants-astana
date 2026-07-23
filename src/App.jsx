import { useState, useEffect, useMemo } from 'react'
import seedData from './data/restaurants.json'
import FilterPanel from './components/FilterPanel'
import RestaurantCard from './components/RestaurantCard'
import MapView from './components/MapView'
import AddPlaceModal from './components/AddPlaceModal'
import './App.css'

const STORAGE_KEY = 'restaurants-astana'

function loadRestaurants() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return seedData
}

function saveRestaurants(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export default function App() {
  const [restaurants, setRestaurants] = useState(loadRestaurants)
  const [view, setView] = useState('cards') // 'cards' | 'map'
  const [showAddModal, setShowAddModal] = useState(false)
  const [filters, setFilters] = useState({
    cuisine: '',
    type: '',
    maxCheck: '',
    status: '',
    visited: '',
  })

  useEffect(() => {
    saveRestaurants(restaurants)
  }, [restaurants])

  function updateRestaurant(id, patch) {
    setRestaurants(prev =>
      prev.map(r => (r.id === id ? { ...r, ...patch } : r))
    )
  }

  function addRestaurant(newPlace) {
    setRestaurants(prev => [...prev, newPlace])
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
            <span className="header-count">{filtered.length} из {restaurants.length}</span>
          </div>
          <div className="header-actions">
            <div className="view-toggle">
              <button
                className={`view-btn ${view === 'cards' ? 'active' : ''}`}
                onClick={() => setView('cards')}
                title="Карточки"
              >
                ⊞ Карточки
              </button>
              <button
                className={`view-btn ${view === 'map' ? 'active' : ''}`}
                onClick={() => setView('map')}
                title="Карта"
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
        {view === 'cards' ? (
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
