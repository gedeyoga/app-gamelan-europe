import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import { useFieldArray, type UseFormReturn } from 'react-hook-form'

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LocationMapPicker } from '@/components/shared/location-map-picker'
import { SearchSelect, type SearchSelectOption } from '@/components/shared/search-select'
import { cn } from '@/lib/utils'

import { useCountries } from '@/features/geo/hooks/use-countries'
import { useStates } from '@/features/geo/hooks/use-states'

import type { NetworkFormValues } from '../lib/schema'

export interface NetworkMetaPanelProps {
  form: UseFormReturn<NetworkFormValues>
  disabled?: boolean
  className?: string
}

// Query geo di panel: `iso2` diturunkan dari country terpilih (state tidak bisa di-fetch dari route).
export function NetworkMetaPanel({ form, disabled = false, className }: NetworkMetaPanelProps) {
  const { t } = useTranslation()

  const countryValue = form.watch('country')
  const stateValue = form.watch('state')
  const latValue = form.watch('lat')
  const lngValue = form.watch('lng')

  const countriesQuery = useCountries()
  const countries = useMemo(() => countriesQuery.data ?? [], [countriesQuery.data])
  // Sisipkan nilai form yang belum ada di list agar tidak tampil placeholder kosong.
  const countryOptions = useMemo<SearchSelectOption[]>(() => {
    const options = countries.map((country) => ({ value: country.name, label: country.name }))
    if (countryValue && !options.some((option) => option.value === countryValue)) {
      options.push({ value: countryValue, label: countryValue })
    }
    return options
  }, [countries, countryValue])

  // iso2 diturunkan dari nama country terpilih (field form menyimpan nama).
  const iso2 = countries.find((country) => country.name === countryValue)?.iso2 ?? ''
  const statesQuery = useStates(iso2)
  const states = useMemo(() => statesQuery.data ?? [], [statesQuery.data])
  const stateOptions = useMemo<SearchSelectOption[]>(() => {
    const options = states.map((state) => ({ value: state.name, label: state.name }))
    if (stateValue && !options.some((option) => option.value === stateValue)) {
      options.push({ value: stateValue, label: stateValue })
    }
    return options
  }, [states, stateValue])

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'socialMedia' })

  // Ganti country -> reset state (nama state tidak berlaku lintas negara).
  function handleCountryChange(next: string, onChange: (value: string) => void) {
    if (next === form.getValues('country')) return
    onChange(next)
    form.setValue('state', '', { shouldDirty: true, shouldValidate: true })
  }

  function handlePick(nextLat: string, nextLng: string) {
    form.setValue('lat', nextLat, { shouldDirty: true, shouldValidate: true })
    form.setValue('lng', nextLng, { shouldDirty: true, shouldValidate: true })
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('network:form.name')}</FormLabel>
            <FormControl>
              <Input {...field} disabled={disabled} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="country"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('network:form.country')}</FormLabel>
              <FormControl>
                <SearchSelect
                  options={countryOptions}
                  value={field.value}
                  onChange={(value) => handleCountryChange(value, field.onChange)}
                  placeholder={t('network:form.countryPlaceholder')}
                  searchPlaceholder={t('network:form.countrySearch')}
                  emptyLabel={t('network:form.countryEmpty')}
                  isLoading={countriesQuery.isLoading}
                  disabled={disabled}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="state"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('network:form.state')}</FormLabel>
              <FormControl>
                <SearchSelect
                  options={stateOptions}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder={
                    iso2
                      ? t('network:form.statePlaceholder')
                      : t('network:form.stateSelectCountry')
                  }
                  searchPlaceholder={t('network:form.stateSearch')}
                  emptyLabel={t('network:form.stateEmpty')}
                  disabled={disabled || !iso2 || statesQuery.isLoading}
                  isLoading={statesQuery.isLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="address"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('network:form.address')}</FormLabel>
            <FormControl>
              <Input {...field} disabled={disabled} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="website"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('network:form.website')}</FormLabel>
            <FormControl>
              <Input
                {...field}
                type="url"
                placeholder={t('network:form.websitePlaceholder')}
                disabled={disabled}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="contact"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('network:form.contact')}</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder={t('network:form.contactPlaceholder')}
                disabled={disabled}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{t('network:form.socialMedia.label')}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || fields.length >= 10}
            onClick={() => append({ platform: '', url: '' })}
          >
            <Plus data-icon="inline-start" className="size-4" />
            {t('network:form.socialMedia.add')}
          </Button>
        </div>

        {fields.length === 0 && (
          <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
            {t('network:form.socialMedia.empty')}
          </p>
        )}

        {fields.map((item, index) => (
          <div key={item.id} className="flex flex-col gap-3 rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {t('network:form.socialMedia.index', { number: index + 1 })}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('network:form.socialMedia.remove')}
                title={t('network:form.socialMedia.remove')}
                disabled={disabled}
                onClick={() => remove(index)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>

            <FormField
              control={form.control}
              name={`socialMedia.${index}.platform`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('network:form.socialMedia.platform')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t('network:form.socialMedia.platformPlaceholder')}
                      disabled={disabled}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name={`socialMedia.${index}.url`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('network:form.socialMedia.url')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="url"
                      placeholder={t('network:form.socialMedia.urlPlaceholder')}
                      disabled={disabled}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{t('network:form.mapLabel')}</p>
        <LocationMapPicker
          lat={latValue}
          lng={lngValue}
          onChange={handlePick}
          disabled={disabled}
        />
      </div>
    </div>
  )
}
