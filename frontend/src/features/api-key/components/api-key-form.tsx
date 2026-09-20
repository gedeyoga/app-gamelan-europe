import { zodResolver } from '@hookform/resolvers/zod'
import { Save, X } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useForm, type FieldPath } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

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
import type { Permission } from '@/features/permission/types'
import { ApiError, isValidationError } from '@/lib/api-client'
import { mapApiFieldErrors } from '@/lib/field-errors'

import { createApiKeyFormSchema, type ApiKeyFormValues } from '../lib/schema'
import type { ApiKey, CreateApiKeyInput, UpdateApiKeyInput } from '../types'
import { PermissionMultiSelect } from './permission-multiselect'

export type ApiKeyFormMode = 'create' | 'edit'

export interface ApiKeyFormDialogProps {
  open: boolean
  mode: ApiKeyFormMode
  apiKey: ApiKey | null
  initialPermissionCodes: string[]
  permissions: Permission[]
  isPending: boolean
  isPermissionPending: boolean
  permissionError?: string | null
  submissionError?: Error | null
  onSubmit: (payload: CreateApiKeyInput | UpdateApiKeyInput) => void
  onOpenChange: (open: boolean) => void
}

export function ApiKeyFormDialog({
  open,
  mode,
  apiKey,
  initialPermissionCodes,
  permissions,
  isPending,
  isPermissionPending,
  permissionError,
  submissionError,
  onSubmit,
  onOpenChange,
}: ApiKeyFormDialogProps) {
  const { t } = useTranslation()
  const schema = useMemo(() => createApiKeyFormSchema(t), [t])

  const defaultValues: ApiKeyFormValues = useMemo(
    () => ({
      name: mode === 'edit' && apiKey ? apiKey.name : '',
      permissionCodes: initialPermissionCodes,
    }),
    [mode, apiKey, initialPermissionCodes],
  )

  const form = useForm<ApiKeyFormValues>({ resolver: zodResolver(schema), defaultValues })

  // 422 -> tampil per-field via setError; tanpa toast, tanpa banner.
  useEffect(() => {
    if (!isValidationError(submissionError)) return
    form.clearErrors()
    for (const [field, message] of Object.entries(mapApiFieldErrors(submissionError))) {
      form.setError(field as FieldPath<ApiKeyFormValues>, { type: 'server', message })
    }
  }, [submissionError, form])

  const globalMessage =
    submissionError instanceof ApiError && submissionError.statusCode !== 422
      ? submissionError.message
      : null

  function handleSubmit(values: ApiKeyFormValues) {
    onSubmit({ name: values.name, permissionCodes: values.permissionCodes })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit' ? t('api-key:form.editTitle') : t('api-key:form.createTitle')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'edit'
              ? t('api-key:form.editDescription')
              : t('api-key:form.createDescription')}
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
                  <FormLabel>{t('api-key:form.name')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="permissionCodes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    {t('api-key:form.permissions')}
                  </FormLabel>
                  <p className="text-xs text-muted-foreground">{t('api-key:form.permissionsHint')}</p>
                  <PermissionMultiSelect
                    value={field.value}
                    onChange={field.onChange}
                    permissions={permissions}
                    isPending={isPermissionPending}
                    error={permissionError}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isPending}>
                  <X data-icon="inline-start" className="size-4" />
                  {t('common:actions.cancel')}
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                <Save data-icon="inline-start" className="size-4" />
                {isPending
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
