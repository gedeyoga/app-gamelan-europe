import { useEffect, useState } from 'react'
import { Plus, RefreshCw, ShieldAlert, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTablePagination } from '@/components/shared/data-table-pagination'
import { SearchBar } from '@/components/shared/search-bar'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { nextSort, type ListSortOrder } from '@/lib/list-params'
import { useAuthPermissions } from '@/features/auth/hooks/use-permissions'
import { isForbiddenError } from '@/features/auth/lib/permissions'
import { usePermissions } from '@/features/permission/hooks/use-permissions'
import { RoleDeleteDialog } from '@/features/role/components/role-delete-dialog'
import { RoleFormDialog } from '@/features/role/components/role-form-dialog'
import { RoleTable } from '@/features/role/components/role-table'
import { useCreateRole } from '@/features/role/hooks/use-create-role'
import { useDeleteRole } from '@/features/role/hooks/use-delete-role'
import { useReplaceRolePermissions } from '@/features/role/hooks/use-replace-role-permissions'
import { useRolePermissions } from '@/features/role/hooks/use-role-permissions'
import { useRoles } from '@/features/role/hooks/use-roles'
import { useUpdateRole } from '@/features/role/hooks/use-update-role'
import type { CreateRoleInput, Role, UpdateRoleInput } from '@/features/role/types'
import { ApiError } from '@/lib/api-client'
import { getApiErrorMessage, isValidationError, toastError, toastSuccess } from '@/lib/toast'

function RolesTableSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}

const PAGE_LIMIT = 10

type PermissionAssignErrorKind = 'create' | 'update' | null

