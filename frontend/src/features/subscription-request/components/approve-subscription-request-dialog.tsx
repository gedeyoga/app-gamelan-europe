import { Check, FileText, Loader2, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatFileSize } from '@/lib/format-file-size'
import { isAcceptedProofFile, MAX_PROOF_BYTES } from '@/lib/payment-proof'
import { useFileDrop } from '@/lib/use-file-drop'
import { cn } from '@/lib/utils'

import type { SubscriptionRequestPaymentProof } from '../types'

export interface ApproveSubscriptionRequestDialogProps {
  name: string
  isSubmitting: boolean
  /** Bukti pembayaran hasil unggah; `null` = belum ada. */
  paymentProof: SubscriptionRequestPaymentProof | null
  isUploadingProof: boolean
  /** Pesan error unggah non-422. */
  proofError: string | null
  onSelectProof: (file: File) => void
  onRemoveProof: () => void
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
}

// Dialog konfirmasi setujui request langganan + unggah bukti pembayaran opsional.
// Presentational: unggah & submit di-inject via props (container).
export function ApproveSubscriptionRequestDialog({
  name,
  isSubmitting,
  paymentProof,
  isUploadingProof,
  proofError,
  onSelectProof,
  onRemoveProof,
  onConfirm,
  onOpenChange,
}: ApproveSubscriptionRequestDialogProps) {
  const { t } = useTranslation('subscriptionRequest')
  const inputRef = useRef<HTMLInputElement>(null)
  const [proofName, setProofName] = useState<string | null>(null)
  const [invalidMessage, setInvalidMessage] = useState<string | null>(null)

  function handleFiles(files: File[]) {
    const file = files[0]
    if (!file) return
    if (!isAcceptedProofFile(file)) {
      setInvalidMessage(t('approveDialog.proofInvalid'))
      return
    }
    if (file.size > MAX_PROOF_BYTES) {
      setInvalidMessage(t('approveDialog.proofTooLarge'))
      return
    }
    setInvalidMessage(null)
    setProofName(file.name)
    onSelectProof(file)
  }

  const disabledProof = isSubmitting || isUploadingProof
  const { isDragging, dropHandlers } = useFileDrop(handleFiles, disabledProof)
  const proofMessage = invalidMessage ?? proofError
  const isImageProof = paymentProof?.mimeType.startsWith('image/') ?? false

  function handleRemoveProof() {
    setProofName(null)
    setInvalidMessage(null)
    onRemoveProof()
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('approveDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('approveDialog.description', { name })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-sm font-medium">
            {t('approveDialog.proofLabel')}{' '}
            <span className="font-normal text-muted-foreground">
              {t('approveDialog.proofOptional')}
            </span>
          </p>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            disabled={disabledProof}
            className="hidden"
            onChange={(event) => {
              handleFiles(Array.from(event.target.files ?? []))
              event.target.value = ''
            }}
          />

          {paymentProof ? (
            <div className="flex items-center gap-3 rounded-xl border p-3">
              {isImageProof ? (
                <img
                  src={paymentProof.url}
                  alt={paymentProof.filename}
                  className="size-14 shrink-0 rounded-md border object-cover"
                />
              ) : (
                <FileText className="size-14 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{paymentProof.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(paymentProof.size)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={isSubmitting}
                aria-label={t('approveDialog.proofRemove')}
                title={t('approveDialog.proofRemove')}
                onClick={handleRemoveProof}
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <div
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border border-dashed p-4 text-center',
                isDragging && 'ring-2 ring-primary',
              )}
              {...dropHandlers}
            >
              {isUploadingProof ? (
                <>
                  <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
                  <p className="truncate text-sm font-medium">{proofName}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('approveDialog.proofUploading')}
                  </p>
                </>
              ) : (
                <>
                  <Upload className="size-6 text-muted-foreground" aria-hidden="true" />
                  <p className="text-xs text-muted-foreground">
                    {t('approveDialog.proofEmpty')}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabledProof}
                    onClick={() => inputRef.current?.click()}
                  >
                    <Upload className="size-4" data-icon="inline-start" />
                    {t('approveDialog.proofUpload')}
                  </Button>
                </>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">{t('approveDialog.proofFormats')}</p>
          {proofMessage && <p className="text-xs text-destructive">{proofMessage}</p>}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSubmitting}>
              <X data-icon="inline-start" className="size-4" />
              {t('common:actions.cancel')}
            </Button>
          </DialogClose>
          <Button type="button" disabled={isSubmitting || isUploadingProof} onClick={onConfirm}>
            <Check data-icon="inline-start" className="size-4" />
            {isSubmitting ? t('common:actions.saving') : t('approveDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
