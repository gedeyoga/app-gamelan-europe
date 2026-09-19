import { zodResolver } from '@hookform/resolvers/zod'
import { Save, X } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useForm, type FieldPath } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import type { SessionUser } from '@/features/auth/types'
import { ApiError, isValidationError } from '@/lib/api-client'
import { mapApiFieldErrors } from '@/lib/field-errors'
import { cn } from '@/lib/utils'

export interface ProfileFormValues {
  fullName: string
  email: string
  changePassword: boolean
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export interface ProfileCardProps {
  user: SessionUser
  isLoading?: boolean
  isPending: boolean
  submissionError: Error | null
  onSubmit: (values: ProfileFormValues) => void
  /** Increment untuk trigger form reset dari container saat mutation sukses. */
  resetSignal?: number
  className?: string
}

/**
 * Single card profil — satu form gabungan (nama + email + password opsional).
 * Checkbox "Ganti password" mengontrol visibilitas field password.
 * Tidak melakukan fetch — data via props (AGENTS.md: komponen presentational).
 */
export function ProfileCard({
  user,
  isLoading = false,
  isPending,
  submissionError,
  onSubmit,
  resetSignal,
  className,
}: ProfileCardProps) {
  const { t } = useTranslation('profile')

  const schema = useMemo(
    () =>
      z
        .object({
          fullName: z
            .string()
            .trim()
            .min(1, t('validation:fullNameRequired'))
            .max(100, t('validation:fullNameMax', { count: 100 })),
          email: z
            .string()
            .trim()
            .min(1, t('validation:emailRequired'))
            .max(255, t('validation:emailMax', { count: 255 }))
            .email(t('validation:emailInvalid')),
          changePassword: z.boolean(),
          currentPassword: z.string().max(128, t('validation:passwordMax', { count: 128 })),
          newPassword: z
            .string()
            .trim()
            .max(128, t('validation:passwordMax', { count: 128 })),
          confirmPassword: z.string().max(128, t('validation:passwordMax', { count: 128 })),
        })
        .superRefine((data, ctx) => {
          if (!data.changePassword) return
          if (!data.currentPassword || data.currentPassword.length < 1) {
            ctx.addIssue({
              code: 'custom',
              path: ['currentPassword'],
              message: t('validation:currentPasswordRequired'),
            })
          }
          if (!data.newPassword || data.newPassword.length < 8) {
            ctx.addIssue({
              code: 'custom',
              path: ['newPassword'],
              message: t('validation:passwordMin', { count: 8 }),
            })
          }
          if (data.newPassword && data.newPassword !== data.confirmPassword) {
            ctx.addIssue({
              code: 'custom',
              path: ['confirmPassword'],
              message: t('validation:passwordMismatch'),
            })
          }
        }),
    [t],
  )

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: user.fullName,
      email: user.email,
      changePassword: false,
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    mode: 'onSubmit',
  })

  // Sync fullName/email saat data user berganti.
  useEffect(() => {
    form.reset({
      fullName: user.fullName,
      email: user.email,
      changePassword: false,
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    })
    // form.reset stabil dari RHF; deps hanya sumber data user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.fullName, user.email])

  // Reset form ketika container memicu resetSignal (setelah mutation sukses).
  useEffect(() => {
    if (resetSignal === undefined) return
    form.reset({
      fullName: user.fullName,
      email: user.email,
      changePassword: false,
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    })
    // Intentional: hanya fire saat resetSignal berubah, BUKAN saat mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal])

  // 422 → per-field via setError; tanpa toast/banner.
  useEffect(() => {
    if (!isValidationError(submissionError)) return
    form.clearErrors()
    for (const [field, message] of Object.entries(mapApiFieldErrors(submissionError))) {
      form.setError(field as FieldPath<ProfileFormValues>, { type: 'server', message })
    }
  }, [submissionError, form])

  // Banner global hanya untuk error non-422.
  const globalMessage =
    submissionError instanceof ApiError && submissionError.statusCode !== 422
      ? submissionError.message
      : null

  function handleSubmit(values: ProfileFormValues) {
    onSubmit({
      fullName: values.fullName.trim(),
      email: values.email.trim(),
      changePassword: values.changePassword,
      currentPassword: values.currentPassword ?? '',
      newPassword: values.newPassword ?? '',
      confirmPassword: values.confirmPassword ?? '',
    })
  }

  function handleCancel() {
    form.reset({
      fullName: user.fullName,
      email: user.email,
      changePassword: false,
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    })
  }

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>{t('card.title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <ProfileCardSkeleton />
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              {globalMessage && (
                <p
                  role="alert"
                  className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {globalMessage}
                </p>
              )}

              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('card.fullName')}</FormLabel>
                    <FormControl>
                      <Input {...field} autoComplete="name" disabled={isPending} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('card.email')}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        {...field}
                        disabled={isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="changePassword"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isPending}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>{t('changePassword.checkboxLabel')}</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        {t('changePassword.checkboxHint')}
                      </p>
                    </div>
                  </FormItem>
                )}
              />

              {form.watch('changePassword') && (
                <>
                  <FormField
                    control={form.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('changePassword.currentPassword')}</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            autoComplete="current-password"
                            {...field}
                            value={field.value ?? ''}
                            disabled={isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('changePassword.newPassword')}</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            autoComplete="new-password"
                            {...field}
                            value={field.value ?? ''}
                            disabled={isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('changePassword.confirmPassword')}</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            autoComplete="new-password"
                            {...field}
                            value={field.value ?? ''}
                            disabled={isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCancel} disabled={isPending}>
                  <X data-icon="inline-start" className="size-4" />
                  {t('editProfile.cancel')}
                </Button>
                <Button type="submit" disabled={isPending}>
                  <Save data-icon="inline-start" className="size-4" />
                  {isPending ? t('common:actions.saving') : t('editProfile.save')}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  )
}

function ProfileCardSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-12 w-full" />
      <div className="flex justify-end gap-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  )
}