import { zodResolver } from '@hookform/resolvers/zod'
import { Check, FileText, Loader2, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Badge } from '@/components/ui/badge'
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
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { ApiError, isValidationError } from '@/lib/api-client'
import { mapApiFieldErrors } from '@/lib/field-errors'
import { formatFileSize } from '@/lib/format-file-size'
import { isAcceptedProofFile, MAX_PROOF_BYTES } from '@/lib/payment-proof'
import { useFileDrop } from '@/lib/use-file-drop'
import { cn } from '@/lib/utils'

import type { BillingSubscriptionOption, MemberSubscription, PaymentProof } from '../types'

export type SubscribeBillingMode = 'new' | 'upgrade'

export interface SubscribeBillingDialogProps {
  mode: SubscribeBillingMode
  member: MemberSubscription
  subscriptions: BillingSubscriptionOption[]
  isLoading: boolean
  isError: boolean
  isSubmitting: boolean
  submissionError: Error | null
  /** Bukti pembayaran hasil unggah; `null` = belum ada. */
  paymentProof: PaymentProof | null
  isUploadingProof: boolean
  /** Pesan error unggah non-422. */
  proofError: string | null
  onSelectProof: (file: File) => void
  onRemoveProof: () => void
  onConfirm: (subscriptionId: string) => void
  onOpenChange: (open: boolean) => void
}

