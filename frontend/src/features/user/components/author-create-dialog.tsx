import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { UserOption } from '@/components/shared/user-combobox'
import { Button } from '@/components/ui/button'
import { useAuthPermissions } from '@/features/auth/hooks/use-permissions'
import { useRoles } from '@/features/role/hooks/use-roles'
import { getApiErrorMessage, isValidationError, toastError, toastSuccess } from '@/lib/toast'

import { useAssignRole } from '../hooks/use-assign-role'
import { useCreateUser } from '../hooks/use-create-user'
import { UserFormDialog } from './user-form-dialog'
import type { CreateUserInput } from '../types'

export interface AuthorCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Dipanggil setelah user dibuat (walau assign role gagal) agar author bisa langsung dipilih. */
  onCreated: (author: UserOption) => void
}

/**
 * Dialog create user reusable untuk field author (story/event/archive).
 * Membungkus `UserFormDialog` + mutation create/assign role agar form tidak menduplikasi logika.
 * Kegagalan assign role menutup dialog (user sudah terbuat — jangan biarkan submit ulang
 * `POST /users` ganda) lalu menampilkan banner dismissible di luar dialog.
 */
export function AuthorCreateDialog({ open, onOpenChange, onCreated }: AuthorCreateDialogProps) {
  const { t } = useTranslation()
  const { can } = useAuthPermissions()
  const createUser = useCreateUser()
  const assignRole = useAssignRole()
  const rolesQuery = useRoles({ page: 1, limit: 100 })
  const [roleError, setRoleError] = useState<string | null>(null)

  const canAssignRole = can('user:update')

  // Role `author` sudah di-seed backend. Bila tidak ditemukan, biarkan admin pilih manual.
  const authorRoleId = rolesQuery.data?.items.find((role) => role.name === 'author')?.id ?? ''

  // State mutation persist lintas buka-tutup; reset tiap transisi `open` (termasuk tutup/unmount)
  // agar 422/banner lama tidak bocor ke sesi berikutnya. Deps hanya `open` (objek mutation berubah
  // tiap render → bukan dep yang aman).
  useEffect(() => {
    createUser.reset()
    assignRole.reset()
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRoleError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function handleCreate(payload: CreateUserInput, roleId: string) {
    createUser.mutate(payload, {
      onSuccess: (created) => {
        const author: UserOption = {
          id: created.id,
          fullName: created.fullName,
          email: created.email,
        }
        // Assign role butuh `user:update` — jangan panggil bila tak punya izin.
        if (!roleId || !canAssignRole) {
          onCreated(author)
          onOpenChange(false)
          toastSuccess(t('user:toast.created'))
          return
        }
        assignRole.mutate(
          { userId: created.id, roleId },
          {
            onSuccess: () => {
              onCreated(author)
              onOpenChange(false)
              toastSuccess(t('user:toast.created'))
            },
            onError: (err: unknown) => {
              // User sudah terbuat: tutup dialog supaya tidak ada submit `POST /users` kedua;
              // kegagalan assign role disampaikan lewat toast + banner di luar dialog.
              // 422 tidak di-toast/banner.
              onCreated(author)
              onOpenChange(false)
              if (isValidationError(err)) return
              const message = getApiErrorMessage(err, t('user:errors.roleAssignCreated'))
              setRoleError(message)
              toastError(message)
            },
          },
        )
      },
      onError: (err: unknown) => {
        // 422 mengalir ke form via submissionError -> per-field; tanpa toast, dialog tetap terbuka.
        if (isValidationError(err)) return
        toastError(getApiErrorMessage(err, t('user:toast.createFailed')))
      },
    })
  }

  return (
    <>
      {/* Mount kondisional agar `useForm` di `UserFormDialog` re-init dengan default bersih tiap dibuka. */}
      {open && (
        <UserFormDialog
          mode="create"
          user={null}
          roles={rolesQuery.data?.items ?? []}
          canAssignRole={canAssignRole}
          title={t('user:form.authorCreateTitle')}
          description={t('user:form.authorCreateDescription')}
          hidePassword
          defaultRoleId={authorRoleId}
          lockRole={Boolean(authorRoleId)}
          isSubmitting={createUser.isPending || assignRole.isPending}
          submissionError={createUser.error}
          onCreate={handleCreate}
          onUpdate={() => {}}
          onOpenChange={onOpenChange}
        />
      )}

      {!open && roleError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 p-3 text-sm text-destructive"
        >
          {roleError}
          <Button
            variant="link"
            size="sm"
            className="ml-2 h-auto p-0"
            onClick={() => setRoleError(null)}
          >
            <X className="size-3.5" data-icon="inline-start" />
            {t('common:actions.close')}
          </Button>
        </div>
      )}
    </>
  )
}
