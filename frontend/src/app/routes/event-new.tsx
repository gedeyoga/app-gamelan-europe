import { ArrowLeft, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  getApiErrorMessage,
  isConflictError,
  isValidationError,
  toastError,
  toastSuccess,
} from '@/lib/toast'
import { useAuthPermissions } from '@/features/auth/hooks/use-permissions'
import { EventForm } from '@/features/event/components/event-form'
import { type EventFormValues, EMPTY_EVENT_VALUES } from '@/features/event/lib/schema'
import { useCreateEvent } from '@/features/event/hooks/use-create-event'
import { useCreateEventType } from '@/features/event/hooks/use-create-event-type'
import { useEventTypes } from '@/features/event/hooks/use-event-types'
import { useSubmitEvent } from '@/features/event/hooks/use-submit-event'
import { useUploadImage } from '@/features/event/hooks/use-upload-image'
import type { CreateEventInput, Event, EventType } from '@/features/event/types'

const INITIAL_VALUES: EventFormValues = {
  ...EMPTY_EVENT_VALUES,
  location: { ...EMPTY_EVENT_VALUES.location },
}

export function EventNewPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { can } = useAuthPermissions()

  const canCreate = can('event:create')
  const canReadEventTypes = can('event-type:read')
  const canCreateEventType = can('event-type:create')
  const canPublishEvent = can('event:publish')
  const canSubmitEvent = can('event:submit')
  const canApproveEvent = can('event:approve')
  const canRejectEvent = can('event:reject')

  const eventTypesQuery = useEventTypes(canReadEventTypes)
  const createEvent = useCreateEvent()
  const submitEvent = useSubmitEvent()
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

  async function handleSubmit(payload: CreateEventInput) {
    // Backend mengabaikan `status` create bagi non-admin → buat draft dulu, lalu panggil endpoint submit.
    const isRequest = payload.status === 'REQUEST'
    let created: Event
    try {
      created = await createEvent.mutateAsync(isRequest ? { ...payload, status: 'DRAFT' } : payload)
    } catch (err: unknown) {
      // 422/409 create mengalir ke form via submissionError → per-field; tetap di halaman.
      if (isValidationError(err) || isConflictError(err)) return
      toastError(getApiErrorMessage(err, t('event:toast.createFailed')))
      return
    }
    if (isRequest) {
      try {
        await submitEvent.mutateAsync(created.id)
      } catch (err: unknown) {
        // Submit gagal: event sudah terbuat sebagai draft — jangan biarkan submit ulang membuat duplikat.
        toastError(getApiErrorMessage(err, t('event:toast.createFailed')))
        navigate(`/events/${created.id}/edit`)
        return
      }
    }
    toastSuccess(t('event:toast.created'))
    navigate('/events')
  }

  if (!canCreate) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <ShieldAlert className="size-6 text-destructive" />
        <p className="text-sm font-medium">{t('event:errors.noCreatePermission')}</p>
        <Button variant="outline" onClick={() => navigate('/events')}>
          <ArrowLeft className="size-4" data-icon="inline-start" />
          {t('event:form.cancel')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col lg:min-h-0">
      <EventForm
        mode="create"
        initialValues={INITIAL_VALUES}
        isPending={createEvent.isPending || submitEvent.isPending}
        submissionError={createEvent.error}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/events')}
        eventTypes={eventTypesQuery.data?.items ?? []}
        isLoadingEventTypes={eventTypesQuery.isPending}
        canReadEventTypes={canReadEventTypes}
        canCreateEventType={canCreateEventType}
        canPublishEvent={canPublishEvent}
        canSubmitEvent={canSubmitEvent}
        canApproveEvent={canApproveEvent}
        canRejectEvent={canRejectEvent}
        onCreateEventType={handleCreateEventType}
        onUploadImage={uploadImage.mutateAsync}
        onUploadError={handleUploadError}
      />
    </div>
  )
}
