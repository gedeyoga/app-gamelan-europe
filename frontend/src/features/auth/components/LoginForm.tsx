import { zodResolver } from '@hookform/resolvers/zod'
import { LogIn } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useForm, type FieldPath } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
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
import { ApiError } from '@/lib/api-client'
import { mapApiFieldErrors } from '@/lib/field-errors'
import { getApiErrorMessage, isValidationError, toastError, toastSuccess } from '@/lib/toast'

import { useLogin } from '../hooks/useLogin'

export function LoginForm() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const login = useLogin()

  const loginSchema = useMemo(
    () =>
      z.object({
        email: z
          .string()
          .trim()
          .min(1, t('validation:emailRequired'))
          .max(255, t('validation:emailMax', { count: 255 }))
          .email(t('validation:emailInvalid')),
        // Password login sengaja min(1) tanpa trim/max: hindari membocorkan policy
        // password (min/max) lewat pesan validasi client; policy penuh tetap di backend/register.
        password: z.string().min(1, t('validation:passwordRequired')),
      }),
    [t],
  )

  type LoginFormValues = z.infer<typeof loginSchema>

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const error = login.error

  // 422 -> tampil per-field via setError; tanpa toast.
  useEffect(() => {
    if (!isValidationError(error)) return
    form.clearErrors()
    for (const [field, message] of Object.entries(mapApiFieldErrors(error))) {
      form.setError(field as FieldPath<LoginFormValues>, { type: 'server', message })
    }
  }, [error, form])

  // Banner hanya untuk 401 (kredensial salah); 422 tampil per-field.
  const globalMessage =
    error instanceof ApiError && error.statusCode === 401
      ? error.message || t('auth:login.invalidCredentialsFallback')
      : null

  function onSubmit(values: LoginFormValues) {
    login.mutate(values, {
      onSuccess: () => {
        toastSuccess(t('auth:toast.loggedIn'))
        navigate('/', { replace: true })
      },
      onError: (err: unknown) => {
        if (isValidationError(err)) return // 422 → per-field via useEffect
        toastError(getApiErrorMessage(err, t('auth:toast.loginFailed')))
      },
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
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth:login.email')}</FormLabel>
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
              <FormLabel>{t('auth:login.password')}</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={login.isPending}>
          <LogIn data-icon="inline-start" className="size-4" />
          {login.isPending ? t('common:actions.loading') : t('auth:login.submit')}
        </Button>
      </form>
    </Form>
  )
}