export function RolesPage() {
  const { t } = useTranslation()
  const { can } = useAuthPermissions()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<ListSortOrder | null>(null)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [formOpen, setFormOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [deletingRole, setDeletingRole] = useState<Role | null>(null)
  const [permissionErrorKind, setPermissionErrorKind] = useState<PermissionAssignErrorKind>(null)

  const debouncedSearch = useDebouncedValue(search, 400)
  const rolesQuery = useRoles({ page, limit: PAGE_LIMIT, search: debouncedSearch, sortBy, sortOrder })
  const permissionsQuery = usePermissions()
  const rolePermissionsQuery = useRolePermissions(editingRole?.id ?? null)

  const createRole = useCreateRole()
  const updateRole = useUpdateRole()
  const deleteRole = useDeleteRole()
  const replaceRolePermissions = useReplaceRolePermissions()

  const listTotal = rolesQuery.data?.total ?? 0
  const rolesForbidden = isForbiddenError(rolesQuery.error)
  const permissionsForbidden = isForbiddenError(permissionsQuery.error)
  const canCreateRole = can('role:create')
  const canEditPermissions = can('permission:update')

  // Koreksi halaman yang keluar jangkauan setelah total berubah (mis. hapus item terakhir).
  // Clamp pagination boundary — setState di effect disengaja (bukan sync external system).
  useEffect(() => {
    if (listTotal > 0 && page > 1 && (page - 1) * PAGE_LIMIT >= listTotal) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPage(Math.max(1, Math.ceil(listTotal / PAGE_LIMIT)))
    }
  }, [listTotal, page])

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

  function openCreateDialog() {
    setPermissionErrorKind(null)
    setFormMode('create')
    setEditingRole(null)
    setFormOpen(true)
  }

  function openEditDialog(role: Role) {
    setPermissionErrorKind(null)
    setFormMode('edit')
    setEditingRole(role)
    setFormOpen(true)
  }

  function handleCreate(payload: CreateRoleInput, permissionIds: string[]) {
    createRole.mutate(payload, {
      onSuccess: (newRole) => {
        // PUT permissions butuh `permission:update` — jangan panggil bila tak punya izin.
        if (permissionIds.length === 0 || !canEditPermissions) {
          setFormOpen(false)
          toastSuccess(t('role:toast.created'))
          return
        }
        replaceRolePermissions.mutate(
          { roleId: newRole.id, permissionIds },
          {
            onSuccess: () => {
              setFormOpen(false)
              toastSuccess(t('role:toast.created'))
            },
            onError: (err: unknown) => {
              setFormOpen(false)
              setPermissionErrorKind('create')
              toastError(getApiErrorMessage(err, t('role:errors.permissionAssignCreated')))
            },
          },
        )
      },
      onError: (err: unknown) => {
        // 422 mengalir ke form via submissionError -> setError per-field; tanpa toast, dialog tetap terbuka.
        if (isValidationError(err)) return
        toastError(getApiErrorMessage(err, t('role:toast.createFailed')))
      },
    })
  }

  function handleUpdate(payload: UpdateRoleInput, permissionIds: string[]) {
    if (!editingRole) return
    const currentIds = (rolePermissionsQuery.data ?? []).map((rp) => rp.permissionId)
    const signature = (ids: string[]) => [...ids].sort().join(',')
    const unchanged = signature(currentIds) === signature(permissionIds)

    updateRole.mutate(
      { id: editingRole.id, payload },
      {
        onSuccess: () => {
          // PUT permissions butuh `permission:update` — jangan panggil bila tak punya izin.
          if (unchanged || !canEditPermissions) {
            setFormOpen(false)
            toastSuccess(t('role:toast.updated'))
            return
          }
          replaceRolePermissions.mutate(
            { roleId: editingRole.id, permissionIds },
            {
              onSuccess: () => {
                setFormOpen(false)
                toastSuccess(t('role:toast.updated'))
              },
              onError: (err: unknown) => {
                setFormOpen(false)
                setPermissionErrorKind('update')
                toastError(getApiErrorMessage(err, t('role:errors.permissionAssignUpdated')))
              },
            },
          )
        },
        onError: (err: unknown) => {
          // 422 mengalir ke form via submissionError -> setError per-field; tanpa toast, dialog tetap terbuka.
          if (isValidationError(err)) return
          toastError(getApiErrorMessage(err, t('role:toast.updateFailed')))
        },
      },
    )
  }

  function handleSubmit(payload: CreateRoleInput | UpdateRoleInput, permissionIds: string[]) {
    if (formMode === 'edit') handleUpdate(payload as UpdateRoleInput, permissionIds)
    else handleCreate(payload as CreateRoleInput, permissionIds)
  }

  function handleDelete() {
    if (!deletingRole) return
    deleteRole.mutate(deletingRole.id, {
      onSuccess: () => {
        setDeletingRole(null)
        toastSuccess(t('role:toast.deleted'))
      },
      onError: (err: unknown) => {
        if (isValidationError(err)) return;
        toastError(getApiErrorMessage(err, t('role:toast.deleteFailed')))
      },
    })
  }

  const dialogReady =
    formMode === 'create'
      ? permissionsQuery.isSuccess
      : permissionsQuery.isSuccess && rolePermissionsQuery.isSuccess

  const initialPermissionIds =
    formMode === 'edit'
      ? (rolePermissionsQuery.data ?? []).map((rp) => rp.permissionId)
      : []

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('role:title')}</h1>
          <p className="text-sm text-muted-foreground">{t('role:subtitle')}</p>
        </div>
        {canCreateRole && (
          <Button onClick={openCreateDialog}>
            <Plus data-icon="inline-start" className="size-4" />
            {t('role:add')}
          </Button>
        )}
      </div>

      {permissionErrorKind && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 p-3 text-sm text-destructive"
        >
          {permissionErrorKind === 'create'
            ? t('role:errors.permissionAssignCreated')
            : t('role:errors.permissionAssignUpdated')}
          <Button
            variant="link"
            size="sm"
            className="ml-2 h-auto p-0"
            onClick={() => setPermissionErrorKind(null)}
          >
            <X className="size-3.5" data-icon="inline-start" />
            {t('common:actions.close')}
          </Button>
        </div>
      )}

      {(permissionsQuery.isError || (editingRole && rolePermissionsQuery.isError)) && (
        <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
          {permissionsForbidden
            ? t('role:errors.permissionsForbidden')
            : permissionsQuery.isError
              ? t('role:errors.loadPermissions')
              : t('role:errors.loadRolePermissions')}
          <Button
            variant="link"
            size="sm"
            className="ml-2 h-auto p-0"
            onClick={() =>
              permissionsQuery.isError ? permissionsQuery.refetch() : rolePermissionsQuery.refetch()
            }
          >
            <RefreshCw className="size-3.5" data-icon="inline-start" />
            {t('common:actions.retry')}
          </Button>
        </div>
      )}

      {rolesQuery.isError ? (
        rolesForbidden ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
            <ShieldAlert className="size-6 text-destructive" />
            <p className="text-sm font-medium">{t('role:errors.forbidden')}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
            {t('role:errors.loadData')}
          </div>
        )
      ) : rolesQuery.isPending ? (
        <>
          <SearchBar
            value={search}
            onChange={handleSearchChange}
            placeholder={t('role:search.placeholder')}
            ariaLabel={t('role:search.ariaLabel')}
          />
          <RolesTableSkeleton />
        </>
      ) : (
        <>
          <SearchBar
            value={search}
            onChange={handleSearchChange}
            placeholder={t('role:search.placeholder')}
            ariaLabel={t('role:search.ariaLabel')}
          />
          <RoleTable
            items={rolesQuery.data?.items ?? []}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            searchTerm={debouncedSearch}
            onResetSearch={handleResetSearch}
            onEdit={openEditDialog}
            onDelete={setDeletingRole}
            canUpdate={can('role:update')}
            canDelete={can('role:delete')}
          />
          <DataTablePagination
            page={page}
            limit={PAGE_LIMIT}
            total={rolesQuery.data?.total ?? 0}
            entityName={t('role:title')}
            isPending={rolesQuery.isPending}
            onPrev={() => setPage((prev) => Math.max(1, prev - 1))}
            onNext={() => setPage((prev) => prev + 1)}
          />
        </>
      )}

      {formOpen && dialogReady && (
        <RoleFormDialog
          open={formOpen}
          mode={formMode}
          role={editingRole}
          permissions={permissionsQuery.data?.items ?? []}
          initialPermissionIds={initialPermissionIds}
          canEditPermissions={canEditPermissions}
          isPending={
            formMode === 'create'
              ? createRole.isPending || replaceRolePermissions.isPending
              : updateRole.isPending || replaceRolePermissions.isPending
          }
          isPermissionPending={permissionsQuery.isPending}
          permissionError={
            permissionsQuery.isError ? t('role:errors.loadPermissions') : undefined
          }
          submissionError={formMode === 'create' ? createRole.error : updateRole.error}
          onSubmit={handleSubmit}
          onOpenChange={setFormOpen}
        />
      )}

      {deletingRole && (
        <RoleDeleteDialog
          role={deletingRole}
          isPending={deleteRole.isPending}
          error={deleteRole.error as ApiError | null}
          onConfirm={handleDelete}
          onOpenChange={(open) => {
            if (!open) setDeletingRole(null)
          }}
        />
      )}
    </div>
  )
}
