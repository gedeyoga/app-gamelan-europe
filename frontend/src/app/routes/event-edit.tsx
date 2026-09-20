import { ArrowLeft, RefreshCw, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getApiErrorMessage,
  isConflictError,
  isValidationError,
  toastError,
  toastSuccess,
} from '@/lib/toast'
import { useAuthPermissions } from '@/features/auth/hooks/use-permissions'
import { isForbiddenError } from '@/features/auth/lib/permissions'
import { EventForm } from '@/features/event/components/event-form'
import { toDateOnly } from '@/features/event/lib/format'
import type { EventFormValues } from '@/features/event/lib/schema'
import { useCreateEventType } from '@/features/event/hooks/use-create-event-type'
import { useEvent } from '@/features/event/hooks/use-event'
import { useEventTypes } from '@/features/event/hooks/use-event-types'
import { useUpdateEvent } from '@/features/event/hooks/use-update-event'
import { useUploadImage } from '@/features/event/hooks/use-upload-image'
import type { CreateEventInput, Event, EventType } from '@/features/event/types'

function toFormValues(event: Event): EventFormValues {
  return {
    name: event.name,
    slug: event.slug,
    content: event.content ?? '',
    thumbnail: event.thumbnail ?? null,
    status: event.status,
    visibility: event.visibility,
    eventTypeIds: event.eventTypes.map((eventType) => eventType.id),
    dates: event.dates.map((entry) => ({
      date: toDateOnly(entry.date),
      startTime: entry.startTime ?? '',
      endTime: entry.endTime ?? '',
    })),
    location: {
      name: event.location?.name ?? '',
      address: event.location?.address ?? '',
      lat: event.location?.lat != null ? String(event.location.lat) : '',
      lng: event.location?.lng != null ? String(event.location.lng) : '',
    },
  }
}

export function EventEditPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { can } = useAuthPermissions()

  const canUpdate = can('event:update')
  const canReadEventTypes = can('event:read')
  const canCreateEventType = can('event:create')

  const eventQuery = useEvent(id)
  const eventTypesQuery = useEventTypes(canReadEventTypes)
  const updateEvent = useUpdateEvent()
  const createEventType = useCreateEventType()
  const uploadImage = useUploadImage()

  async function handleCreateEventType(name: string): Promise<EventType | undefined> {
    try {
      return await createEventType.mutateAsync({ name })
    } catch (err: unknown) {
      if (!isValidationError(err)) {
        toastError(getApiErrorMessage(err, t('event:errors.createEventTypeFailed')))
      }
      return undefined
    }
  }

  function handleUploadError(err: unknown) {
    if (isValidationError(err)) return
    toastError(getApiErrorMessage(err, t('event:errors.uploadFailed')))
  }

  function handleSubmit(payload: CreateEventInput) {
    if (!id) return
    updateEvent.mutate(
      { id, payload },
      {
        onSuccess: () => {
          toastSuccess(t('event:toast.updated'))
          navigate('/events')
        },
        onError: (err: unknown) => {
          // 422/409 mengalir ke form via submissionError → setError per-field; tetap di halaman.
          if (isValidationError(err) || isConflictError(err)) return
          toastError(getApiErrorMessage(err, t('event:toast.updateFailed')))
        },
      },
    )
  }

  if (!canUpdate) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <ShieldAlert className="size-6 text-destructive" />
        <p className="text-sm font-medium">{t('event:errors.noUpdatePermission')}</p>
        <Button variant="outline" onClick={() => navigate('/events')}>
          <ArrowLeft className="size-4" data-icon="inline-start" />
          {t('event:form.cancel')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col lg:min-h-0">
      {eventQuery.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      ) : eventQuery.isError ? (
        isForbiddenError(eventQuery.error) ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
            <ShieldAlert className="size-6 text-destructive" />
            <p className="text-sm font-medium">{t('event:errors.forbidden')}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
            {t('event:errors.loadDetail')}
            <Button
              variant="link"
              size="sm"
              className="ml-2 h-auto p-0"
              onClick={() => void eventQuery.refetch()}
            >
              <RefreshCw className="size-3.5" data-icon="inline-start" />
              {t('common:actions.retry')}
            </Button>
          </div>
        )
      ) : eventQuery.data ? (
        <EventForm
          mode="edit"
          initialValues={toFormValues(eventQuery.data)}
          initialPublishedAt={eventQuery.data.publishedAt}
          isPending={updateEvent.isPending}
          submissionError={updateEvent.error}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/events')}
          eventTypes={eventTypesQuery.data?.items ?? []}
          isLoadingEventTypes={eventTypesQuery.isPending}
          canReadEventTypes={canReadEventTypes}
          canCreateEventType={canCreateEventType}
          onCreateEventType={handleCreateEventType}
          onUploadImage={uploadImage.mutateAsync}
          onUploadError={handleUploadError}
        />
      ) : null}
    </div>
  )
}