// Dialog paket langganan (New/Upgrade) + unggah bukti pembayaran opsional.
// Bucket billing lama ditangani backend di `POST /billings/subscribe`.
export function SubscribeBillingDialog({
  mode,
  member,
  subscriptions,
  isLoading,
  isError,
  isSubmitting,
  submissionError,
  paymentProof,
  isUploadingProof,
  proofError,
  onSelectProof,
  onRemoveProof,
  onConfirm,
  onOpenChange,
}: SubscribeBillingDialogProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [proofName, setProofName] = useState<string | null>(null)
  const [invalidMessage, setInvalidMessage] = useState<string | null>(null)
  // Dinaikkan saat submit baru / bukti diganti/dihapus agar error 422 bukti ikut ter-reset.
  const [proofRevision, setProofRevision] = useState(0)

  const schema = useMemo(
    () => z.object({ subscriptionId: z.string().min(1, t('validation:subscriptionInvalid')) }),
    [t],
  )

  type SubscribeFormValues = z.infer<typeof schema>

  const form = useForm<SubscribeFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { subscriptionId: '' },
  })

  // 422 -> field form (`subscriptionId`) via setError.
  useEffect(() => {
    if (!isValidationError(submissionError)) return
    form.clearErrors()
    for (const [field, message] of Object.entries(mapApiFieldErrors(submissionError))) {
      if (field === 'subscriptionId') {
        form.setError('subscriptionId', { type: 'server', message })
      }
    }
  }, [submissionError, form])

  // 422 field non-form (mis. paymentProofUrl) -> tampil di area bukti pembayaran.
  const serverProofError = useMemo(() => {
    void proofRevision // reset saat submit baru / bukti diganti/dihapus
    if (!isValidationError(submissionError)) return null
    const messages = Object.entries(mapApiFieldErrors(submissionError))
      .filter(([field]) => field !== 'subscriptionId')
      .map(([, message]) => message)
    return messages.length > 0 ? messages.join(' ') : null
  }, [submissionError, proofRevision])

  // Banner global hanya untuk error non-422.
  const globalMessage =
    submissionError instanceof ApiError && submissionError.statusCode !== 422
      ? submissionError.message
      : null

  function handleFiles(files: File[]) {
    const file = files[0]
    if (!file) return
    if (!isAcceptedProofFile(file)) {
      setInvalidMessage(t('billing:subscribe.proofInvalid'))
      return
    }
    if (file.size > MAX_PROOF_BYTES) {
      setInvalidMessage(t('billing:subscribe.proofTooLarge'))
      return
    }
    setInvalidMessage(null)
    setProofRevision((n) => n + 1)
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
    setProofRevision((n) => n + 1)
    onRemoveProof()
  }

  function handleSubmit(values: SubscribeFormValues) {
    setProofRevision((n) => n + 1)
    onConfirm(values.subscriptionId)
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === 'upgrade'
              ? t('billing:subscribe.upgradeTitle')
              : t('billing:subscribe.createTitle')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'upgrade'
              ? t('billing:subscribe.upgradeDescription', { name: member.user.fullName })
              : t('billing:subscribe.createDescription', { name: member.user.fullName })}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {globalMessage && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {globalMessage}
              </p>
            )}

            {isError ? (
              <p className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">
                {t('billing:errors.loadSubscriptions')}
              </p>
            ) : (
              <FormField
                control={form.control}
                name="subscriptionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('billing:subscribe.selectSubscription')}</FormLabel>
                    {/*
                      radiogroup tombol: Enter/Space native; navigasi panah belum diimplementasikan
                      (ceiling) — tambah roving tabindex bila dibutuhkan.
                    */}
                    <div
                      role="radiogroup"
                      aria-label={t('billing:subscribe.selectSubscription')}
                      className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2"
                    >
                      {subscriptions.map((option) => {
                        const selected = field.value === option.id
                        return (
                          <Button
                            key={option.id}
                            type="button"
                            variant="outline"
                            role="radio"
                            aria-checked={selected}
                            disabled={isLoading || isSubmitting}
                            onClick={() => field.onChange(option.id)}
                            className={cn(
                              'h-auto w-full flex-col items-stretch gap-2 rounded-xl p-3 text-left whitespace-normal',
                              selected && 'ring-2 ring-primary',
                            )}
                          >
                            <span className="flex items-start justify-between gap-2">
                              <span className="font-medium text-foreground">{option.name}</span>
                              <Check
                                className={cn(
                                  'size-4 shrink-0 text-primary',
                                  !selected && 'opacity-0',
                                )}
                                aria-hidden="true"
                              />
                            </span>
                            {(option.subscriptionType || option.durationInDays != null) && (
                              <span className="flex flex-wrap items-center gap-1.5">
                                {option.subscriptionType && (
                                  <Badge variant="secondary">
                                    {t(
                                      `subscription:subscriptionTypeOptions.${option.subscriptionType}`,
                                    )}
                                  </Badge>
                                )}
                                {option.durationInDays != null && (
                                  <span className="text-xs text-muted-foreground">
                                    {t('subscription:card.durationValue', {
                                      count: option.durationInDays,
                                    })}
                                  </span>
                                )}
                              </span>
                            )}
                            {option.price != null && option.currency && (
                              <span className="text-sm tabular-nums text-muted-foreground">
                                {option.price.toLocaleString(undefined, {
                                  maximumFractionDigits: 2,
                                })}{' '}
                                {option.currency}
                              </span>
                            )}
                          </Button>
                        )
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {!isError && !isLoading && subscriptions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t('billing:subscribe.noSubscriptions')}
              </p>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium">
                {t('billing:subscribe.proofLabel')}{' '}
                <span className="font-normal text-muted-foreground">
                  {t('billing:subscribe.proofOptional')}
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
                    aria-label={t('billing:subscribe.proofRemove')}
                    title={t('billing:subscribe.proofRemove')}
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
                        {t('billing:subscribe.proofUploading')}
                      </p>
                    </>
                  ) : (
                    <>
                      <Upload className="size-6 text-muted-foreground" aria-hidden="true" />
                      <p className="text-xs text-muted-foreground">
                        {t('billing:subscribe.proofEmpty')}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabledProof}
                        onClick={() => inputRef.current?.click()}
                      >
                        <Upload className="size-4" data-icon="inline-start" />
                        {t('billing:subscribe.proofUpload')}
                      </Button>
                    </>
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                {t('billing:subscribe.proofFormats')}
              </p>
              {(proofMessage ?? serverProofError) && (
                <p className="text-xs text-destructive">{proofMessage ?? serverProofError}</p>
              )}
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSubmitting}>
                  <X data-icon="inline-start" className="size-4" />
                  {t('common:actions.cancel')}
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={isSubmitting || isLoading || isUploadingProof || subscriptions.length === 0}
              >
                <Check data-icon="inline-start" className="size-4" />
                {isSubmitting ? t('common:actions.saving') : t('billing:subscribe.confirm')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
