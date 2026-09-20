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
import { ApiError, isValidationError } from '@/lib/api-client'
import { mapApiFieldErrors } from '@/lib/field-errors'

import type { CreateOrganizationInput, Organization, UpdateOrganizationInput } from '../types'

export type OrganizationFormMode = 'create' | 'edit'

export interface OrganizationFormDialogProps {
  mode: OrganizationFormMode
  organization: Organization | null
  isSubmitting: boolean
  submissionError: Error | null
  onCreate: (payload: CreateOrganizationInput) => void
  onUpdate: (payload: UpdateOrganizationInput) => void
  onOpenChange: (open: boolean) => void
}

// Angka opsional disimpan sebagai string di form; divalidasi rentang saat submit.
function emptyOrInRange(min: number, max: number) {
  return (value: string) => {
    if (value.trim() === '') return true
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed >= min && parsed <= max
  }
}

export function OrganizationFormDialog({
  mode,
  organization,
  isSubmitting,
  submissionError,
  onCreate,
  onUpdate,
  onOpenChange,
}: OrganizationFormDialogProps) {
  const { t } = useTranslation()

  const schema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, t('validation:nameRequired'))
          .max(200, t('validation:nameMax', { count: 200 })),
        city: z.string().trim().max(100, t('validation:nameMax', { count: 100 })),
        country: z.string().trim().max(100, t('validation:nameMax', { count: 100 })),
        address: z.string().trim().max(500, t('validation:addressMax', { count: 500 })),
        lat: z.string().trim().refine(emptyOrInRange(-90, 90), t('validation:latInvalid')),
        lng: z.string().trim().refine(emptyOrInRange(-180, 180), t('validation:lngInvalid')),
      }),
    [t],
  )

  type OrganizationFormValues = z.infer<typeof schema>

  const defaultValues: OrganizationFormValues =
    mode === 'edit' && organization
      ? {
          name: organization.name,
          city: organization.city ?? '',
          country: organization.country ?? '',
          address: organization.address ?? '',
          lat: organization.lat === null ? '' : String(organization.lat),
          lng: organization.lng === null ? '' : String(organization.lng),
        }
      : { name: '', city: '', country: '', address: '', lat: '', lng: '' }

  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  // 422 -> tampil per-field via setError; tanpa toast, tanpa banner list.
  useEffect(() => {
    if (!isValidationError(submissionError)) return
    form.clearErrors()
    for (const [field, message] of Object.entries(mapApiFieldErrors(submissionError))) {
      form.setError(field as FieldPath<OrganizationFormValues>, { type: 'server', message })
    }
  }, [submissionError, form])

  // Banner global hanya untuk error non-422.
  const globalMessage =
    submissionError instanceof ApiError && submissionError.statusCode !== 422
      ? submissionError.message
      : null

  function buildPayload(values: OrganizationFormValues): CreateOrganizationInput {
    // Field opsional dikirim `null` eksplisit saat kosong (backend map null → clear), bukan di-omit.
    return {
      name: values.name,
      city: values.city ? values.city : null,
      country: values.country ? values.country : null,
      address: values.address ? values.address : null,
      lat: values.lat.trim() ? Number(values.lat) : null,
      lng: values.lng.trim() ? Number(values.lng) : null,
    }
  }

  function handleSubmit(values: OrganizationFormValues) {
    const payload = buildPayload(values)
    if (mode === 'edit') onUpdate(payload)
    else onCreate(payload)
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit' ? t('organization:form.editTitle') : t('organization:form.createTitle')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'edit'
              ? t('organization:form.editDescription')
              : t('organization:form.createDescription')}
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
                  <FormLabel>{t('organization:form.name')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('organization:form.city')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('organization:form.country')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('organization:form.address')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="lat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('organization:form.lat')}</FormLabel>
                    <FormControl>
                      <Input type="number" step="any" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lng"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('organization:form.lng')}</FormLabel>
                    <FormControl>
                      <Input type="number" step="any" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
