import { useEffect, useState } from 'react'
import { Plus, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTablePagination } from '@/components/shared/data-table-pagination'
import { SearchBar } from '@/components/shared/search-bar'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { nextSort, type ListSortOrder } from '@/lib/list-params'
import { getApiErrorMessage, isValidationError, toastError, toastSuccess } from '@/lib/toast'
import { useAuthPermissions } from '@/features/auth/hooks/use-permissions'
import { isForbiddenError } from '@/features/auth/lib/permissions'
import { useRoles } from '@/features/role/hooks/use-roles'
import { DeleteUserDialog } from '@/features/user/components/delete-user-dialog'
import { UserFormDialog } from '@/features/user/components/user-form-dialog'
import { UserTable } from '@/features/user/components/user-table'
import { useAssignRole } from '@/features/user/hooks/use-assign-role'
import { useCreateUser } from '@/features/user/hooks/use-create-user'
import { useDeleteUser } from '@/features/user/hooks/use-delete-user'
import { useUpdateUser } from '@/features/user/hooks/use-update-user'
import { useUsers } from '@/features/user/hooks/use-users'
import type { CreateUserInput, UpdateUserInput, User } from '@/features/user/types'

const PAGE_LIMIT = 10

function UsersTableSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}

type RoleAssignErrorKind = 'create' | 'update' | null

