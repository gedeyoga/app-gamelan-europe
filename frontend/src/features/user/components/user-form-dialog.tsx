import { zodResolver } from '@hookform/resolvers/zod'
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
import { mapApiFieldErrors } from '@/lib/field-errors'
import { ApiError, isValidationError } from '@/lib/api-client'

import type { CreateUserInput, RoleOption, UpdateUserInput, User, UserStatus } from '../types'

const STATUS_VALUES: UserStatus[] = ['ACTIVE', 'INACTIVE', 'BLOCKED']

export type UserFormMode = 'create' | 'edit'

export interface UserFormDialogProps {
  mode: UserFormMode
  user: User | null
  roles: RoleOption[]
  isSubmitting: boolean
  submissionError: Error | null
  /**
   * `false` bila sesi tak punya `user:update` — select role di-disable,
   * nilai role diabaikan container (tidak memanggil assign), dan hint ditampilkan.
   * Default `true`.
   */
  canAssignRole?: boolean
  onCreate: (payload: CreateUserInput, roleId: string) => void
  onUpdate: (payload: UpdateUserInput, roleId: string) => void
  onOpenChange: (open: boolean) => void
}

export function UserFormDialog({
  mode,
  user,
  roles,
  isSubmitting,
  submissionError,
  canAssignRole = true,
  onCreate,
  onUpdate,
  onOpenChange,
}: UserFormDialogProps) {
  const { t } = useTranslation()

  const { createSchema, updateSchema } = useMemo(
    () => ({
      createSchema: z.object({
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
        status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']),
        roleId: z
          .union([z.string().trim().uuid(t('validation:roleInvalid')), z.literal('')])
          .optional(),
      }),
      updateSchema: z.object({
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
          .max(128, t('validation:passwordMax', { count: 128 }))
          .refine((value) => value === '' || value.length >= 8, {
            message: t('validation:passwordMin', { count: 8 }),
          }),
        status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']),
        roleId: z
          .union([z.string().trim().uuid(t('validation:roleInvalid')), z.literal('')])
          .optional(),
      }),
    }),
    [t],
  )

  type CreateUserFormValues = z.infer<typeof createSchema>
  type UpdateUserFormValues = z.infer<typeof updateSchema>
  // Kedua schema berbagi shape (password beda required vs boleh kosong);
  // satu tipe gabungan agar aman dipakai per-mode create/edit.
  type UserFormValues = CreateUserFormValues & UpdateUserFormValues

  const schema = mode === 'edit' ? updateSchema : createSchema

  const statusOptions = useMemo(
    () =>
      STATUS_VALUES.map((value) => ({
        value,
        label: t(`user:statusOptions.${value}`),
      })),
    [t],
  )

  const defaultValues: UserFormValues =
    mode === 'edit' && user
      ? {
          fullName: user.fullName,
          email: user.email,
          password: '',
          status: user.status,
          roleId: user.roleId ?? '',
        }
      : { fullName: '', email: '', password: '', status: 'ACTIVE', roleId: '' }

  const form = useForm<UserFormValues>({ resolver: zodResolver(schema), defaultValues })

  // 422 -> tampil per-field via setError; tanpa toast, tanpa banner list.
  useEffect(() => {
    if (!isValidationError(submissionError)) return
    form.clearErrors()
    for (const [field, message] of Object.entries(mapApiFieldErrors(submissionError))) {
      form.setError(field as FieldPath<UserFormValues>, { type: 'server', message })
    }
  }, [submissionError, form])

  // Banner global hanya untuk error non-422.
  const globalMessage =
    submissionError instanceof ApiError && submissionError.statusCode !== 422
      ? submissionError.message
      : null

  function handleSubmit(values: UserFormValues) {
    if (mode === 'edit') {
      const payload: UpdateUserInput = {
        fullName: values.fullName,
        email: values.email,
        status: values.status,
        ...(values.password ? { password: values.password } : {}),
      }
      onUpdate(payload, values.roleId ?? '')
      return
    }
    onCreate(
      {
        fullName: values.fullName,
        email: values.email,
        password: values.password,
        status: values.status,
      },
      values.roleId ?? '',
    )
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? t('user:form.editTitle') : t('user:form.createTitle')}</DialogTitle>
          <DialogDescription>
            {mode === 'edit' ? t('user:form.editDescription') : t('user:form.createDescription')}
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
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('user:form.fullName')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                  <FormLabel>{t('user:form.email')}</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
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
                  <FormLabel>{t('user:form.password')}</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder={mode === 'edit' ? t('user:form.passwordEditPlaceholder') : undefined}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="roleId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('user:form.role')}</FormLabel>
                  <Select
                    value={field.value || 'none'}
                    onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                    disabled={!canAssignRole}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('user:form.selectRole')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">{t('user:form.noRole')}</SelectItem>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!canAssignRole && (
                    <p className="text-xs text-muted-foreground">
                      {t('user:form.roleNoPermission')}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('user:form.status')}</FormLabel>
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

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSubmitting}>
                  {t('common:actions.cancel')}
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
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
