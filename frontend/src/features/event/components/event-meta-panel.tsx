import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { UseFormReturn } from 'react-hook-form'

import { ThumbnailUpload } from '@/components/shared/thumbnail-upload'
import { Button } from '@/components/ui/button'
import {
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
import { cn } from '@/lib/utils'

import { EventDatesField } from './event-dates-field'
import { EventLocationField } from './event-location-field'
import { EventTypeCombobox } from './event-type-combobox'
import type { EventFormValues } from '../lib/schema'
import { VISIBILITIES } from '../types'
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
  disabled = false,
  className,
}: EventMetaPanelProps) {
  const { t } = useTranslation()

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
            <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {VISIBILITIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`event:visibilityOptions.${value}`)}
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
        <EventLocationField form={form} disabled={disabled} />
      </div>
    </div>
  )
}
