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
import { useUploadImage } from '@/features/event/hooks/use-upload-image'
import type { CreateEventInput, EventType } from '@/features/event/types'

const INITIAL_VALUES: EventFormValues = {
  ...EMPTY_EVENT_VALUES,
  location: { ...EMPTY_EVENT_VALUES.location },
}

export function EventNewPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { can } = useAuthPermissions()

  const canCreate = can('event:create')
  const canReadEventTypes = can('event:read')
  const canCreateEventType = can('event:create')

  const eventTypesQuery = useEventTypes(canReadEventTypes)
  const createEvent = useCreateEvent()
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
    createEvent.mutate(payload, {
      onSuccess: () => {
        toastSuccess(t('event:toast.created'))
        navigate('/events')
      },
      onError: (err: unknown) => {
        if (isValidationError(err) || isConflictError(err)) return
        toastError(getApiErrorMessage(err, t('event:toast.createFailed')))
      },
    })
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
        isPending={createEvent.isPending}
        submissionError={createEvent.error}
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
    </div>
  )
}
