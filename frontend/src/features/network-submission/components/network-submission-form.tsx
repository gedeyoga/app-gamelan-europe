import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import {
  useFieldArray,
  useForm,
  type FieldPath,
  type UseFormReturn,
} from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { SearchSelect, type SearchSelectOption } from '@/components/shared/search-select'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCountries } from '@/features/geo/hooks/use-countries'
import { useStates } from '@/features/geo/hooks/use-states'
import { useCities } from '@/features/geo/hooks/use-cities'
import { ApiError, isValidationError } from '@/lib/api-client'
import { mapApiFieldErrors } from '@/lib/field-errors'
import { cn } from '@/lib/utils'

import { buildNetworkSubmissionPayload } from '../lib/payload'
import {
  createNetworkSubmissionSchema,
  EMPTY_NETWORK_SUBMISSION_VALUES,
  type NetworkSubmissionFormValues,
} from '../lib/schema'
import {
  ACTIVITY_TYPE_OPTIONS,
  ACTIVITY_TYPE_OTHER,
  ORGANISATION_TYPES,
} from '@/features/network/lib/constants'
import type { CreateNetworkSubmissionInput } from '../types'

export interface NetworkSubmissionFormProps {
  isPending: boolean
  submissionError: Error | null
  onSubmit: (payload: CreateNetworkSubmissionInput) => void
  className?: string
}

interface GeoFieldsProps {
  form: UseFormReturn<NetworkSubmissionFormValues>
  disabled: boolean
}

