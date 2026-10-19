import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Send, X } from 'lucide-react'
import { useEffect, useMemo } from 'react'
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
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { ApiError, isValidationError } from '@/lib/api-client'
import { mapApiFieldErrors } from '@/lib/field-errors'
import { cn } from '@/lib/utils'

import type { CreateMySubscriptionRequestInput, SubscriptionRequestPlanOption } from '../types'

export interface RequestSubscriptionDialogProps {
  open: boolean
  plans: SubscriptionRequestPlanOption[]
  isLoading: boolean
  isError: boolean
  isSubmitting: boolean
  submissionError: Error | null
  onConfirm: (payload: CreateMySubscriptionRequestInput) => void
  onOpenChange: (open: boolean) => void
}

// Dialog self-service: pilih paket + alasan → POST /subscription-requests/me.
export function RequestSubscriptionDialog({
  open,
  plans,
  isLoading,
  isError,
  isSubmitting,
  submissionError,
  onConfirm,
  onOpenChange,
}: RequestSubscriptionDialogProps) {
  const { t } = useTranslation('subscriptionRequest')
  const { t: tSubscription } = useTranslation('subscription')

  const schema = useMemo(
    () =>
      z.object({
        subscriptionId: z.string().min(1, t('validation:subscriptionInvalid')),
        reason: z
          .string()
          .trim()
          .min(1, t('validation:reasonRequired'))
          .max(2000, t('validation:reasonMax', { count: 2000 })),
        // Kontak diisi backend dari tabel user; dialog tidak mengirimnya.
      }),
    [t],
  )

  type RequestFormValues = z.infer<typeof schema>

  const form = useForm<RequestFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      subscriptionId: '',
      reason: '',
    },
  })

  // 422 -> per-field via setError; tanpa toast, dialog tetap terbuka.
  useEffect(() => {
    if (!isValidationError(submissionError)) return
    form.clearErrors()
    for (const [field, message] of Object.entries(mapApiFieldErrors(submissionError))) {
      if (field === 'subscriptionId' || field === 'reason') {
        form.setError(field, { type: 'server', message })
      }
    }
  }, [submissionError, form])

  const globalMessage =
    submissionError instanceof ApiError && submissionError.statusCode !== 422
      ? submissionError.message
      : null

  function handleSubmit(values: RequestFormValues) {
    onConfirm({
      subscriptionId: values.subscriptionId,
      reason: values.reason,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('form.title')}</DialogTitle>
          <DialogDescription>{t('form.description')}</DialogDescription>
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
                {t('errors.load')}
              </p>
            ) : (
              <FormField
                control={form.control}
                name="subscriptionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('form.planLabel')}</FormLabel>
                    {/*
                      radiogroup tombol native (Enter/Space); navigasi panah belum diimplementasikan
                      (ceiling) — pola sama dengan subscribe-billing-dialog.
                    */}
                    <div
                      role="radiogroup"
                      aria-label={t('form.planLabel')}
                      className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2"
                    >
                      {plans.map((plan) => {
                        const selected = field.value === plan.id
                        return (
                          <Button
                            key={plan.id}
                            type="button"
                            variant="outline"
                            role="radio"
                            aria-checked={selected}
                            disabled={isLoading || isSubmitting}
                            onClick={() => field.onChange(plan.id)}
                            className={cn(
                              'h-auto w-full flex-col items-stretch gap-2 rounded-xl p-3 text-left whitespace-normal',
                              selected && 'ring-2 ring-primary',
                            )}
                          >
                            <span className="flex items-start justify-between gap-2">
                              <span className="font-medium text-foreground">{plan.name}</span>
                              <Check
                                className={cn(
                                  'size-4 shrink-0 text-primary',
                                  !selected && 'opacity-0',
                                )}
                                aria-hidden="true"
                              />
                            </span>
                            <span className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="secondary">
                                {tSubscription(
                                  `subscriptionTypeOptions.${plan.subscriptionType}`,
                                  { defaultValue: plan.subscriptionType },
                                )}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {tSubscription('card.durationValue', {
                                  count: plan.durationInDays,
                                })}
                              </span>
                            </span>
                            <span className="text-sm tabular-nums text-muted-foreground">
                              {plan.price.toLocaleString(undefined, {
                                maximumFractionDigits: 2,
                              })}{' '}
                              {plan.currency}
                            </span>
                          </Button>
                        )
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {!isError && !isLoading && plans.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('form.noSubscriptions')}</p>
            )}

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.reasonLabel')}</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder={t('form.reasonPlaceholder')}
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSubmitting}>
                  <X data-icon="inline-start" className="size-4" />
                  {t('common:actions.cancel')}
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={isSubmitting || isLoading || plans.length === 0}
              >
                <Send data-icon="inline-start" className="size-4" />
                {isSubmitting ? t('common:actions.saving') : t('form.submit')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
