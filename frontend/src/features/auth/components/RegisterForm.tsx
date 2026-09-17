import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import { useForm, type FieldPath } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
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

import { useRegister } from '../hooks/useRegister'
import { mapApiFieldErrors } from '@/lib/field-errors'

export function RegisterForm() {
  const { t } = useTranslation()
  const register = useRegister()

  const registerSchema = useMemo(
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
          password: z
            .string()
            .min(8, t('validation:passwordMin', { count: 8 }))
            .max(128, t('validation:passwordMax', { count: 128 })),
          confirmPassword: z.string(),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: t('validation:passwordMismatch'),
          path: ['confirmPassword'],
        }),
    [t],
  )

  type RegisterFormValues = z.infer<typeof registerSchema>

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  })

  const error = register.error

  // 422 -> tampil per-field via setError; tanpa toast.
  useEffect(() => {
    if (!isValidationError(error)) return
    form.clearErrors()
    for (const [field, message] of Object.entries(mapApiFieldErrors(error))) {
      form.setError(field as FieldPath<RegisterFormValues>, { type: 'server', message })
    }
  }, [error, form])

  // Banner hanya untuk 409 (email sudah terdaftar); 422 tampil per-field.
  const globalMessage =
    error instanceof ApiError && error.statusCode === 409 ? error.message : null

  function onSubmit(values: RegisterFormValues) {
    register.mutate({
      fullName: values.fullName,
      email: values.email,
      password: values.password,
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {globalMessage && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {globalMessage}
          </p>
        )}

        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth:register.fullName')}</FormLabel>
              <FormControl>
                <Input autoComplete="name" {...field} />
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
              <FormLabel>{t('auth:register.email')}</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth:register.password')}</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
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
              <FormLabel>{t('auth:register.confirmPassword')}</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={register.isPending}>
          {register.isPending ? t('common:actions.loading') : t('auth:register.submit')}
        </Button>
      </form>
    </Form>
  )
}
