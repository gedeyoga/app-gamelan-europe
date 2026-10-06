import { Plus, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { UseFormReturn } from 'react-hook-form'

import { SearchSelect, type SearchSelectOption } from '@/components/shared/search-select'
import { ThumbnailUpload } from '@/components/shared/thumbnail-upload'
import { UserCombobox, type UserOption } from '@/components/shared/user-combobox'
import { Button } from '@/components/ui/button'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'

import { useAuth } from '@/features/auth/auth-provider'
import type { CityOption } from '@/features/geo/api/geo'
import { NetworkCreateDialog } from '@/features/network/components/network-create-dialog'
import { AuthorCreateDialog } from '@/features/user/components/author-create-dialog'
import { AuthorDeleteDialog } from '@/features/user/components/author-delete-dialog'
import { EventDatesField } from './event-dates-field'
import { EventLocationField } from './event-location-field'
import { EventTypeCombobox } from './event-type-combobox'
import type { EventFormValues } from '../lib/schema'
import { EVENT_ENTRIES, VISIBILITIES } from '../types'
import type { EventType } from '../types'

export interface EventMetaPanelProps {
  form: UseFormReturn<EventFormValues>
  slugTouched: boolean
  onNameChange: (value: string) => void
  onSlugTouched: () => void
  onGenerateSlug: () => void
  thumbnail: string | null
  thumbnailPreviewUrl: string | null
  isUploadingThumbnail: boolean
  thumbnailError: string | null
  onUploadThumbnail: (file: File) => void
  onRemoveThumbnail: () => void
  eventTypes: EventType[]
  isLoadingEventTypes: boolean
  canReadEventTypes: boolean
  canCreateEventType: boolean
  onCreateEventType: (name: string) => Promise<EventType | undefined>
  authors: UserOption[]
  isLoadingUsers: boolean
  canManageAuthors: boolean
  /** Gate `user:delete` && `admin:access` — aksi hapus author (cascade konten) di dropdown. */
  canDeleteAuthors: boolean
  /** Opsi penyelenggara (tabel network). */
  networks: SearchSelectOption[]
  isLoadingNetworks: boolean
  canReadNetworks: boolean
  canCreateNetwork: boolean
  /** Gate `city:create` — baris tambah kota inline di `EventLocationField`. */
  canCreateCity: boolean
  onCreateCity: (input: {
    name: string
    countryId: number
    stateId: number
  }) => Promise<CityOption | undefined>
  disabled?: boolean
  className?: string
}

export function EventMetaPanel({
  form,
  slugTouched,
  onNameChange,
  onSlugTouched,
  onGenerateSlug,
  thumbnail,
  thumbnailPreviewUrl,
  isUploadingThumbnail,
  thumbnailError,
  onUploadThumbnail,
  onRemoveThumbnail,
  eventTypes,
  isLoadingEventTypes,
  canReadEventTypes,
  canCreateEventType,
  onCreateEventType,
  authors,
  isLoadingUsers,
  canManageAuthors,
  canDeleteAuthors,
  networks,
  isLoadingNetworks,
  canReadNetworks,
  canCreateNetwork,
  canCreateCity,
  onCreateCity,
  disabled = false,
  className,
}: EventMetaPanelProps) {
  const { t } = useTranslation()
  const { user: sessionUser } = useAuth()
  const [authorDialogOpen, setAuthorDialogOpen] = useState(false)
  const [deletingAuthor, setDeletingAuthor] = useState<UserOption | null>(null)
  const [createdAuthors, setCreatedAuthors] = useState<UserOption[]>([])
  const [networkDialogOpen, setNetworkDialogOpen] = useState(false)
  const [createdNetworks, setCreatedNetworks] = useState<{ id: string; name: string }[]>([])

  // Gabung author baru (belum tentu muncul di `authors`) + dedupe terhadap prop.
  const authorOptions = useMemo(() => {
    const seen = new Set(authors.map((author) => author.id))
    return [...authors, ...createdAuthors.filter((author) => !seen.has(author.id))]
  }, [authors, createdAuthors])

  // Gabung network baru (belum tentu muncul di `networks`) + dedupe terhadap prop.
  const networkOptions = useMemo<SearchSelectOption[]>(() => {
    const seen = new Set(networks.map((network) => network.value))
    return [
      ...networks,
      ...createdNetworks
        .filter((network) => !seen.has(network.id))
        .map((network) => ({ value: network.id, label: network.name })),
    ]
  }, [networks, createdNetworks])

  function handleAuthorCreated(author: UserOption) {
    setCreatedAuthors((prev) =>
      prev.some((item) => item.id === author.id) ? prev : [...prev, author],
    )
  }

  function handleAuthorDeleted(authorId: string) {
    setCreatedAuthors((prev) => prev.filter((author) => author.id !== authorId))
    form.setValue(
      'authorIds',
      (form.getValues('authorIds') ?? []).filter((id) => id !== authorId),
      { shouldDirty: true, shouldValidate: true },
    )
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('event:form.titleLabel')}</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder={t('event:form.titlePlaceholder')}
                onChange={(event) => {
                  field.onChange(event)
                  onNameChange(event.target.value)
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="slug"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('event:form.slugLabel')}</FormLabel>
            <div className="flex gap-2">
              <FormControl>
                <Input
                  {...field}
                  placeholder={t('event:form.slugPlaceholder')}
                  onChange={(event) => {
                    onSlugTouched()
                    field.onChange(event)
                  }}
                />
              </FormControl>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={onGenerateSlug}
                aria-label={t('event:form.slugGenerate')}
                title={t('event:form.slugGenerate')}
              >
                <RefreshCw className="size-4" />
              </Button>
            </div>
            {slugTouched && (
              <p className="text-xs text-muted-foreground">{t('event:form.slugManualHint')}</p>
            )}
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="visibility"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('event:form.visibility')}</FormLabel>
            <FormControl>
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                disabled={disabled}
                aria-label={t('event:form.visibility')}
                className="flex flex-wrap gap-4"
              >
                {VISIBILITIES.map((value) => (
                  <FormItem key={value} className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <RadioGroupItem value={value} />
                    </FormControl>
                    <FormLabel className="font-normal">
                      {t(`event:visibilityOptions.${value}`)}
                    </FormLabel>
                  </FormItem>
                ))}
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="thumbnail"
        render={() => (
          <FormItem>
            <FormLabel>{t('event:form.thumbnail')}</FormLabel>
            <ThumbnailUpload
              value={thumbnail}
              previewUrl={thumbnailPreviewUrl}
              isUploading={isUploadingThumbnail}
              error={thumbnailError}
              disabled={disabled}
              onUpload={onUploadThumbnail}
              onRemove={onRemoveThumbnail}
            />
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="eventTypeIds"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('event:form.eventTypes')}</FormLabel>
            <EventTypeCombobox
              options={eventTypes}
              value={field.value}
              onChange={field.onChange}
              isLoading={isLoadingEventTypes}
              disabled={!canReadEventTypes}
              canCreate={canCreateEventType}
              onCreate={onCreateEventType}
            />
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="entry"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('event:form.entry')}</FormLabel>
            <FormControl>
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                disabled={disabled}
                aria-label={t('event:form.entry')}
                className="flex flex-wrap gap-4"
              >
                {EVENT_ENTRIES.map((value) => (
                  <FormItem key={value} className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <RadioGroupItem value={value} />
                    </FormControl>
                    <FormLabel className="font-normal">
                      {t(`event:entryOptions.${value}`)}
                    </FormLabel>
                  </FormItem>
                ))}
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {canManageAuthors && (
        <FormField
          control={form.control}
          name="authorIds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('event:form.authors')}</FormLabel>
              <UserCombobox
                options={authorOptions}
                value={field.value}
                onChange={field.onChange}
                isLoading={isLoadingUsers}
                disabled={disabled}
                canCreate={canManageAuthors}
                onCreateClick={() => setAuthorDialogOpen(true)}
                canDeleteOption={(option) =>
                  canDeleteAuthors &&
                  option.id !== sessionUser?.id &&
                  !field.value.includes(option.id)
                }
                onDeleteOption={setDeletingAuthor}
              />
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {canReadNetworks && (
        <FormField
          control={form.control}
          name="networkId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('event:form.organizer')}</FormLabel>
              <div className="flex w-full items-center gap-2">
                <SearchSelect
                  className="flex-1"
                  options={[
                    { value: '', label: t('event:form.organizerNone') },
                    ...networkOptions,
                  ]}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder={t('event:form.organizerPlaceholder')}
                  searchPlaceholder={t('event:form.organizerSearch')}
                  emptyLabel={t('event:form.organizerEmpty')}
                  isLoading={isLoadingNetworks}
                  disabled={disabled}
                />
                {canCreateNetwork && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    disabled={disabled}
                    onClick={() => setNetworkDialogOpen(true)}
                    aria-label={t('event:form.organizerAdd')}
                    title={t('event:form.organizerAdd')}
                  >
                    <Plus className="size-4" />
                  </Button>
                )}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      <FormField
        control={form.control}
        name="dates"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('event:form.eventDates')}</FormLabel>
            <EventDatesField value={field.value} onChange={field.onChange} disabled={disabled} />
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">{t('event:location.title')}</h3>
        <EventLocationField
          form={form}
          disabled={disabled}
          canCreateCity={canCreateCity}
          onCreateCity={onCreateCity}
        />
      </div>

      {canManageAuthors && (
        <>
          <AuthorCreateDialog
            open={authorDialogOpen}
            onOpenChange={setAuthorDialogOpen}
            onCreated={handleAuthorCreated}
          />
          {canDeleteAuthors && (
            <AuthorDeleteDialog
              open={Boolean(deletingAuthor)}
              onOpenChange={(open) => {
                if (!open) setDeletingAuthor(null)
              }}
              author={deletingAuthor}
              onDeleted={handleAuthorDeleted}
            />
          )}
        </>
      )}

      {canCreateNetwork && (
        <NetworkCreateDialog
          open={networkDialogOpen}
          onOpenChange={setNetworkDialogOpen}
          title={t('event:form.organizerCreateTitle')}
          description={t('event:form.organizerCreateDescription')}
          onCreated={(network) =>
            setCreatedNetworks((prev) =>
              prev.some((item) => item.id === network.id) ? prev : [...prev, network],
            )
          }
        />
      )}
    </div>
  )
}
