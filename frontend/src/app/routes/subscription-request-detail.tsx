import { useState } from 'react'
import { ArrowLeft, Check, RefreshCw, ShieldAlert, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthPermissions } from '@/features/auth/hooks/use-permissions'
import { isForbiddenError } from '@/features/auth/lib/permissions'
import { useUploadPaymentProof } from '@/features/billing/hooks/use-upload-payment-proof'
import type { PaymentProof } from '@/features/billing/types'
import { ApproveSubscriptionRequestDialog } from '@/features/subscription-request/components/approve-subscription-request-dialog'
import { RejectSubscriptionRequestDialog } from '@/features/subscription-request/components/reject-subscription-request-dialog'
import { SubscriptionRequestDetailCard } from '@/features/subscription-request/components/subscription-request-detail-card'
import { useApproveSubscriptionRequest } from '@/features/subscription-request/hooks/use-approve-subscription-request'
import { useRejectSubscriptionRequest } from '@/features/subscription-request/hooks/use-reject-subscription-request'
import { useSubscriptionRequest } from '@/features/subscription-request/hooks/use-subscription-request'
import { isNotFoundError } from '@/lib/api-client'
import { getApiErrorMessage, isValidationError, toastError, toastSuccess } from '@/lib/toast'

export function SubscriptionRequestDetailPage() {
  const { t } = useTranslation('subscriptionRequest')
  const { can } = useAuthPermissions()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const canRead = can('subscription-request:read')
  const requestQuery = useSubscriptionRequest(id, canRead)
  const approveRequest = useApproveSubscriptionRequest()
  const rejectRequest = useRejectSubscriptionRequest()
  const uploadPaymentProof = useUploadPaymentProof()
  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [paymentProof, setPaymentProof] = useState<PaymentProof | null>(null)

  const request = requestQuery.data
  const canApprove = can('subscription-request:approve')
  const canReject = can('subscription-request:reject')
  const isPendingRequest = request?.status === 'PENDING'

  function handleBack() {
    navigate('/subscription-requests')
  }

  function handleApprove() {
    if (!request) return
    approveRequest.mutate(
      {
        id: request.id,
        ...(paymentProof
          ? { paymentProofUrl: paymentProof.url, paymentProofName: paymentProof.filename }
          : {}),
      },
      {
        onSuccess: () => {
          closeApprove()
          toastSuccess(t('toast.approved'))
        },
        onError: (err: unknown) => {
          if (isValidationError(err)) return
          toastError(getApiErrorMessage(err, t('toast.approveFailed')))
        },
      },
    )
  }

  function openApprove() {
    setPaymentProof(null)
    uploadPaymentProof.reset()
    setApproveOpen(true)
  }

  function closeApprove() {
    setApproveOpen(false)
    setPaymentProof(null)
    uploadPaymentProof.reset()
  }

  function handleSelectProof(file: File) {
    uploadPaymentProof.mutate(file, { onSuccess: setPaymentProof })
  }

  function handleReject(note: string) {
    if (!request) return
    rejectRequest.mutate(
      { id: request.id, note: note || undefined },
      {
        onSuccess: () => {
          setRejectOpen(false)
          toastSuccess(t('toast.rejected'))
        },
        onError: (err: unknown) => {
          if (isValidationError(err)) return
          toastError(getApiErrorMessage(err, t('toast.rejectFailed')))
        },
      },
    )
  }

  const backButton = (
    <Button type="button" variant="outline" onClick={handleBack}>
      <ArrowLeft className="size-4" data-icon="inline-start" />
      {t('detail.back')}
    </Button>
  )

  if (!canRead) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <ShieldAlert className="size-6 text-destructive" />
        <p className="text-sm font-medium">{t('errors.forbidden')}</p>
        {backButton}
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {backButton}

      {requestQuery.isPending ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : requestQuery.isError ? (
        isForbiddenError(requestQuery.error) ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
            <ShieldAlert className="size-6 text-destructive" />
            <p className="text-sm font-medium">{t('errors.forbidden')}</p>
          </div>
        ) : isNotFoundError(requestQuery.error) ? (
          <p className="text-center text-sm text-muted-foreground">{t('detail.notFound')}</p>
        ) : (
          <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
            {t('errors.load')}
            <Button
              variant="link"
              size="sm"
              className="ml-2 h-auto p-0"
              onClick={() => void requestQuery.refetch()}
            >
              <RefreshCw className="size-3.5" data-icon="inline-start" />
              {t('common:actions.retry')}
            </Button>
          </div>
        )
      ) : request ? (
        <>
          {(canApprove || canReject) && isPendingRequest && (
            <div className="flex flex-wrap justify-end gap-2">
              {canApprove && (
                <Button
                  disabled={approveRequest.isPending}
                  onClick={openApprove}
                >
                  <Check className="size-4" data-icon="inline-start" />
                  {t('actions.approve')}
                </Button>
              )}
              {canReject && (
                <Button
                  variant="outline"
                  disabled={rejectRequest.isPending}
                  onClick={() => setRejectOpen(true)}
                >
                  <X className="size-4" data-icon="inline-start" />
                  {t('actions.reject')}
                </Button>
              )}
            </div>
          )}

          <SubscriptionRequestDetailCard request={request} />
        </>
      ) : (
        <p className="text-center text-sm text-muted-foreground">{t('detail.notFound')}</p>
      )}

      {approveOpen && request && (
        <ApproveSubscriptionRequestDialog
          name={request.fullName}
          isSubmitting={approveRequest.isPending}
          paymentProof={paymentProof}
          isUploadingProof={uploadPaymentProof.isPending}
          proofError={
            uploadPaymentProof.error
              ? getApiErrorMessage(uploadPaymentProof.error, t('approveDialog.proofFailed'))
              : null
          }
          onSelectProof={handleSelectProof}
          onRemoveProof={() => {
            setPaymentProof(null)
            uploadPaymentProof.reset()
          }}
          onConfirm={handleApprove}
          onOpenChange={(open) => {
            if (!open) closeApprove()
          }}
        />
      )}
      {rejectOpen && request && (
        <RejectSubscriptionRequestDialog
          name={request.fullName}
          isSubmitting={rejectRequest.isPending}
          onConfirm={handleReject}
          onOpenChange={setRejectOpen}
        />
      )}
    </div>
  )
}
