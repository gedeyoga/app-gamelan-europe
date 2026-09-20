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
import { DeleteOrganizationDialog } from '@/features/organization/components/delete-organization-dialog'
import { OrganizationFormDialog } from '@/features/organization/components/organization-form-dialog'
import { OrganizationTable } from '@/features/organization/components/organization-table'
import { useCreateOrganization } from '@/features/organization/hooks/use-create-organization'
import { useDeleteOrganization } from '@/features/organization/hooks/use-delete-organization'
import { useOrganizations } from '@/features/organization/hooks/use-organizations'
import { useUpdateOrganization } from '@/features/organization/hooks/use-update-organization'
import type {
  CreateOrganizationInput,
  Organization,
  UpdateOrganizationInput,
} from '@/features/organization/types'

const PAGE_LIMIT = 10

function OrganizationsTableSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}

export function OrganizationsPage() {
  const { t } = useTranslation()
  const { can } = useAuthPermissions()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<ListSortOrder | null>(null)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [formOpen, setFormOpen] = useState(false)
  const [editingOrganization, setEditingOrganization] = useState<Organization | null>(null)
  const [deletingOrganization, setDeletingOrganization] = useState<Organization | null>(null)

  const debouncedSearch = useDebouncedValue(search, 400)
  const organizationsQuery = useOrganizations({
    page,
    limit: PAGE_LIMIT,
    search: debouncedSearch,
    sortBy,
    sortOrder,
  })

  const createOrganization = useCreateOrganization()
  const updateOrganization = useUpdateOrganization()
  const deleteOrganization = useDeleteOrganization()

  const listTotal = organizationsQuery.data?.total ?? 0
  const organizationsForbidden = isForbiddenError(organizationsQuery.error)
  const canCreateOrganization = can('organization:create')

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
    setFormMode('create')
    setEditingOrganization(null)
    setFormOpen(true)
  }

  function openEditDialog(organization: Organization) {
    setFormMode('edit')
    setEditingOrganization(organization)
    setFormOpen(true)
  }

  function handleCreate(payload: CreateOrganizationInput) {
    createOrganization.mutate(payload, {
      onSuccess: () => {
        setFormOpen(false)
        toastSuccess(t('organization:toast.created'))
      },
      onError: (err: unknown) => {
        // 422 mengalir ke form via submissionError -> setError per-field; tanpa toast, dialog tetap terbuka.
        if (isValidationError(err)) return
        toastError(getApiErrorMessage(err, t('organization:toast.createFailed')))
      },
    })
  }

  function handleUpdate(payload: UpdateOrganizationInput) {
    if (!editingOrganization) return
    updateOrganization.mutate(
      { id: editingOrganization.id, payload },
      {
        onSuccess: () => {
          setFormOpen(false)
          toastSuccess(t('organization:toast.updated'))
        },
        onError: (err: unknown) => {
          // 422 mengalir ke form via submissionError -> setError per-field; tanpa toast, dialog tetap terbuka.
          if (isValidationError(err)) return
          toastError(getApiErrorMessage(err, t('organization:toast.updateFailed')))
        },
      },
    )
  }

  function handleDelete() {
    if (!deletingOrganization) return
    deleteOrganization.mutate(deletingOrganization.id, {
      onSuccess: () => {
        setDeletingOrganization(null)
        toastSuccess(t('organization:toast.deleted'))
      },
      onError: (err: unknown) => {
        if (isValidationError(err)) return
        toastError(getApiErrorMessage(err, t('organization:toast.deleteFailed')))
      },
    })
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('organization:title')}</h1>
          <p className="text-sm text-muted-foreground">{t('organization:subtitle')}</p>
        </div>
        {canCreateOrganization && (
          <Button onClick={openCreateDialog}>
            <Plus data-icon="inline-start" className="size-4" />
            {t('organization:add')}
          </Button>
        )}
      </div>

      <SearchBar
        value={search}
        onChange={handleSearchChange}
        placeholder={t('organization:search.placeholder')}
        ariaLabel={t('organization:search.ariaLabel')}
      />

      {organizationsQuery.isError ? (
        organizationsForbidden ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
            <ShieldAlert className="size-6 text-destructive" />
            <p className="text-sm font-medium">{t('organization:errors.forbidden')}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
            {t('organization:errors.loadData')}
          </div>
        )
      ) : (
        <>
          {organizationsQuery.isPending ? (
            <OrganizationsTableSkeleton />
          ) : (
            <OrganizationTable
              items={organizationsQuery.data?.items ?? []}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              searchTerm={debouncedSearch}
              onResetSearch={handleResetSearch}
              onEdit={openEditDialog}
              onDelete={setDeletingOrganization}
              canUpdate={can('organization:update')}
              canDelete={can('organization:delete')}
            />
          )}

          <DataTablePagination
            page={page}
            limit={PAGE_LIMIT}
            total={organizationsQuery.data?.total ?? 0}
            entityName={t('organization:title')}
            isPending={organizationsQuery.isPending}
            onPrev={() => setPage((prev) => Math.max(1, prev - 1))}
            onNext={() => setPage((prev) => prev + 1)}
          />
        </>
      )}

      {formOpen && (
        <OrganizationFormDialog
          mode={formMode}
          organization={editingOrganization}
          isSubmitting={
            formMode === 'create' ? createOrganization.isPending : updateOrganization.isPending
          }
          submissionError={formMode === 'create' ? createOrganization.error : updateOrganization.error}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onOpenChange={setFormOpen}
        />
      )}

      {deletingOrganization && (
        <DeleteOrganizationDialog
          organization={deletingOrganization}
          isSubmitting={deleteOrganization.isPending}
          onConfirm={handleDelete}
          onOpenChange={(open) => {
            if (!open) setDeletingOrganization(null)
          }}
        />
      )}
    </div>
  )
}
