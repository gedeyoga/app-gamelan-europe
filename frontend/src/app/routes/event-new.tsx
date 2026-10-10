import { useMemo } from 'react'
import { ArrowLeft, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import type { SearchSelectOption } from '@/components/shared/search-select'
import {
  getApiErrorMessage,
  isConflictError,
  isValidationError,
  toastError,
  toastSuccess,
} from '@/lib/toast'
import { useAuth } from '@/features/auth/auth-provider'
import { useAuthPermissions } from '@/features/auth/hooks/use-permissions'
import { useNetworks } from '@/features/network/hooks/use-networks'
import { useUsers } from '@/features/user/hooks/use-users'
import { EventForm } from '@/features/event/components/event-form'
import { type EventFormValues, EMPTY_EVENT_VALUES } from '@/features/event/lib/schema'
import { useCreateEvent } from '@/features/event/hooks/use-create-event'
import { useCreateEventType } from '@/features/event/hooks/use-create-event-type'
import { useEventTypes } from '@/features/event/hooks/use-event-types'
import { useSubmitEvent } from '@/features/event/hooks/use-submit-event'
import { useUploadImage } from '@/features/event/hooks/use-upload-image'
import type { CreateEventInput, Event, EventType } from '@/features/event/types'
import { useCreateCity } from '@/features/geo/hooks/use-create-city'
import type { CityOption } from '@/features/geo/api/geo'

export function EventNewPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { can } = useAuthPermissions()
  const { user } = useAuth()

  const canCreate = can('event:create')
  const canReadEventTypes = can('event-type:read')
  const canCreateEventType = can('event-type:create')
  const canDeleteEventType = can('event-type:delete')
  const canManageAuthors = can('user:create') && can('user:read')
  const canDeleteAuthors = can('user:delete') && can('admin:access')
  const canPublishEvent = can('event:publish')
  const canSubmitEvent = can('event:submit')
  const canApproveEvent = can('event:approve')
  const canRejectEvent = can('event:reject')
  const canReadNetworks = can('network:read')
  const canCreateNetwork = can('network:create')
  const canCreateCity = can('city:create')

  // Default author = current user bila tersedia; fallback `[]` (mis. storage korup
  // sehingga `user` null walau status authenticated). `useMemo` agar identitas stabil untuk form.
  const initialValues = useMemo<EventFormValues>(
    () => ({
      ...EMPTY_EVENT_VALUES,
      location: { ...EMPTY_EVENT_VALUES.location },
      authorIds: user ? [user.id] : [],
    }),
    [user],
  )

  const eventTypesQuery = useEventTypes(canReadEventTypes)
  const usersQuery = useUsers({ page: 1, limit: 100, enabled: canManageAuthors })
  const networksQuery = useNetworks({ page: 1, limit: 100, enabled: canReadNetworks })
  const createEvent = useCreateEvent()
  const submitEvent = useSubmitEvent()
  const createEventType = useCreateEventType()
  const createCity = useCreateCity()
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

  async function handleCreateCity(input: {
    name: string
    countryId: number
    stateId: number
  }): Promise<CityOption | undefined> {
    try {
      return await createCity.mutateAsync(input)
    } catch (err: unknown) {
      if (!isValidationError(err)) {
        toastError(getApiErrorMessage(err, t('event:errors.createCityFailed')))
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

  const authorsOptions = (usersQuery.data?.items ?? []).map((user) => ({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
  }))

  const networkOptions: SearchSelectOption[] = (networksQuery.data?.items ?? []).map((network) => ({
    value: network.id,
    label: network.name,
  }))

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
        initialValues={initialValues}
        isPending={createEvent.isPending || submitEvent.isPending}
        submissionError={createEvent.error}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/events')}
        eventTypes={eventTypesQuery.data?.items ?? []}
        isLoadingEventTypes={eventTypesQuery.isPending}
        canReadEventTypes={canReadEventTypes}
        canCreateEventType={canCreateEventType}
        canDeleteEventType={canDeleteEventType}
        canPublishEvent={canPublishEvent}
        canSubmitEvent={canSubmitEvent}
        canApproveEvent={canApproveEvent}
        canRejectEvent={canRejectEvent}
        onCreateEventType={handleCreateEventType}
        authors={authorsOptions}
        isLoadingUsers={usersQuery.isPending}
        canManageAuthors={canManageAuthors}
        canDeleteAuthors={canDeleteAuthors}
        networks={networkOptions}
        isLoadingNetworks={networksQuery.isPending}
        canReadNetworks={canReadNetworks}
        canCreateNetwork={canCreateNetwork}
        canCreateCity={canCreateCity}
        onCreateCity={handleCreateCity}
        onUploadImage={uploadImage.mutateAsync}
        onUploadError={handleUploadError}
      />
    </div>
  )
}
