import { zodResolver } from '@hookform/resolvers/zod'
import { Save, X } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useForm, type FieldPath } from 'react-hook-form'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ApiError, isValidationError } from '@/lib/api-client'
import { mapApiFieldErrors } from '@/lib/field-errors'

import { SUBSCRIPTION_TYPES, type CreateSubscriptionInput, type Subscription, type UpdateSubscriptionInput } from '../types'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

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
        slug: z
          .string()
          .trim()
          .min(1, t('validation:slugRequired'))
          .max(200, t('validation:slugMax', { count: 200 }))
          .regex(SLUG_PATTERN, t('validation:slugPattern')),
        subscriptionType: z.enum(['MONTHLY', 'YEARLY']),
        currency: z
          .string()
          .trim()
          .min(1, t('validation:currencyRequired'))
          .max(10, t('validation:currencyMax', { count: 10 })),
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

  const defaultValues: SubscriptionFormValues =
    mode === 'edit' && subscription
      ? {
          name: subscription.name,
          slug: subscription.slug,
          subscriptionType: subscription.subscriptionType,
          currency: subscription.currency,
        }
      : { name: '', slug: '', subscriptionType: 'MONTHLY', currency: '' }

  const form = useForm<SubscriptionFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  // 422 -> tampil per-field via setError; tanpa toast, tanpa banner list.
  useEffect(() => {
    if (!isValidationError(submissionError)) return
    form.clearErrors()
    for (const [field, message] of Object.entries(mapApiFieldErrors(submissionError))) {
      form.setError(field as FieldPath<SubscriptionFormValues>, { type: 'server', message })
    }
  }, [submissionError, form])

  // Banner global hanya untuk error non-422.
  const globalMessage =
    submissionError instanceof ApiError && submissionError.statusCode !== 422
      ? submissionError.message
      : null

  function handleSubmit(values: SubscriptionFormValues) {
    if (mode === 'edit') onUpdate(values)
    else onCreate(values)
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
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('subscription:form.slug')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subscriptionType"
              render={({ field }) => (
                <FormItem>
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
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('subscription:form.currency')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
