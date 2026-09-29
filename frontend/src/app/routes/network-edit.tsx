import { ArrowLeft, RefreshCw, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getApiErrorMessage, isValidationError, toastError, toastSuccess } from '@/lib/toast'
import { useAuthPermissions } from '@/features/auth/hooks/use-permissions'
import { isForbiddenError } from '@/features/auth/lib/permissions'
import { NetworkForm } from '@/features/network/components/network-form'
import { useNetwork } from '@/features/network/hooks/use-network'
import { useUpdateNetwork } from '@/features/network/hooks/use-update-network'
import type { NetworkFormValues } from '@/features/network/lib/schema'
import type { CreateNetworkInput, Network } from '@/features/network/types'
import { useUploadImage } from '@/features/story/hooks/use-upload-image'

function toFormValues(network: Network): NetworkFormValues {
  return {
    name: network.name,
    state: network.state ?? '',
    country: network.country ?? '',
    address: network.address ?? '',
    website: network.website ?? '',
    contact: network.contact ?? '',
    socialMedia: (network.socialMedia ?? []).map((item) => ({
      platform: item.platform,
      url: item.url,
    })),
    lat: network.lat === null ? '' : String(network.lat),
    lng: network.lng === null ? '' : String(network.lng),
    content: network.content ?? '',
  }
}

export function NetworkEditPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { can } = useAuthPermissions()

  const canUpdate = can('network:update')
  const networkQuery = useNetwork(id)
  const updateNetwork = useUpdateNetwork()
  const uploadImage = useUploadImage()

  function handleUploadError(err: unknown) {
    if (isValidationError(err)) return
    toastError(getApiErrorMessage(err, t('network:errors.uploadFailed')))
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
        <NetworkForm
          key={id}
          initialValues={toFormValues(networkQuery.data)}
          isPending={updateNetwork.isPending}
          submissionError={updateNetwork.error}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/networks')}
          onUploadImage={uploadImage.mutateAsync}
          onUploadError={handleUploadError}
        />
      ) : null}
    </div>
  )
}