export function UsersPage() {
  const { t } = useTranslation()
  const { can } = useAuthPermissions()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<ListSortOrder | null>(null)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [formOpen, setFormOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)
  const [roleErrorKind, setRoleErrorKind] = useState<RoleAssignErrorKind>(null)

  const debouncedSearch = useDebouncedValue(search, 400)
  const usersQuery = useUsers({ page, limit: PAGE_LIMIT, search: debouncedSearch, sortBy, sortOrder })
  const rolesQuery = useRoles({ page: 1, limit: 100 })

  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()
  const assignRole = useAssignRole()

  const roleOptions = rolesQuery.data?.items ?? []

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(1)
  }

  function handleSort(field: string) {
    const next = nextSort(sortBy, sortOrder, field)
    setSortBy(next.sortBy)
    setSortOrder(next.sortOrder)
    setPage(1)
  }

  function handleResetSearch() {
    setSearch('')
    setPage(1)
  }

  const listTotal = usersQuery.data?.total ?? 0
  const usersForbidden = isForbiddenError(usersQuery.error)
  const canCreateUser = can('user:create')
  const canAssignRole = can('user:update')

  // Koreksi halaman yang keluar jangkauan setelah total berubah (mis. hapus item terakhir).
  // Clamp pagination boundary — setState di effect disengaja (bukan sync external system).
  useEffect(() => {
    if (listTotal > 0 && page > 1 && (page - 1) * PAGE_LIMIT >= listTotal) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPage(Math.max(1, Math.ceil(listTotal / PAGE_LIMIT)))
    }
  }, [listTotal, page])

  function openCreateDialog() {
    setFormMode('create')
    setEditingUser(null)
    setFormOpen(true)
  }

  function openEditDialog(user: User) {
    setFormMode('edit')
    setEditingUser(user)
    setFormOpen(true)
  }

  function handleCreate(payload: CreateUserInput, roleId: string) {
    createUser.mutate(payload, {
      onSuccess: (created) => {
        // Assign role butuh `user:update` — jangan panggil bila tak punya izin.
        if (!roleId || !canAssignRole) {
          setFormOpen(false)
          toastSuccess(t('user:toast.created'))
          return
        }
        assignRole.mutate(
          { userId: created.id, roleId },
          {
            onSuccess: () => {
              setFormOpen(false)
              toastSuccess(t('user:toast.created'))
            },
            onError: (err: unknown) => {
              setFormOpen(false)
              setRoleErrorKind('create')
              toastError(getApiErrorMessage(err, t('user:errors.roleAssignCreated')))
            },
          },
        )
      },
      onError: (err: unknown) => {
        // 422 mengalir ke form via submissionError -> setError per-field; tanpa toast, dialog tetap terbuka.
        if (isValidationError(err)) return
        toastError(getApiErrorMessage(err, t('user:toast.createFailed')))
      },
    })
  }

  function handleUpdate(payload: UpdateUserInput, roleId: string) {
    if (!editingUser) return
    updateUser.mutate(
      { id: editingUser.id, payload },
      {
        onSuccess: () => {
          const roleChanged = Boolean(roleId) && roleId !== editingUser.roleId
          // Assign role butuh `user:update` — jangan panggil bila tak punya izin.
          if (!roleChanged || !canAssignRole) {
            setFormOpen(false)
            toastSuccess(t('user:toast.updated'))
            return
          }
          assignRole.mutate(
            { userId: editingUser.id, roleId },
            {
              onSuccess: () => {
                setFormOpen(false)
                toastSuccess(t('user:toast.updated'))
              },
              onError: (err: unknown) => {
                setFormOpen(false)
                setRoleErrorKind('update')
                toastError(getApiErrorMessage(err, t('user:errors.roleAssignUpdated')))
              },
            },
          )
        },
        onError: (err: unknown) => {
          // 422 mengalir ke form via submissionError -> setError per-field; tanpa toast, dialog tetap terbuka.
          if (isValidationError(err)) return
          toastError(getApiErrorMessage(err, t('user:toast.updateFailed')))
        },
      },
    )
  }

  function handleDelete() {
    if (!deletingUser) return
    deleteUser.mutate(deletingUser.id, {
      onSuccess: () => {
        setDeletingUser(null)
        toastSuccess(t('user:toast.deleted'))
      },
      onError: (err: unknown) => {
        if (isValidationError(err)) return;
        toastError(getApiErrorMessage(err, t('user:toast.deleteFailed')))
      },
    })
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('user:title')}</h1>
          <p className="text-sm text-muted-foreground">{t('user:subtitle')}</p>
        </div>
        {canCreateUser && (
          <Button onClick={openCreateDialog}>
            <Plus className="size-4" />
            {t('user:add')}
          </Button>
        )}
      </div>

      {rolesQuery.isError && (
        <div className="text-sm text-destructive">
          {t('user:errors.loadRoles')}{' '}
          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => rolesQuery.refetch()}>
            {t('common:actions.retry')}
          </Button>
        </div>
      )}

      {roleErrorKind && (
        <div role="alert" className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">
          {roleErrorKind === 'create'
            ? t('user:errors.roleAssignCreated')
            : t('user:errors.roleAssignUpdated')}
          <button className="ml-2 underline" onClick={() => setRoleErrorKind(null)}>
            {t('common:actions.close')}
          </button>
        </div>
      )}

      <SearchBar
        value={search}
        onChange={handleSearchChange}
        placeholder={t('user:search.placeholder')}
        ariaLabel={t('user:search.ariaLabel')}
      />

      {usersQuery.isError ? (
        usersForbidden ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
            <ShieldAlert className="size-6 text-destructive" />
            <p className="text-sm font-medium">{t('user:errors.forbidden')}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
            {t('user:errors.loadData')}
          </div>
        )
      ) : (
        <>
          {usersQuery.isPending ? (
            <UsersTableSkeleton />
          ) : (
            <UserTable
              items={usersQuery.data?.items ?? []}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              searchTerm={debouncedSearch}
              onResetSearch={handleResetSearch}
              onEdit={openEditDialog}
              onDelete={setDeletingUser}
              canUpdate={can('user:update')}
              canDelete={can('user:delete')}
            />
          )}

          <DataTablePagination
            page={page}
            limit={PAGE_LIMIT}
            total={usersQuery.data?.total ?? 0}
            entityName={t('user:title')}
            isPending={usersQuery.isPending}
            onPrev={() => setPage((prev) => Math.max(1, prev - 1))}
            onNext={() => setPage((prev) => prev + 1)}
          />
        </>
      )}

      {formOpen && (
        <UserFormDialog
          mode={formMode}
          user={editingUser}
          roles={roleOptions}
          canAssignRole={canAssignRole}
          isSubmitting={
            formMode === 'create' ? createUser.isPending : updateUser.isPending || assignRole.isPending
          }
          submissionError={formMode === 'create' ? createUser.error : updateUser.error}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onOpenChange={setFormOpen}
        />
      )}

      {deletingUser && (
        <DeleteUserDialog
          user={deletingUser}
          isSubmitting={deleteUser.isPending}
          onConfirm={handleDelete}
          onOpenChange={(open) => {
            if (!open) setDeletingUser(null)
          }}
        />
      )}
    </div>
  )
}
