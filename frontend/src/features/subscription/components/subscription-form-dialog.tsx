import { zodResolver } from '@hookform/resolvers/zod'
import { Save, X } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useForm, useWatch, type FieldPath } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ApiError, isValidationError } from '@/lib/api-client'
import { mapApiFieldErrors } from '@/lib/field-errors'

import { fromDurationInDays, toDurationInDays } from '../lib/duration'
import { formatPriceInput, parsePriceInput } from '../lib/price'
import { slugify } from '../lib/slug'
import {
  SUBSCRIPTION_CURRENCIES,
  SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_TYPES,
  type CreateSubscriptionInput,
  type Subscription,
  type UpdateSubscriptionInput,
} from '../types'

export type SubscriptionFormMode = 'create' | 'edit'

export interface SubscriptionFormDialogProps {
  mode: SubscriptionFormMode
  subscription: Subscription | null
  isSubmitting: boolean
  submissionError: Error | null
  onCreate: (payload: CreateSubscriptionInput) => void
  onUpdate: (payload: UpdateSubscriptionInput) => void
  onOpenChange: (open: boolean) => void
}

export function SubscriptionFormDialog({
  mode,
  subscription,
  isSubmitting,
  submissionError,
  onCreate,
  onUpdate,
  onOpenChange,
}: SubscriptionFormDialogProps) {
  const { t } = useTranslation()

  const schema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, t('validation:nameRequired'))
          .max(200, t('validation:nameMax', { count: 200 })),
        subscriptionType: z.enum(['MONTHLY', 'YEARLY']),
        status: z.enum(['ACTIVE', 'INACTIVE']),
        durationAmount: z
          .number()
          .int(t('validation:durationAmountInvalid'))
          .min(1, t('validation:durationAmountMin', { count: 1 })),
        currency: z
          .string()
          .trim()
          .min(1, t('validation:currencyRequired'))
          .max(10, t('validation:currencyMax', { count: 10 })),
        // Disimpan sebagai string terformat `en`; divalidasi via hasil parse.
        price: z
          .string()
          .min(1, t('validation:priceRequired'))
          .refine((v) => {
            const n = parsePriceInput(v)
            return Number.isFinite(n) && n >= 0
          }, t('validation:priceMin'))
          .refine((v) => /^\d+(\.\d{0,2})?$/.test(v.replace(/,/g, '')), t('validation:priceDecimals')),
      }),
    [t],
  )

  type SubscriptionFormValues = z.infer<typeof schema>

  const typeOptions = useMemo(
    () =>
      SUBSCRIPTION_TYPES.map((value) => ({
        value,
        label: t(`subscription:subscriptionTypeOptions.${value}`),
      })),
    [t],
  )

  const statusOptions = useMemo(
    () =>
      SUBSCRIPTION_STATUSES.map((value) => ({
        value,
        label: t(`subscription:statusOptions.${value}`),
      })),
    [t],
  )

  const defaultValues: SubscriptionFormValues =
    mode === 'edit' && subscription
      ? {
          name: subscription.name,
          subscriptionType: subscription.subscriptionType,
          status: subscription.status,
          durationAmount: fromDurationInDays(
            subscription.subscriptionType,
            subscription.durationInDays,
          ),
          currency: subscription.currency,
          price: formatPriceInput(subscription.price.toFixed(2)),
        }
      : {
          name: '',
          subscriptionType: 'MONTHLY',
          status: 'ACTIVE',
          durationAmount: 1,
          currency: SUBSCRIPTION_CURRENCIES[0],
          price: '',
        }

  const form = useForm<SubscriptionFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  const subscriptionTypeValue = useWatch({ control: form.control, name: 'subscriptionType' })
  const durationLabel =
    subscriptionTypeValue === 'YEARLY'
      ? t('subscription:form.durationAmountYears')
      : t('subscription:form.durationAmountMonths')

  // 422 -> tampil per-field via setError; tanpa toast, tanpa banner list.
  useEffect(() => {
    if (!isValidationError(submissionError)) return
    form.clearErrors()
    for (const [field, message] of Object.entries(mapApiFieldErrors(submissionError))) {
      // Backend mengirim `durationInDays`; field form bernama `durationAmount`.
      const name = field === 'durationInDays' ? 'durationAmount' : field
      form.setError(name as FieldPath<SubscriptionFormValues>, { type: 'server', message })
    }
  }, [submissionError, form])

  // Banner global hanya untuk error non-422.
  const globalMessage =
    submissionError instanceof ApiError && submissionError.statusCode !== 422
      ? submissionError.message
      : null

  function handleSubmit(values: SubscriptionFormValues) {
    const base: Omit<CreateSubscriptionInput, 'durationInDays'> = {
      name: values.name,
      slug: slugify(values.name),
      subscriptionType: values.subscriptionType,
      status: values.status,
      currency: values.currency,
      price: parsePriceInput(values.price),
    }
    const durationInDays = toDurationInDays(values.subscriptionType, values.durationAmount)
    if (mode !== 'edit') {
      onCreate({ ...base, durationInDays })
      return
    }
    // Edit tanpa ubah durasi: jangan kirim ulang durationInDays (nilai hari
    // non-kelipatan, mis. 45, akan terbulatkan lewat reverse amount → hari).
    const durationUnchanged =
      subscription !== null &&
      values.subscriptionType === subscription.subscriptionType &&
      values.durationAmount ===
        fromDurationInDays(subscription.subscriptionType, subscription.durationInDays)
    onUpdate(durationUnchanged ? base : { ...base, durationInDays })
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit' ? t('subscription:form.editTitle') : t('subscription:form.createTitle')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'edit'
              ? t('subscription:form.editDescription')
              : t('subscription:form.createDescription')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {globalMessage && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {globalMessage}
              </p>
            )}

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('subscription:form.name')}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={t('subscription:form.namePlaceholder')} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2">
              <FormField
                control={form.control}
                name="subscriptionType"
                render={({ field }) => (
                  <FormItem className="w-40 shrink-0">
                    <FormLabel>{t('subscription:form.subscriptionType')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {typeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="durationAmount"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>{durationLabel}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        step="1"
                        inputMode="numeric"
                        placeholder={t('subscription:form.durationAmountPlaceholder')}
                        name={field.name}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        value={Number.isNaN(field.value) ? '' : field.value}
                        onChange={(event) => field.onChange(event.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex gap-2">
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem className="w-28 shrink-0">
                    <FormLabel>{t('subscription:form.currency')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SUBSCRIPTION_CURRENCIES.map((code) => (
                          <SelectItem key={code} value={code}>
                            {code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>{t('subscription:form.price')}</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="decimal"
                        name={field.name}
                        ref={field.ref}
                        placeholder={t('subscription:form.pricePlaceholder')}
                        onBlur={field.onBlur}
                        value={field.value}
                        onChange={(event) => field.onChange(formatPriceInput(event.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('subscription:form.status')}</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="flex flex-wrap gap-4"
                    >
                      {statusOptions.map((option) => (
                        <FormItem key={option.value} className="flex items-center gap-2">
                          <FormControl>
                            <RadioGroupItem value={option.value} />
                          </FormControl>
                          <FormLabel className="font-normal">{option.label}</FormLabel>
                        </FormItem>
                      ))}
                    </RadioGroup>
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
              <Button type="submit" disabled={isSubmitting}>
                <Save data-icon="inline-start" className="size-4" />
                {isSubmitting
                  ? t('common:actions.saving')
                  : mode === 'edit'
                    ? t('common:actions.save')
                    : t('common:actions.create')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
