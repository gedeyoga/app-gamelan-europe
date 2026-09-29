import { ArrowLeft, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { getApiErrorMessage, isValidationError, toastError, toastSuccess } from '@/lib/toast'
import { useAuthPermissions } from '@/features/auth/hooks/use-permissions'
import { NetworkForm } from '@/features/network/components/network-form'
import { useCreateNetwork } from '@/features/network/hooks/use-create-network'
import type { NetworkFormValues } from '@/features/network/lib/schema'
import type { CreateNetworkInput } from '@/features/network/types'
import { useUploadImage } from '@/features/story/hooks/use-upload-image'

const INITIAL_VALUES: NetworkFormValues = {
  name: '',
  state: '',
  country: '',
  address: '',
  website: '',
  contact: '',
  socialMedia: [],
  lat: '',
  lng: '',
  content: '',
}

export function NetworkNewPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { can } = useAuthPermissions()

  const canCreate = can('network:create')
  const createNetwork = useCreateNetwork()
  const uploadImage = useUploadImage()

  function handleUploadError(err: unknown) {
    if (isValidationError(err)) return
    toastError(getApiErrorMessage(err, t('network:errors.uploadFailed')))
  }

  function handleSubmit(payload: CreateNetworkInput) {
    createNetwork.mutate(payload, {
      onSuccess: () => {
        toastSuccess(t('network:toast.created'))
        navigate('/networks')
      },
      onError: (err: unknown) => {
        // 422 mengalir ke form via submissionError -> setError per-field; tetap di halaman.
        if (isValidationError(err)) return
        toastError(getApiErrorMessage(err, t('network:toast.createFailed')))
      },
    })
  }

  if (!canCreate) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <ShieldAlert className="size-6 text-destructive" />
        <p className="text-sm font-medium">{t('network:errors.noCreatePermission')}</p>
        <Button variant="outline" onClick={() => navigate('/networks')}>
          <ArrowLeft className="size-4" data-icon="inline-start" />
          {t('common:actions.cancel')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col lg:min-h-0">
      <NetworkForm
        initialValues={INITIAL_VALUES}
        isPending={createNetwork.isPending}
        submissionError={createNetwork.error}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/networks')}
        onUploadImage={uploadImage.mutateAsync}
        onUploadError={handleUploadError}
      />
    </div>
  )
}
