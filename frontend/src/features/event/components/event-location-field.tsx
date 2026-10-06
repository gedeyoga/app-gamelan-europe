import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { UseFormReturn } from 'react-hook-form'

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { LocationMapPicker } from '@/components/shared/location-map-picker'
import { SearchSelect, type SearchSelectOption } from '@/components/shared/search-select'
import { cn } from '@/lib/utils'

import { useCities } from '@/features/geo/hooks/use-cities'
import { useCountries } from '@/features/geo/hooks/use-countries'
import { useStates } from '@/features/geo/hooks/use-states'
import type { CityOption } from '@/features/geo/api/geo'

import { CitySelect } from './city-select'
import type { EventFormValues } from '../lib/schema'

export interface EventLocationFieldProps {
  form: UseFormReturn<EventFormValues>
  disabled?: boolean
  className?: string
  /** Gate `city:create` — baris tambah kota inline disembunyikan bila `false`. */
  canCreateCity?: boolean
  onCreateCity?: (input: {
    name: string
    countryId: number
    stateId: number
  }) => Promise<CityOption | undefined>
}

// Lokasi event: Venue (name) + geo cascade Country → State → City + address + map.
// Nilai form menyimpan `countryId`/`stateId`/`cityId` sebagai string (ID FK) — pilihan
// paling sedikit friksi: endpoint /cities butuh countryId/stateId numerik dan payload
// event menerima ID numerik langsung; nama country/state/city diambil dari relasi response.
export function EventLocationField({
  form,
  disabled = false,
  className,
  canCreateCity = false,
  onCreateCity,
}: EventLocationFieldProps) {
  const { t } = useTranslation()
  const lat = form.watch('location.lat')
  const lng = form.watch('location.lng')
  const address = form.watch('location.address')
  const countryIdValue = form.watch('location.countryId')
  const stateIdValue = form.watch('location.stateId')

  const countriesQuery = useCountries()
  const countries = useMemo(() => countriesQuery.data ?? [], [countriesQuery.data])
  const countryOptions = useMemo<SearchSelectOption[]>(
    () => countries.map((country) => ({ value: String(country.id), label: country.name })),
    [countries],
  )

  const countryId = Number(countryIdValue) || undefined
  // State & city difetch lewat ID; `iso2` diturunkan dari country terpilih (endpoint /states
  // memfilter per countryCode), `/cities` memfilter per countryId (+ stateId).
  const iso2 = countries.find((country) => country.id === countryId)?.iso2 ?? ''
  const statesQuery = useStates(iso2)
  const states = useMemo(() => statesQuery.data ?? [], [statesQuery.data])
  const stateOptions = useMemo<SearchSelectOption[]>(
    () => states.map((state) => ({ value: String(state.id), label: state.name })),
    [states],
  )

  const stateId = Number(stateIdValue) || undefined
  const citiesQuery = useCities({ countryId, stateId })
  const cities = useMemo(() => citiesQuery.data ?? [], [citiesQuery.data])
  const cityOptions = useMemo<SearchSelectOption[]>(
    () => cities.map((city) => ({ value: String(city.id), label: city.name })),
    [cities],
  )

  function handlePick(nextLat: string, nextLng: string) {
    form.setValue('location.lat', nextLat, { shouldDirty: true })
    form.setValue('location.lng', nextLng, { shouldDirty: true })
  }

  function handleAddressChange(nextAddress: string) {
    form.setValue('location.address', nextAddress, { shouldDirty: true })
  }

  // Ganti country → reset state + city (ID tidak berlaku lintas negara).
  function handleCountryChange(next: string, onChange: (value: string) => void) {
    if (next === form.getValues('location.countryId')) return
    onChange(next)
    form.setValue('location.stateId', '', { shouldDirty: true, shouldValidate: true })
    form.setValue('location.cityId', '', { shouldDirty: true, shouldValidate: true })
  }

  // Ganti state → reset city.
  function handleStateChange(next: string, onChange: (value: string) => void) {
    if (next === form.getValues('location.stateId')) return
    onChange(next)
    form.setValue('location.cityId', '', { shouldDirty: true, shouldValidate: true })
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <FormField
        control={form.control}
        name="location.name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('event:location.venueLabel')}</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder={t('event:location.venuePlaceholder')}
                disabled={disabled}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="location.countryId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('event:location.countryLabel')}</FormLabel>
            <FormControl>
              <SearchSelect
                options={countryOptions}
                value={field.value}
                onChange={(value) => handleCountryChange(value, field.onChange)}
                placeholder={t('event:location.countryPlaceholder')}
                searchPlaceholder={t('event:location.countrySearch')}
                emptyLabel={t('event:location.countryEmpty')}
                isLoading={countriesQuery.isLoading}
                disabled={disabled}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="location.stateId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('event:location.stateLabel')}</FormLabel>
              <FormControl>
                <SearchSelect
                  options={stateOptions}
                  value={field.value}
                  onChange={(value) => handleStateChange(value, field.onChange)}
                  placeholder={
                    iso2
                      ? t('event:location.statePlaceholder')
                      : t('event:location.stateSelectCountry')
                  }
                  searchPlaceholder={t('event:location.stateSearch')}
                  emptyLabel={t('event:location.stateEmpty')}
                  disabled={disabled || !iso2 || statesQuery.isLoading}
                  isLoading={statesQuery.isLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="location.cityId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('event:location.cityLabel')}</FormLabel>
              <FormControl>
                <CitySelect
                  options={cityOptions}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder={
                    stateIdValue
                      ? t('event:location.cityPlaceholder')
                      : t('event:location.citySelectState')
                  }
                  searchPlaceholder={t('event:location.citySearch')}
                  createSearchPlaceholder={t('event:location.citySearchCreate')}
                  emptyLabel={t('event:location.cityEmpty')}
                  addLabel={(name) => t('event:location.cityAdd', { name })}
                  creatingLabel={t('event:location.cityCreating')}
                  disabled={disabled || !stateIdValue || citiesQuery.isLoading}
                  isLoading={citiesQuery.isLoading}
                  canCreate={canCreateCity}
                  onCreate={async (name) => {
                    if (!countryId || !stateId) return undefined
                    const created = await onCreateCity?.({ name, countryId, stateId })
                    return created ? { value: String(created.id), label: created.name } : undefined
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="location.address"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('event:location.addressLabel')}</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder={t('event:location.addressPlaceholder')}
                disabled={disabled}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">{t('event:location.mapLabel')}</label>
        <LocationMapPicker
          lat={lat}
          lng={lng}
          address={address}
          onChange={handlePick}
          onAddressChange={handleAddressChange}
          disabled={disabled}
        />
      </div>
    </div>
  )
}
