import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import { useEffect, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { cn } from '@/lib/utils'

import 'leaflet/dist/leaflet.css'

// Ikon eksplisit: L.Icon.Default._getIconUrl dapat melewati mergeOptions setelah bundling.
const MARKER_ICON = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

// Pusat default (Eropa) saat event belum punya koordinat.
const DEFAULT_CENTER: [number, number] = [48.8566, 2.3522]
const DEFAULT_ZOOM = 4
const SEARCH_ZOOM = 15
const MIN_QUERY_LENGTH = 3
const SEARCH_DEBOUNCE_MS = 500
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'

// Bentuk response Nominatim (jsonv2) yang dipakai; bukan boundary API backend.
interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
}

function isNominatimResult(value: unknown): value is NominatimResult {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  return (
    typeof item.place_id === 'number' &&
    typeof item.display_name === 'string' &&
    typeof item.lat === 'string' &&
    typeof item.lon === 'string'
  )
}

export interface LocationMapPickerProps {
  /** Koordinat string agar aman terhadap kolom DECIMAL backend. */
  lat: string
  lng: string
  /** Alamat saat ini (dipakai sebagai nilai awal pencarian). */
  address: string
  onChange: (lat: string, lng: string) => void
  onAddressChange: (address: string) => void
  disabled?: boolean
  className?: string
}

function toCoord(value: string): number | null {
  if (value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

interface MapClickHandlerProps {
  onPick: (lat: number, lng: number) => void
}

function MapClickHandler({ onPick }: MapClickHandlerProps) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng)
    },
  })
  return null
}

interface RecenterOnSelectProps {
  position: [number, number] | null
}

// Hanya dipicu pemilihan hasil pencarian (state berubah), bukan drag marker.
function RecenterOnSelect({ position }: RecenterOnSelectProps) {
  const map = useMap()
  useEffect(() => {
    if (position) map.setView(position, SEARCH_ZOOM)
  }, [map, position])
  return null
}

interface AddressSearchSelection {
  lat: number
  lng: number
  label: string
}

interface AddressSearchProps {
  address: string
  disabled: boolean
  onSelect: (selection: AddressSearchSelection) => void
}

function AddressSearch({ address, disabled, onSelect }: AddressSearchProps) {
  const { t, i18n } = useTranslation()
  const [query, setQuery] = useState(address)
  const [results, setResults] = useState<NominatimResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  // display_name terakhir dipilih/diisi: hentikan query ulang & sembunyikan saran.
  const [selectedLabel, setSelectedLabel] = useState<string | null>(address || null)
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS)

  useEffect(() => {
    const trimmed = debouncedQuery.trim()
    if (trimmed.length < MIN_QUERY_LENGTH || trimmed === selectedLabel) return

    const controller = new AbortController()
    let active = true
    const params = new URLSearchParams({ format: 'jsonv2', limit: '5', q: trimmed })

    void Promise.resolve()
      .then(() => {
        if (!active) return undefined
        setIsSearching(true)
        return fetch(`${NOMINATIM_SEARCH_URL}?${params.toString()}`, {
          headers: { 'Accept-Language': i18n.language },
          signal: controller.signal,
        })
      })
      .then(async (response) => (response?.ok ? await response.json() : []))
      .then((data: unknown) => {
        if (!active) return
        setResults(Array.isArray(data) ? data.filter(isNominatimResult) : [])
      })
      .catch(() => {
        if (active) setResults([])
      })
      .finally(() => {
        if (active) setIsSearching(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [debouncedQuery, i18n.language, selectedLabel])

  const trimmedQuery = query.trim()
  const isActiveQuery =
    trimmedQuery.length >= MIN_QUERY_LENGTH && trimmedQuery !== selectedLabel
  const showHint = trimmedQuery.length > 0 && trimmedQuery.length < MIN_QUERY_LENGTH
  const showResults = isActiveQuery && !isSearching && results.length > 0
  const showNoResults = isActiveQuery && !isSearching && results.length === 0

  function handleSelect(result: NominatimResult) {
    const lat = Number(result.lat)
    const lng = Number(result.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    setSelectedLabel(result.display_name)
    setQuery(result.display_name)
    setResults([])
    onSelect({ lat, lng, label: result.display_name })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') event.preventDefault() // jangan submit form luar
    if (event.key === 'Escape') setResults([])
  }

  return (
    <div className="flex flex-col gap-1">
      <Input
        value={query}
        onChange={(event) => {
          setSelectedLabel(null)
          setResults([])
          setQuery(event.target.value)
        }}
        onKeyDown={handleKeyDown}
        placeholder={t('event:location.searchPlaceholder')}
        aria-label={t('event:location.searchPlaceholder')}
        disabled={disabled}
      />
      {isActiveQuery && isSearching && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          {t('event:location.searching')}
        </p>
      )}
      {showResults && (
        <ul className="flex flex-col overflow-hidden rounded-md border bg-popover text-sm shadow-sm">
          {results.map((result) => (
            <li key={result.place_id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground"
                onClick={() => handleSelect(result)}
                disabled={disabled}
              >
                {result.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {showHint && <p className="text-xs text-muted-foreground">{t('event:location.searchHint')}</p>}
      {showNoResults && (
        <p className="text-xs text-muted-foreground">{t('event:location.searchNoResults')}</p>
      )}
    </div>
  )
}

// Presentational: cari alamat / klik map / geser marker → lat/lng. Nilai/onChange via props.
export function LocationMapPicker({
  lat,
  lng,
  address,
  onChange,
  onAddressChange,
  disabled = false,
  className,
}: LocationMapPickerProps) {
  const { t } = useTranslation()
  const latitude = toCoord(lat)
  const longitude = toCoord(lng)
  const hasPosition = latitude !== null && longitude !== null
  const position: [number, number] | null = hasPosition ? [latitude, longitude] : null
  // Hanya berubah saat memilih hasil pencarian → memicu recenter di RecenterOnSelect.
  const [recenter, setRecenter] = useState<[number, number] | null>(null)

  function handlePick(nextLat: number, nextLng: number) {
    if (disabled) return
    onChange(nextLat.toFixed(7), nextLng.toFixed(7))
  }

  function handleSearchSelect(selection: AddressSearchSelection) {
    handlePick(selection.lat, selection.lng)
    onAddressChange(selection.label)
    setRecenter([selection.lat, selection.lng])
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <AddressSearch address={address} disabled={disabled} onSelect={handleSearchSelect} />
      <MapContainer
        center={position ?? DEFAULT_CENTER}
        zoom={hasPosition ? 13 : DEFAULT_ZOOM}
        scrollWheelZoom
        // `isolate` membuat stacking context lokal: z-index internal Leaflet (pane 400–700) tidak
        // lagi bocor ke root dan menimpa Popover/DateTimePicker di luar map.
        className={cn('isolate z-0 h-64 w-full rounded-md border', disabled && 'pointer-events-none opacity-60')}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onPick={handlePick} />
        <RecenterOnSelect position={recenter} />
        {position && (
          <Marker
            position={position}
            icon={MARKER_ICON}
            draggable={!disabled}
            eventHandlers={{
              dragend: (event) => {
                const marker = event.target as L.Marker
                const latLng = marker.getLatLng()
                handlePick(latLng.lat, latLng.lng)
              },
            }}
          />
        )}
      </MapContainer>
      <p className="text-xs text-muted-foreground">
        {hasPosition
          ? t('event:location.coordinates', { latitude, longitude })
          : t('event:location.clickHint')}
      </p>
    </div>
  )
}
