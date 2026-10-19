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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SearchSelect, type SearchSelectOption } from '@/components/shared/search-select'
import { cn } from '@/lib/utils'

import { useCities } from '@/features/geo/hooks/use-cities'
import { useCountries } from '@/features/geo/hooks/use-countries'
import { useStates } from '@/features/geo/hooks/use-states'

import { ACTIVITY_TYPE_OPTIONS, ACTIVITY_TYPE_OTHER, ORGANISATION_TYPES } from '../lib/constants'
import type { NetworkFormValues } from '../lib/schema'

// Radix Select tidak mengizinkan item ber-`value=""`; sentinel ini dipetakan ke `''`.
const NONE_VALUE = '__none__'

export interface NetworkMetaPanelProps {
  form: UseFormReturn<NetworkFormValues>
  disabled?: boolean
  className?: string
  /** Section "Submitted by" (admin-only edit); dialog create menyembunyikannya. */
  showSubmitter?: boolean
}

// Cascade Country -> State -> City; ganti country/state reset turunannya.
export function NetworkMetaPanel({
  form,
  disabled = false,
  className,
  showSubmitter = true,
}: NetworkMetaPanelProps) {
  const { t } = useTranslation()

  const countryIdValue = form.watch('countryId')
  const stateIdValue = form.watch('stateId')
  const activityType = form.watch('activityType')

  const countriesQuery = useCountries()
  const countries = useMemo(() => countriesQuery.data ?? [], [countriesQuery.data])
  const countryOptions = useMemo<SearchSelectOption[]>(
    () => countries.map((country) => ({ value: String(country.id), label: country.name })),
    [countries],
  )

  // `/states` memfilter per countryCode; `/cities` per countryId (+ stateId).
  const iso2 = countries.find((country) => String(country.id) === countryIdValue)?.iso2 ?? ''
  const statesQuery = useStates(iso2)
  const states = useMemo(() => statesQuery.data ?? [], [statesQuery.data])
  const stateOptions = useMemo<SearchSelectOption[]>(
    () => states.map((state) => ({ value: String(state.id), label: state.name })),
    [states],
  )

  const countryId = Number(countryIdValue) || undefined
  const stateId = Number(stateIdValue) || undefined
  const citiesQuery = useCities({ countryId, stateId })
  const cities = useMemo(() => citiesQuery.data ?? [], [citiesQuery.data])
  const cityOptions = useMemo<SearchSelectOption[]>(
    () => cities.map((city) => ({ value: String(city.id), label: city.name })),
    [cities],
  )

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'socialMedia' })

  // Ganti country -> reset state & city.
  function handleCountryChange(next: string, onChange: (value: string) => void) {
    if (next === form.getValues('countryId')) return
    onChange(next)
    form.setValue('stateId', '', { shouldDirty: true, shouldValidate: true })
    form.setValue('cityId', '', { shouldDirty: true, shouldValidate: true })
  }

  // Ganti state -> reset city.
  function handleStateChange(next: string, onChange: (value: string) => void) {
    if (next === form.getValues('stateId')) return
    onChange(next)
    form.setValue('cityId', '', { shouldDirty: true, shouldValidate: true })
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

      <FormField
        control={form.control}
        name="organisationType"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('network:form.organisationType.label')}</FormLabel>
            <Select
              value={field.value || NONE_VALUE}
              onValueChange={(value) => field.onChange(value === NONE_VALUE ? '' : value)}
              disabled={disabled}
            >
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('network:form.organisationType.placeholder')} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>
                  {t('network:form.organisationType.placeholder')}
                </SelectItem>
                {ORGANISATION_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`network:form.organisationType.options.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="ledBy"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('network:form.ledBy.label')}</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder={t('network:form.ledBy.placeholder')}
                disabled={disabled}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {showSubmitter && (
        <FormField
          control={form.control}
          name="submitterEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('network:form.submitter.email')}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  placeholder={t('network:form.submitter.emailPlaceholder')}
                  disabled={disabled}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="countryId"
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
          name="stateId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('network:form.state')}</FormLabel>
              <FormControl>
                <SearchSelect
                  options={stateOptions}
                  value={field.value}
                  onChange={(value) => handleStateChange(value, field.onChange)}
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
        name="cityId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('network:form.city')}</FormLabel>
            <FormControl>
              <SearchSelect
                options={cityOptions}
                value={field.value}
                onChange={field.onChange}
                placeholder={
                  stateIdValue
                    ? t('network:form.cityPlaceholder')
                    : t('network:form.citySelectState')
                }
                searchPlaceholder={t('network:form.citySearch')}
                emptyLabel={t('network:form.cityEmpty')}
                isLoading={citiesQuery.isLoading}
                disabled={disabled || !stateIdValue || citiesQuery.isLoading}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

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
        name="mapsUrl"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('network:form.mapsUrl')}</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder={t('network:form.mapsUrlPlaceholder')}
                disabled={disabled}
              />
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

      <FormField
        control={form.control}
        name="activityType"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('network:form.activityType.label')}</FormLabel>
            <Select
              value={field.value || NONE_VALUE}
              onValueChange={(value) => field.onChange(value === NONE_VALUE ? '' : value)}
              disabled={disabled}
            >
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('network:form.activityType.placeholder')} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>
                  {t('network:form.activityType.placeholder')}
                </SelectItem>
                {ACTIVITY_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(`network:form.activityType.options.${option.key}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {activityType === ACTIVITY_TYPE_OTHER && (
        <FormField
          control={form.control}
          name="activityTypeOther"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('network:form.activityType.otherLabel')}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder={t('network:form.activityType.otherPlaceholder')}
                  disabled={disabled}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  )
}
