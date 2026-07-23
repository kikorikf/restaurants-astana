import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default marker icons for Vite builds
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const CENTER = [51.163, 71.418]

export default function MapView({ restaurants }) {
  return (
    <div className="map-wrap">
      <MapContainer center={CENTER} zoom={14} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {restaurants.map(r => (
          <Marker key={r.id} position={[r.lat, r.lon]}>
            <Popup>
              <strong>{r.name}</strong>
              <br />
              {r.type} · {r.cuisine.join(', ')}
              <br />
              {r.address}
              {r.avgCheck && (
                <>
                  <br />
                  ~{r.avgCheck.toLocaleString('ru-RU')} ₸
                </>
              )}
              <br />
              <a
                href={`https://2gis.kz/astana/firm/${r.firmId}`}
                target="_blank"
                rel="noreferrer"
              >
                Открыть в 2ГИС →
              </a>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
