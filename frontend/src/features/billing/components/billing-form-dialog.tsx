import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Save, Trash2, X } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useFieldArray, useForm, type FieldPath } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { DateTimePicker } from '@/components/shared/date-time-picker'
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

import {
  BILLING_LINE_TYPES,
  BILLING_STATUSES,
  BILLING_SUBSCRIPTION_TYPES,
  type Billing,
  type BillingOrganization,
  type BillingSubscription,
  type BillingUser,
  type CreateBillingInput,
  type UpdateBillingInput,
} from '../types'

export type BillingFormMode = 'create' | 'edit'

export interface BillingFormDialogProps {
  mode: BillingFormMode
  billing: Billing | null
  users: BillingUser[]
  organizations: BillingOrganization[]
  subscriptions: BillingSubscription[]
  /** `false` = sesi tanpa permission baca terkait → select di-disable + placeholder "—". */
  canSelectUser?: boolean
  canSelectOrganization?: boolean
  canSelectSubscription?: boolean
  isSubmitting: boolean
  submissionError: Error | null
  onCreate: (payload: CreateBillingInput) => void
  onUpdate: (payload: UpdateBillingInput) => void
  onOpenChange: (open: boolean) => void
}

function isNumeric(value: string) {
  if (value.trim() === '') return false
  return Number.isFinite(Number(value))
}

