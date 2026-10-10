import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Send, X } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useForm, type FieldPath } from 'react-hook-form'
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ApiError, isValidationError } from '@/lib/api-client'
import { mapApiFieldErrors } from '@/lib/field-errors'
import { cn } from '@/lib/utils'

import type { CreateMySubscriptionRequestInput, SubscriptionRequestPlanOption } from '../types'

export interface RequestSubscriptionContactDefaults {
  phone?: string
  website?: string
  address?: string
  country?: string
  organisation?: string
}

export interface RequestSubscriptionDialogProps {
  open: boolean
  plans: SubscriptionRequestPlanOption[]
  isLoading: boolean
  isError: boolean
  isSubmitting: boolean
  submissionError: Error | null
  defaultContact?: RequestSubscriptionContactDefaults
  onConfirm: (payload: CreateMySubscriptionRequestInput) => void
  onOpenChange: (open: boolean) => void
}

// Dialog self-service: pilih paket + alasan + kontak opsional → POST /subscription-requests/me.
export function RequestSubscriptionDialog({
  open,
  plans,
  isLoading,
  isError,
  isSubmitting,
  submissionError,
  defaultContact,
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
        phone: z.string().trim(),
        website: z
          .string()
          .trim()
          .max(500, t('validation:websiteMax', { count: 500 })),
        address: z
          .string()
          .trim()
          .max(500, t('validation:addressMax', { count: 500 })),
        country: z.string().trim(),
        organisation: z.string().trim(),
      }),
    [t],
  )

  type RequestFormValues = z.infer<typeof schema>

  const form = useForm<RequestFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      subscriptionId: '',
      reason: '',
      phone: defaultContact?.phone ?? '',
      website: defaultContact?.website ?? '',
      address: defaultContact?.address ?? '',
      country: defaultContact?.country ?? '',
      organisation: defaultContact?.organisation ?? '',
    },
  })

  // 422 -> per-field via setError; tanpa toast, dialog tetap terbuka.
  useEffect(() => {
    if (!isValidationError(submissionError)) return
    form.clearErrors()
    for (const [field, message] of Object.entries(mapApiFieldErrors(submissionError))) {
      form.setError(field as FieldPath<RequestFormValues>, { type: 'server', message })
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
      ...(values.phone.trim() ? { phone: values.phone.trim() } : {}),
      ...(values.website.trim() ? { website: values.website.trim() } : {}),
      ...(values.address.trim() ? { address: values.address.trim() } : {}),
      ...(values.country.trim() ? { country: values.country.trim() } : {}),
      ...(values.organisation.trim() ? { organisation: values.organisation.trim() } : {}),
    })
  }

  const contactFields: { name: FieldPath<RequestFormValues>; label: string; max?: number }[] = [
    { name: 'phone', label: t('form.phone'), max: 50 },
    { name: 'website', label: t('form.website'), max: 500 },
    { name: 'country', label: t('form.country'), max: 100 },
    { name: 'organisation', label: t('form.organisation'), max: 200 },
  ]

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

            <fieldset className="flex flex-col gap-3">
              <legend className="text-sm font-medium">{t('form.contactSection')}</legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {contactFields.map((contact) => (
                  <FormField
                    key={contact.name}
                    control={form.control}
                    name={contact.name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{contact.label}</FormLabel>
                        <FormControl>
                          <Input maxLength={contact.max} disabled={isSubmitting} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
                <div className="sm:col-span-2">
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('form.address')}</FormLabel>
                        <FormControl>
                          <Input maxLength={500} disabled={isSubmitting} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </fieldset>

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
