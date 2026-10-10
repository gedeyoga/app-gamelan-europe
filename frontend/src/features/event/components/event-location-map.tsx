import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'

import { cn } from '@/lib/utils'

import 'leaflet/dist/leaflet.css'

// Ikon eksplisit: `L.Icon.Default` dapat melewati mergeOptions setelah bundling.
const MARKER_ICON = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

const MAP_ZOOM = 15

export interface EventLocationMapProps {
  lat: number
  lng: number
  /** Label aksesibilitas untuk wrapper peta. */
  label: string
  className?: string
}

/**
 * Peta kecil read-only (satu marker, tanpa kontrol). Semua interaksi dimatikan
 * agar tidak membajak scroll halaman. Hanya render bila koordinat valid.
 */
export function EventLocationMap({ lat, lng, label, className }: EventLocationMapProps) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn('isolate z-0 overflow-hidden rounded-md border', className)}
    >
      <MapContainer
        center={[lat, lng]}
        zoom={MAP_ZOOM}
        className="h-48 w-full"
        // Read-only: matikan semua interaksi peta.
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        boxZoom={false}
        keyboard={false}
        touchZoom={false}
        zoomControl={false}
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]} icon={MARKER_ICON} interactive={false} />
      </MapContainer>
    </div>
  )
}
