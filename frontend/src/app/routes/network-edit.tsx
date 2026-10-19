import { ArrowLeft, RefreshCw, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

import { PublishScheduleDialog } from '@/components/shared/publish-schedule-dialog'
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
import { NetworkForm } from '@/features/network/components/network-form'
import { useApproveNetwork } from '@/features/network/hooks/use-approve-network'
import { useNetwork } from '@/features/network/hooks/use-network'
import { useRejectNetwork } from '@/features/network/hooks/use-reject-network'
import { useUpdateNetwork } from '@/features/network/hooks/use-update-network'
import { ACTIVITY_TYPE_OPTIONS, ACTIVITY_TYPE_OTHER } from '@/features/network/lib/constants'
import type { NetworkFormValues } from '@/features/network/lib/schema'
import type { CreateNetworkInput, Network } from '@/features/network/types'
import { useUploadImage } from '@/features/story/hooks/use-upload-image'

function toFormValues(network: Network): NetworkFormValues {
  const activityType = network.activityType ?? ''
  const isKnownActivityType = ACTIVITY_TYPE_OPTIONS.some(
    (option) => option.value === activityType,
  )
  return {
    name: network.name,
    organisationType: network.organisationType ?? '',
    ledBy: network.ledBy ?? '',
    countryId: network.countryId != null ? String(network.countryId) : '',
    stateId: network.stateId != null ? String(network.stateId) : '',
    cityId: network.cityId != null ? String(network.cityId) : '',
    address: network.address ?? '',
    website: network.website ?? '',
    mapsUrl: network.mapsUrl ?? '',
    contact: network.contact ?? '',
    socialMedia: (network.socialMedia ?? []).map((item) => ({
      platform: item.platform,
      url: item.url,
    })),
    activityType:
      activityType === '' || isKnownActivityType ? activityType : ACTIVITY_TYPE_OTHER,
    activityTypeOther: activityType === '' || isKnownActivityType ? '' : activityType,
    content: network.content ?? '',
    submitterEmail: network.submitterEmail ?? '',
  }
}

export function NetworkEditPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { can } = useAuthPermissions()

  const canUpdate = can('network:update')
  const canApprove = can('network:approve')
  const canReject = can('network:reject')
  const networkQuery = useNetwork(id)
  const updateNetwork = useUpdateNetwork()
  const approveNetwork = useApproveNetwork()
  const rejectNetwork = useRejectNetwork()
  const uploadImage = useUploadImage()
  const [approvePayload, setApprovePayload] = useState<CreateNetworkInput | null>(null)

  function handleUploadError(err: unknown) {
    if (isValidationError(err)) return
    toastError(getApiErrorMessage(err, t('network:errors.uploadFailed')))
  }

  function handleApprove(payload: CreateNetworkInput) {
    setApprovePayload(payload)
  }

  async function handleConfirmApprove(publishedAt: string) {
    if (!id || !approvePayload) return
    // Simpan perubahan field dulu; `publishedAt` hanya ke endpoint approve.
    try {
      await updateNetwork.mutateAsync({ id, payload: approvePayload })
    } catch (err: unknown) {
      // 422/409 mengalir ke form via submissionError -> setError per-field; tetap di halaman.
      if (isValidationError(err) || isConflictError(err)) return
      toastError(getApiErrorMessage(err, t('network:toast.updateFailed')))
      return
    }
    try {
      await approveNetwork.mutateAsync({ id, publishedAt })
      setApprovePayload(null)
      toastSuccess(t('network:toast.approved'))
    } catch (err: unknown) {
      toastError(getApiErrorMessage(err, t('network:toast.approveFailed')))
      return
    }
    navigate('/networks')
  }

  async function handleReject() {
    if (!id) return
    try {
      await rejectNetwork.mutateAsync(id)
      toastSuccess(t('network:toast.rejected'))
    } catch (err: unknown) {
      if (isValidationError(err)) return
      toastError(getApiErrorMessage(err, t('network:toast.rejectFailed')))
      return
    }
    navigate('/networks')
  }

  function handleSubmit(payload: CreateNetworkInput) {
    if (!id) return
    updateNetwork.mutate(
      { id, payload },
      {
        onSuccess: () => {
          toastSuccess(t('network:toast.updated'))
          navigate('/networks')
        },
        onError: (err: unknown) => {
          // 422 mengalir ke form via submissionError -> setError per-field; tetap di halaman.
          if (isValidationError(err)) return
          toastError(getApiErrorMessage(err, t('network:toast.updateFailed')))
        },
      },
    )
  }

  if (!canUpdate) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <ShieldAlert className="size-6 text-destructive" />
        <p className="text-sm font-medium">{t('network:errors.noUpdatePermission')}</p>
        <Button variant="outline" onClick={() => navigate('/networks')}>
          <ArrowLeft className="size-4" data-icon="inline-start" />
          {t('common:actions.cancel')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col lg:min-h-0">
      {networkQuery.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      ) : networkQuery.isError ? (
        isForbiddenError(networkQuery.error) ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
            <ShieldAlert className="size-6 text-destructive" />
            <p className="text-sm font-medium">{t('network:errors.forbidden')}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
            {t('network:errors.loadDetail')}
            <Button
              variant="link"
              size="sm"
              className="ml-2 h-auto p-0"
              onClick={() => void networkQuery.refetch()}
            >
              <RefreshCw className="size-3.5" data-icon="inline-start" />
              {t('common:actions.retry')}
            </Button>
          </div>
        )
      ) : networkQuery.data ? (
        <>
          <NetworkForm
            key={id}
            initialValues={toFormValues(networkQuery.data)}
            isPending={
              updateNetwork.isPending || approveNetwork.isPending || rejectNetwork.isPending
            }
            submissionError={updateNetwork.error}
            onSubmit={handleSubmit}
            onCancel={() => navigate('/networks')}
            onUploadImage={uploadImage.mutateAsync}
            onUploadError={handleUploadError}
            status={networkQuery.data.status}
            canApprove={canApprove}
            canReject={canReject}
            onApprove={handleApprove}
            onReject={() => void handleReject()}
          />
          <PublishScheduleDialog
            open={approvePayload !== null}
            onOpenChange={(open) => !open && setApprovePayload(null)}
            onConfirm={(publishedAt) => void handleConfirmApprove(publishedAt)}
            isPending={updateNetwork.isPending || approveNetwork.isPending}
            title={t('network:publishDialog.title')}
            description={t('network:publishDialog.description')}
            dateLabel={t('network:publishDialog.dateLabel')}
            datePlaceholder={t('network:publishDialog.datePlaceholder')}
            confirmLabel={t('network:publishDialog.confirm')}
            cancelLabel={t('common:actions.cancel')}
          />
        </>
      ) : null}
    </div>
  )
}
