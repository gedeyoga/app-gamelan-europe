import { useEffect, useState } from 'react'
import { Plus, RefreshCw, ShieldAlert } from 'lucide-react'
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
import { ApiKeyCreatedDialog } from '@/features/api-key/components/api-key-created-dialog'
import { ApiKeyFormDialog } from '@/features/api-key/components/api-key-form'
import { ApiKeyTable } from '@/features/api-key/components/api-key-table'
import { DeleteApiKeyDialog } from '@/features/api-key/components/delete-api-key-dialog'
import { useApiKey } from '@/features/api-key/hooks/use-api-key'
import { useApiKeys } from '@/features/api-key/hooks/use-api-keys'
import { useCreateApiKey } from '@/features/api-key/hooks/use-create-api-key'
import { useDeleteApiKey } from '@/features/api-key/hooks/use-delete-api-key'
import { useUpdateApiKey } from '@/features/api-key/hooks/use-update-api-key'
import type {
  ApiKey,
  CreateApiKeyInput,
  CreatedApiKey,
  UpdateApiKeyInput,
} from '@/features/api-key/types'
import { usePermissions } from '@/features/permission/hooks/use-permissions'
import { ApiError } from '@/lib/api-client'

const PAGE_LIMIT = 10

function ApiKeysTableSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}

