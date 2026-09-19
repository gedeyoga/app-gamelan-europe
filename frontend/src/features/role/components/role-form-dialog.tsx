import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Save, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm, type FieldPath } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import type { Permission } from '@/features/permission/types'
import { ApiError, isValidationError } from '@/lib/api-client'
import { mapApiFieldErrors } from '@/lib/field-errors'

import type { CreateRoleInput, Role, UpdateRoleInput } from '../types'

export type RoleFormMode = 'create' | 'edit'

export interface RoleFormDialogProps {
  open: boolean
  mode: RoleFormMode
  role: Role | null
  permissions: Permission[]
  initialPermissionIds: string[]
  isPending: boolean
  isPermissionPending: boolean
  permissionError?: string | null
  submissionError?: Error | null
  /**
   * `false` bila sesi tak punya `permission:update` — checkbox + pilih/hapus
   * semua di-disable, pilihan diabaikan container (tidak memanggil PUT),
   * dan hint ditampilkan. Default `true`.
   */
  canEditPermissions?: boolean
  onSubmit: (payload: CreateRoleInput | UpdateRoleInput, permissionIds: string[]) => void
  onOpenChange: (open: boolean) => void
}

export function RoleFormDialog({
  open,
  mode,
  role,
  permissions,
  initialPermissionIds,
  isPending,
  isPermissionPending,
  permissionError,
  submissionError,
  canEditPermissions = true,
  onSubmit,
  onOpenChange,
}: RoleFormDialogProps) {
  const { t } = useTranslation()

  const schema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, t('validation:nameRequired'))
          .max(50, t('validation:nameMax', { count: 50 })),
        description: z
          .string()
          .trim()
          .max(255, t('validation:descriptionMax', { count: 255 })),
        permissionIds: z.array(z.string().uuid()).optional(),
      }),
    [t],
  )

  type RoleFormValues = z.infer<typeof schema>

  const defaultValues: RoleFormValues =
    mode === 'edit' && role
      ? {
          name: role.name,
          description: role.description ?? '',
          permissionIds: initialPermissionIds,
        }
      : { name: '', description: '', permissionIds: initialPermissionIds }

  const form = useForm<RoleFormValues>({ resolver: zodResolver(schema), defaultValues })

  const [search, setSearch] = useState('')

  // 422 -> tampil per-field via setError; tanpa toast, tanpa banner list.
  useEffect(() => {
    if (!isValidationError(submissionError)) return
    form.clearErrors()
    for (const [field, message] of Object.entries(mapApiFieldErrors(submissionError))) {
      form.setError(field as FieldPath<RoleFormValues>, { type: 'server', message })
    }
  }, [submissionError, form])

  // Banner global hanya untuk error non-422.
  const globalMessage =
    submissionError instanceof ApiError && submissionError.statusCode !== 422
      ? submissionError.message
      : null

  const query = search.trim().toLowerCase()
  const filteredPermissions = permissions.filter(
    (permission) =>
      permission.code.toLowerCase().includes(query) ||
      permission.description?.toLowerCase().includes(query),
  )

  function handleSubmit(values: RoleFormValues) {
    onSubmit({ name: values.name, description: values.description }, values.permissionIds ?? [])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? t('role:form.editTitle') : t('role:form.createTitle')}</DialogTitle>
          <DialogDescription>
            {mode === 'edit' ? t('role:form.editDescription') : t('role:form.createDescription')}
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
                  <FormLabel>{t('role:form.name')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {mode === 'edit' && (
              <div className="space-y-1.5">
                <Label>{t('role:form.code')}</Label>
                <div className="text-sm text-muted-foreground">
                  {role?.code ?? '-'}
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('role:form.description')}</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="permissionIds"
              render={({ field }) => {
                const selectedIds = field.value ?? []

                function togglePermission(id: string) {
                  field.onChange(
                    selectedIds.includes(id)
                      ? selectedIds.filter((pid) => pid !== id)
                      : [...selectedIds, id],
                  )
                }

                function checkAllFiltered() {
                  const ids = filteredPermissions.map((permission) => permission.id)
                  field.onChange(Array.from(new Set([...selectedIds, ...ids])))
                }

                function uncheckAllFiltered() {
                  const ids = new Set(filteredPermissions.map((permission) => permission.id))
                  field.onChange(selectedIds.filter((id) => !ids.has(id)))
                }

                return (
                  <FormItem>
                    <div className="flex items-center justify-between gap-2">
                      <FormLabel className="text-sm font-medium">
                        {t('role:form.permissions')}
                      </FormLabel>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={checkAllFiltered}
                          disabled={filteredPermissions.length === 0 || !canEditPermissions}
                        >
                          <Plus data-icon="inline-start" className="size-4" />
                          {t('role:form.selectAll')}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={uncheckAllFiltered}
                          disabled={filteredPermissions.length === 0 || !canEditPermissions}
                        >
                          <Trash2 data-icon="inline-start" className="size-4" />
                          {t('role:form.clearAll')}
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('role:form.permissionsHint')}
                    </p>
                    {!canEditPermissions && (
                      <p className="text-xs text-muted-foreground">
                        {t('role:form.permissionsNoPermission')}
                      </p>
                    )}
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder={t('role:form.searchPermissions')}
                      aria-label={t('role:form.searchPermissionsAria')}
                    />
                    <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-3">
                      {isPermissionPending ? (
                        <div className="space-y-2">
                          {Array.from({ length: 5 }).map((_, index) => (
                            <Skeleton key={index} className="h-5 w-full" />
                          ))}
                        </div>
                      ) : permissionError ? (
                        <p className="text-sm text-destructive">{permissionError}</p>
                      ) : permissions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          {t('role:form.noPermissions')}
                        </p>
                      ) : filteredPermissions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t('role:form.noMatch')}</p>
                      ) : (
                        filteredPermissions.map((permission) => (
                          <label
                            key={permission.id}
                            className="flex cursor-pointer items-start gap-3 rounded-md p-1 hover:bg-muted"
                          >
                            <Checkbox
                              checked={selectedIds.includes(permission.id)}
                              onCheckedChange={() => togglePermission(permission.id)}
                              disabled={!canEditPermissions}
                            />
                            <span className="min-w-0">
                              <span className="block font-mono text-sm font-medium">
                                {permission.code}
                              </span>
                              {permission.description && (
                                <span className="block text-sm text-muted-foreground">
                                  — {permission.description}
                                </span>
                              )}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )
              }}
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