export function BillingFormDialog({
  mode,
  billing,
  users,
  organizations,
  subscriptions,
  canSelectUser = true,
  canSelectOrganization = true,
  canSelectSubscription = true,
  isSubmitting,
  submissionError,
  onCreate,
  onUpdate,
  onOpenChange,
}: BillingFormDialogProps) {
  const { t } = useTranslation()

  const schema = useMemo(
    () =>
      z.object({
        code: z
          .string()
          .trim()
          .min(1, t('validation:codeRequired'))
          .max(100, t('validation:codeMax', { count: 100 })),
        userId: z
          .string()
          .trim()
          .min(1, t('validation:userInvalid'))
          .uuid(t('validation:userInvalid')),
        organizationId: z.string(),
        subscriptionId: z
          .string()
          .trim()
          .min(1, t('validation:subscriptionInvalid'))
          .uuid(t('validation:subscriptionInvalid')),
        status: z.enum(['PENDING', 'PAID', 'CANCELED']),
        subscriptionType: z.enum(['MONTHLY', 'YEARLY']),
        currency: z
          .string()
          .trim()
          .min(1, t('validation:currencyRequired'))
          .max(10, t('validation:currencyMax', { count: 10 })),
        total: z
          .string()
          .trim()
          .min(1, t('validation:totalRequired'))
          .refine(isNumeric, t('validation:totalInvalid')),
        discount: z.string().trim().refine((v) => v === '' || isNumeric(v), t('validation:discountInvalid')),
        tax: z.string().trim().refine((v) => v === '' || isNumeric(v), t('validation:taxInvalid')),
        paidAt: z.string().optional(),
        canceledAt: z.string().optional(),
        lines: z.array(
          z.object({
            description: z
              .string()
              .trim()
              .min(1, t('validation:lineDescriptionRequired'))
              .max(500, t('validation:lineDescriptionMax', { count: 500 })),
            type: z.enum(['ITEM', 'DISCOUNT', 'TAX']),
            qty: z.string().trim().refine((v) => v === '' || isNumeric(v), t('validation:qtyInvalid')),
            amount: z
              .string()
              .trim()
              .min(1, t('validation:amountRequired'))
              .refine(isNumeric, t('validation:amountInvalid')),
            currency: z
              .string()
              .trim()
              .min(1, t('validation:currencyRequired'))
              .max(10, t('validation:currencyMax', { count: 10 })),
          }),
        ),
      }),
    [t],
  )

  type BillingFormValues = z.infer<typeof schema>
  type BillingLineField = keyof BillingFormValues['lines'][number]

  // Menjaga `field.value` tetap sesuai tipe field array (bukan widening FieldPath union).
  function lineFieldName<F extends BillingLineField>(
    index: number,
    field: F,
  ): `lines.${number}.${F}` {
    return `lines.${index}.${field}` as `lines.${number}.${F}`
  }

  const statusOptions = useMemo(
    () => BILLING_STATUSES.map((value) => ({ value, label: t(`billing:statusOptions.${value}`) })),
    [t],
  )
  const subscriptionTypeOptions = useMemo(
    () =>
      BILLING_SUBSCRIPTION_TYPES.map((value) => ({
        value,
        label: t(`billing:subscriptionTypeOptions.${value}`),
      })),
    [t],
  )
  const lineTypeOptions = useMemo(
    () =>
      BILLING_LINE_TYPES.map((value) => ({
        value,
        label: t(`billing:lineTypeOptions.${value}`),
      })),
    [t],
  )

  const defaultValues: BillingFormValues =
    mode === 'edit' && billing
      ? {
          code: billing.code,
          userId: billing.userId,
          organizationId: billing.organizationId ?? '',
          subscriptionId: billing.subscriptionId,
          status: billing.status,
          subscriptionType: billing.subscriptionType,
          currency: billing.currency,
          total: String(billing.total),
          discount: billing.discount === null ? '' : String(billing.discount),
          tax: billing.tax === null ? '' : String(billing.tax),
          paidAt: billing.paidAt ?? undefined,
          canceledAt: billing.canceledAt ?? undefined,
          lines: billing.lines.map((line) => ({
            description: line.description,
            type: line.type,
            qty: String(line.qty),
            amount: String(line.amount),
            currency: line.currency,
          })),
        }
      : {
          code: '',
          userId: '',
          organizationId: '',
          subscriptionId: '',
          status: 'PENDING',
          subscriptionType: 'MONTHLY',
          currency: '',
          total: '',
          discount: '',
          tax: '',
          paidAt: undefined,
          canceledAt: undefined,
          lines: [{ description: '', type: 'ITEM', qty: '1', amount: '', currency: '' }],
        }

  const form = useForm<BillingFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' })

  // 422 -> tampil per-field via setError; tanpa toast, tanpa banner list.
  useEffect(() => {
    if (!isValidationError(submissionError)) return
    form.clearErrors()
    for (const [field, message] of Object.entries(mapApiFieldErrors(submissionError))) {
      form.setError(field as FieldPath<BillingFormValues>, { type: 'server', message })
    }
  }, [submissionError, form])

  // Banner global hanya untuk error non-422.
  const globalMessage =
    submissionError instanceof ApiError && submissionError.statusCode !== 422
      ? submissionError.message
      : null

  function buildPayload(values: BillingFormValues): CreateBillingInput {
    return {
      userId: values.userId,
      // null = disconnect organization (backend map null → disconnect).
      organizationId: values.organizationId || null,
      subscriptionId: values.subscriptionId,
      code: values.code,
      status: values.status,
      subscriptionType: values.subscriptionType,
      currency: values.currency,
      total: Number(values.total),
      // null eksplisit = clear; undefined (di-omit) = biarkan.
      discount: values.discount.trim() ? Number(values.discount) : null,
      tax: values.tax.trim() ? Number(values.tax) : null,
      paidAt: values.paidAt ?? null,
      canceledAt: values.canceledAt ?? null,
      lines: values.lines.map((line) => ({
        description: line.description,
        type: line.type,
        // qty di-omit hanya bila tak diisi; jangan kirim NaN.
        ...(line.qty.trim() ? { qty: Number(line.qty) } : {}),
        amount: Number(line.amount),
        currency: line.currency,
      })),
    }
  }

  function handleSubmit(values: BillingFormValues) {
    const payload = buildPayload(values)
    if (mode === 'edit') onUpdate(payload)
    else onCreate(payload)
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit' ? t('billing:form.editTitle') : t('billing:form.createTitle')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'edit'
              ? t('billing:form.editDescription')
              : t('billing:form.createDescription')}
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
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('billing:form.code')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('billing:form.user')}</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={!canSelectUser}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={canSelectUser ? t('billing:form.selectUser') : '—'}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.fullName} ({user.email})
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
              name="organizationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('billing:form.organization')}</FormLabel>
                  <Select
                    value={field.value || 'none'}
                    onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                    disabled={!canSelectOrganization}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={canSelectOrganization ? t('billing:form.selectOrganization') : '—'}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">{t('billing:form.noOrganization')}</SelectItem>
                      {organizations.map((organization) => (
                        <SelectItem key={organization.id} value={organization.id}>
                          {organization.name}
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
              name="subscriptionId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('billing:form.subscription')}</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={!canSelectSubscription}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={canSelectSubscription ? t('billing:form.selectSubscription') : '—'}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {subscriptions.map((subscription) => (
                        <SelectItem key={subscription.id} value={subscription.id}>
                          {subscription.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('billing:form.status')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {statusOptions.map((option) => (
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
                name="subscriptionType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('billing:form.subscriptionType')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {subscriptionTypeOptions.map((option) => (
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('billing:form.currency')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="total"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('billing:form.total')}</FormLabel>
                    <FormControl>
                      <Input type="number" step="any" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="discount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('billing:form.discount')}</FormLabel>
                    <FormControl>
                      <Input type="number" step="any" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tax"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('billing:form.tax')}</FormLabel>
                    <FormControl>
                      <Input type="number" step="any" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="paidAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('billing:form.paidAt')}</FormLabel>
                    <FormControl>
                      <DateTimePicker
                        value={field.value}
                        onChange={field.onChange}
                        placeholder={t('billing:form.datePlaceholder')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="canceledAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('billing:form.canceledAt')}</FormLabel>
                    <FormControl>
                      <DateTimePicker
                        value={field.value}
                        onChange={field.onChange}
                        placeholder={t('billing:form.datePlaceholder')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col gap-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t('billing:form.lines')}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({
                      description: '',
                      type: 'ITEM',
                      qty: '1',
                      amount: '',
                      currency: '',
                    })
                  }
                >
                  <Plus className="size-4" data-icon="inline-start" />
                  {t('billing:form.addLine')}
                </Button>
              </div>

              {fields.length === 0 && (
                <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                  {t('billing:form.linesEmpty')}
                </p>
              )}

              {fields.map((item, index) => (
                <div key={item.id} className="flex flex-col gap-3 rounded-lg border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t('billing:form.lineLabel', { number: index + 1 })}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t('billing:form.removeLine')}
                      title={t('billing:form.removeLine')}
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>

                  <FormField
                    control={form.control}
                    name={lineFieldName(index, 'description')}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('billing:form.description')}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name={lineFieldName(index, 'type')}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('billing:form.lineType')}</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {lineTypeOptions.map((option) => (
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
                      name={lineFieldName(index, 'currency')}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('billing:form.lineCurrency')}</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name={lineFieldName(index, 'qty')}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('billing:form.qty')}</FormLabel>
                          <FormControl>
                            <Input type="number" step="any" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={lineFieldName(index, 'amount')}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('billing:form.amount')}</FormLabel>
                          <FormControl>
                            <Input type="number" step="any" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>

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