export function ApiKeysPage() {
  const { t } = useTranslation()
  const { can } = useAuthPermissions()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<ListSortOrder | null>(null)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [formOpen, setFormOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null)
  const [deletingKey, setDeletingKey] = useState<ApiKey | null>(null)
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null)

  const debouncedSearch = useDebouncedValue(search, 400)
  const apiKeysQuery = useApiKeys({ page, limit: PAGE_LIMIT, search: debouncedSearch, sortBy, sortOrder })
  const permissionsQuery = usePermissions()
  const detailQuery = useApiKey(formMode === 'edit' ? (editingKey?.id ?? null) : null)

  const createApiKey = useCreateApiKey()
  const updateApiKey = useUpdateApiKey()
  const deleteApiKey = useDeleteApiKey()

  // Jaga raw key tidak tertahan di mutation cache sampai gcTime saat halaman unmount.
  const resetCreateApiKey = createApiKey.reset
  useEffect(() => () => resetCreateApiKey(), [resetCreateApiKey])

  const listTotal = apiKeysQuery.data?.total ?? 0
  const listForbidden = isForbiddenError(apiKeysQuery.error)
  const permissionsForbidden = isForbiddenError(permissionsQuery.error)
  const canCreate = can('apikey:create')
  const canUpdate = can('apikey:update')
  const canDelete = can('apikey:delete')

  // Clamp halaman yang keluar jangkauan setelah total berubah (mis. hapus item terakhir).
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
    setFormMode('create')
    setEditingKey(null)
    setFormOpen(true)
  }

  function openEditDialog(apiKey: ApiKey) {
    setFormMode('edit')
    setEditingKey(apiKey)
    setFormOpen(true)
  }

  function handleFormOpenChange(open: boolean) {
    setFormOpen(open)
    // Reset konteks edit saat dialog ditutup agar detail query tidak tetap enabled.
    if (!open) {
      setEditingKey(null)
      setFormMode('create')
      // Buang error/data create basi agar tidak muncul saat dialog dibuka ulang.
      createApiKey.reset()
    }
  }

  function handleSubmit(payload: CreateApiKeyInput | UpdateApiKeyInput) {
    if (formMode === 'edit') {
      if (!editingKey) return
      updateApiKey.mutate(
        { id: editingKey.id, payload },
        {
          onSuccess: () => {
            handleFormOpenChange(false)
            toastSuccess(t('api-key:toast.updated'))
          },
          onError: (err: unknown) => {
            // 422 -> per-field di form; dialog tetap terbuka, tanpa toast.
            if (isValidationError(err)) return
            toastError(getApiErrorMessage(err, t('api-key:toast.updateFailed')))
          },
        },
      )
      return
    }
    createApiKey.mutate(payload as CreateApiKeyInput, {
      onSuccess: (created) => {
        handleFormOpenChange(false)
        setCreatedKey(created)
        toastSuccess(t('api-key:toast.created'))
      },
      onError: (err: unknown) => {
        if (isValidationError(err)) return
        toastError(getApiErrorMessage(err, t('api-key:toast.createFailed')))
      },
    })
  }

  function handleDelete() {
    if (!deletingKey) return
    deleteApiKey.mutate(deletingKey.id, {
      onSuccess: () => {
        setDeletingKey(null)
        toastSuccess(t('api-key:toast.deleted'))
      },
      onError: (err: unknown) => {
        if (isValidationError(err)) return
        toastError(getApiErrorMessage(err, t('api-key:toast.deleteFailed')))
      },
    })
  }

  const dialogReady =
    formMode === 'create'
      ? permissionsQuery.isSuccess
      : permissionsQuery.isSuccess && detailQuery.isSuccess

  const initialPermissionCodes =
    formMode === 'edit' ? (detailQuery.data?.permissions ?? editingKey?.permissions ?? []) : []

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('api-key:title')}</h1>
          <p className="text-sm text-muted-foreground">{t('api-key:subtitle')}</p>
        </div>
        {canCreate && (
          <Button onClick={openCreateDialog}>
            <Plus data-icon="inline-start" className="size-4" />
            {t('api-key:add')}
          </Button>
        )}
      </div>

      {permissionsQuery.isError && (
        <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
          {permissionsForbidden
            ? t('api-key:errors.permissionsForbidden')
            : t('api-key:errors.loadPermissions')}
          <Button
            variant="link"
            size="sm"
            className="ml-2 h-auto p-0"
            onClick={() => permissionsQuery.refetch()}
          >
            <RefreshCw className="size-3.5" data-icon="inline-start" />
            {t('common:actions.retry')}
          </Button>
        </div>
      )}

      {apiKeysQuery.isError ? (
        listForbidden ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
            <ShieldAlert className="size-6 text-destructive" />
            <p className="text-sm font-medium">{t('api-key:errors.forbidden')}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
            {t('api-key:errors.loadData')}
          </div>
        )
      ) : apiKeysQuery.isPending ? (
        <>
          <SearchBar
            value={search}
            onChange={handleSearchChange}
            placeholder={t('api-key:search.placeholder')}
            ariaLabel={t('api-key:search.ariaLabel')}
          />
          <ApiKeysTableSkeleton />
        </>
      ) : (
        <>
          <SearchBar
            value={search}
            onChange={handleSearchChange}
            placeholder={t('api-key:search.placeholder')}
            ariaLabel={t('api-key:search.ariaLabel')}
          />
          <ApiKeyTable
            items={apiKeysQuery.data?.items ?? []}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            searchTerm={debouncedSearch}
            onResetSearch={handleResetSearch}
            onEdit={openEditDialog}
            onDelete={setDeletingKey}
            canUpdate={canUpdate}
            canDelete={canDelete}
          />
          <DataTablePagination
            page={page}
            limit={PAGE_LIMIT}
            total={listTotal}
            entityName={t('api-key:title')}
            isPending={apiKeysQuery.isPending}
            onPrev={() => setPage((prev) => Math.max(1, prev - 1))}
            onNext={() => setPage((prev) => prev + 1)}
          />
        </>
      )}

      {formOpen && dialogReady && (
        <ApiKeyFormDialog
          open={formOpen}
          mode={formMode}
          apiKey={editingKey}
          initialPermissionCodes={initialPermissionCodes}
          permissions={permissionsQuery.data?.items ?? []}
          isPending={formMode === 'create' ? createApiKey.isPending : updateApiKey.isPending}
          isPermissionPending={permissionsQuery.isPending}
          permissionError={permissionsQuery.isError ? t('api-key:errors.loadPermissions') : undefined}
          submissionError={formMode === 'create' ? createApiKey.error : updateApiKey.error}
          onSubmit={handleSubmit}
          onOpenChange={handleFormOpenChange}
        />
      )}

      {deletingKey && (
        <DeleteApiKeyDialog
          apiKey={deletingKey}
          isPending={deleteApiKey.isPending}
          error={deleteApiKey.error as ApiError | null}
          onConfirm={handleDelete}
          onOpenChange={(open) => {
            if (!open) setDeletingKey(null)
          }}
        />
      )}

      {createdKey && (
        <ApiKeyCreatedDialog
          open
          apiKeyName={createdKey.name}
          rawKey={createdKey.key}
          onOpenChange={(open) => {
            // Raw key dibuang dari state + mutation cache saat dialog ditutup.
            if (!open) {
              setCreatedKey(null)
              createApiKey.reset()
            }
          }}
        />
      )}
    </div>
  )
}