// Cascade Country -> State -> City; ganti country/state reset turunannya.
function GeoFields({ form, disabled }: GeoFieldsProps) {
  const { t } = useTranslation()
  const countryValue = form.watch('countryId')
  const stateValue = form.watch('stateId')

  const countriesQuery = useCountries()
  const countries = useMemo(() => countriesQuery.data ?? [], [countriesQuery.data])
  const countryOptions = useMemo<SearchSelectOption[]>(
    () => countries.map((country) => ({ value: String(country.id), label: country.name })),
    [countries],
  )

  const iso2 = countries.find((country) => String(country.id) === countryValue)?.iso2 ?? ''
  const statesQuery = useStates(iso2)
  const states = useMemo(() => statesQuery.data ?? [], [statesQuery.data])
  const stateOptions = useMemo<SearchSelectOption[]>(
    () => states.map((state) => ({ value: String(state.id), label: state.name })),
    [states],
  )

  const countryId = Number(countryValue) || undefined
  const stateId = Number(stateValue) || undefined
  const citiesQuery = useCities({ countryId, stateId })
  const cities = useMemo(() => citiesQuery.data ?? [], [citiesQuery.data])
  const cityOptions = useMemo<SearchSelectOption[]>(
    () => cities.map((city) => ({ value: String(city.id), label: city.name })),
    [cities],
  )

  function handleCountryChange(next: string, onChange: (value: string) => void) {
    if (next === form.getValues('countryId')) return
    onChange(next)
    form.setValue('stateId', '', { shouldDirty: true, shouldValidate: true })
    form.setValue('cityId', '', { shouldDirty: true, shouldValidate: true })
  }

  function handleStateChange(next: string, onChange: (value: string) => void) {
    if (next === form.getValues('stateId')) return
    onChange(next)
    form.setValue('cityId', '', { shouldDirty: true, shouldValidate: true })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="countryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('networkSubmission:form.country.label')}</FormLabel>
              <FormControl>
                <SearchSelect
                  options={countryOptions}
                  value={field.value}
                  onChange={(value) => handleCountryChange(value, field.onChange)}
                  placeholder={t('networkSubmission:search.placeholder')}
                  searchPlaceholder={t('networkSubmission:search.searchPlaceholder')}
                  emptyLabel={t('networkSubmission:search.emptyLabel')}
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
              <FormLabel>{t('networkSubmission:form.state.label')}</FormLabel>
              <FormControl>
                <SearchSelect
                  options={stateOptions}
                  value={field.value}
                  onChange={(value) => handleStateChange(value, field.onChange)}
                  placeholder={
                    iso2
                      ? t('networkSubmission:search.placeholder')
                      : t('networkSubmission:form.stateSelectCountry')
                  }
                  searchPlaceholder={t('networkSubmission:search.searchPlaceholder')}
                  emptyLabel={t('networkSubmission:search.emptyLabel')}
                  isLoading={statesQuery.isLoading}
                  disabled={disabled || !iso2 || statesQuery.isLoading}
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
            <FormLabel>{t('networkSubmission:form.city.label')}</FormLabel>
            <FormControl>
              <SearchSelect
                options={cityOptions}
                value={field.value}
                onChange={field.onChange}
                placeholder={
                  stateId
                    ? t('networkSubmission:form.city.placeholder')
                    : t('networkSubmission:form.citySelectState')
                }
                searchPlaceholder={t('networkSubmission:search.searchPlaceholder')}
                emptyLabel={t('networkSubmission:search.emptyLabel')}
                isLoading={citiesQuery.isLoading}
                disabled={disabled || !stateId || citiesQuery.isLoading}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}

export function NetworkSubmissionForm({
  isPending,
  submissionError,
  onSubmit,
  className,
}: NetworkSubmissionFormProps) {
  const { t } = useTranslation()
  const schema = useMemo(() => createNetworkSubmissionSchema(t), [t])
  const form = useForm<NetworkSubmissionFormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_NETWORK_SUBMISSION_VALUES,
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'socialMedia' })

  // 422 -> tampil per-field via setError; tanpa toast, tanpa banner.
  useEffect(() => {
    if (!isValidationError(submissionError)) return
    form.clearErrors()
    for (const [field, message] of Object.entries(mapApiFieldErrors(submissionError))) {
      form.setError(field as FieldPath<NetworkSubmissionFormValues>, {
        type: 'server',
        message,
      })
    }
  }, [submissionError, form])

  // Banner global untuk non-422 (429 rate-limit / lain generik,
  // termasuk non-ApiError seperti TypeError saat fetch gagal).
  const bannerMessage = (() => {
    if (!submissionError || isValidationError(submissionError)) return null
    if (submissionError instanceof ApiError) {
      if (submissionError.statusCode === 429) return t('networkSubmission:errors.rateLimited')
    }
    return t('networkSubmission:errors.generic')
  })()

  const activityType = form.watch('activityType')

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) =>
          onSubmit(buildNetworkSubmissionPayload(values)),
        )}
        className={cn('flex flex-col gap-6', className)}
        noValidate
      >
        <Card>
          <CardHeader>
            <CardTitle>{t('networkSubmission:section.organisation')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="organisationType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('networkSubmission:form.organisationType.label')}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={isPending}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={t('networkSubmission:form.organisationType.placeholder')}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ORGANISATION_TYPES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {t(`networkSubmission:form.organisationType.options.${value}`)}
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('networkSubmission:form.name.label')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t('networkSubmission:form.name.placeholder')}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ledBy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('networkSubmission:form.ledBy.label')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t('networkSubmission:form.ledBy.placeholder')}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="submitter.email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('networkSubmission:form.submitter.email.label')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder={t('networkSubmission:form.submitter.email.placeholder')}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <GeoFields form={form} disabled={isPending} />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('networkSubmission:form.address.label')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t('networkSubmission:form.address.placeholder')}
                      disabled={isPending}
                    />
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
                  <FormLabel>{t('networkSubmission:form.mapsUrl.label')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="url"
                      placeholder={t('networkSubmission:form.mapsUrl.placeholder')}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('networkSubmission:form.website.label')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="url"
                        placeholder={t('networkSubmission:form.website.placeholder')}
                        disabled={isPending}
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
                    <FormLabel>{t('networkSubmission:form.contact.label')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t('networkSubmission:form.contact.placeholder')}
                        disabled={isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {t('networkSubmission:form.socialMedia.label')}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending || fields.length >= 10}
                  onClick={() => append({ platform: '', url: '' })}
                >
                  <Plus data-icon="inline-start" className="size-4" />
                  {t('networkSubmission:form.socialMedia.add')}
                </Button>
              </div>

              {fields.length === 0 && (
                <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                  {t('networkSubmission:form.socialMedia.empty')}
                </p>
              )}

              {fields.map((item, index) => (
                <div key={item.id} className="flex flex-col gap-3 rounded-lg border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t('networkSubmission:form.socialMedia.index', { number: index + 1 })}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t('networkSubmission:form.socialMedia.remove')}
                      title={t('networkSubmission:form.socialMedia.remove')}
                      disabled={isPending}
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
                        <FormLabel>{t('networkSubmission:form.socialMedia.platform')}</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            aria-label={t('networkSubmission:form.socialMedia.platformAria', {
                              number: index + 1,
                            })}
                            placeholder={t(
                              'networkSubmission:form.socialMedia.platformPlaceholder',
                            )}
                            disabled={isPending}
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
                        <FormLabel>{t('networkSubmission:form.socialMedia.url')}</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="url"
                            aria-label={t('networkSubmission:form.socialMedia.urlAria', {
                              number: index + 1,
                            })}
                            placeholder={t('networkSubmission:form.socialMedia.urlPlaceholder')}
                            disabled={isPending}
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
                  <FormLabel>{t('networkSubmission:form.activityType.label')}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={isPending}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={t('networkSubmission:form.activityType.placeholder')}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ACTIVITY_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {t(`networkSubmission:form.activityType.options.${option.key}`)}
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
                    <FormLabel>{t('networkSubmission:form.activityType.otherLabel')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t('networkSubmission:form.activityType.otherPlaceholder')}
                        disabled={isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('networkSubmission:form.content.label')}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={6}
                      placeholder={t('networkSubmission:form.content.placeholder')}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {bannerMessage && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {bannerMessage}
          </p>
        )}

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={isPending} aria-busy={isPending}>
            {isPending
              ? t('networkSubmission:actions.submitting')
              : t('networkSubmission:actions.submit')}
          </Button>
        </div>
      </form>
    </Form>
  )
}
