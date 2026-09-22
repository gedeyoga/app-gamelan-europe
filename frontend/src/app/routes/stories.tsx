import { useEffect, useState } from 'react'
import { LayoutGrid, List, Plus, ShieldAlert, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Toggle } from '@/components/ui/toggle'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { CARD_GRID_CLASS } from '@/components/shared/card-grid'
import { DataTablePagination } from '@/components/shared/data-table-pagination'
import { SearchBar } from '@/components/shared/search-bar'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { nextSort, type ListSortOrder } from '@/lib/list-params'
import { getApiErrorMessage, isValidationError, toastError, toastSuccess } from '@/lib/toast'
import { useAuthPermissions } from '@/features/auth/hooks/use-permissions'
import { isForbiddenError } from '@/features/auth/lib/permissions'
import { StoryCard } from '@/features/story/components/story-card'
import { StoryTable } from '@/features/story/components/story-table'
import { useDeleteStory } from '@/features/story/hooks/use-delete-story'
import { useStories } from '@/features/story/hooks/use-stories'
import type { Story } from '@/features/story/types'

const PAGE_LIMIT = 10

type ViewMode = 'card' | 'list'

function StoriesTableSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}

function StoriesCardSkeleton() {
  return (
    <div className={CARD_GRID_CLASS}>
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="flex flex-col gap-3 rounded-xl border p-4">
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}

export function StoriesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { can } = useAuthPermissions()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<ListSortOrder | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [deletingStory, setDeletingStory] = useState<Story | null>(null)

  const debouncedSearch = useDebouncedValue(search, 400)
  const storiesQuery = useStories({
    page,
    limit: PAGE_LIMIT,
    search: debouncedSearch,
    sortBy,
    sortOrder,
  })
  const deleteStory = useDeleteStory()

  const listTotal = storiesQuery.data?.total ?? 0
  const storiesForbidden = isForbiddenError(storiesQuery.error)
  const canCreateStory = can('story:create')

  // Clamp pagination boundary setelah total berubah (mis. hapus item terakhir).
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

  function handleDelete() {
    if (!deletingStory) return
    deleteStory.mutate(deletingStory.id, {
      onSuccess: () => {
        setDeletingStory(null)
        toastSuccess(t('story:toast.deleted'))
      },
      onError: (err: unknown) => {
        if (isValidationError(err)) return
        toastError(getApiErrorMessage(err, t('story:toast.deleteFailed')))
      },
    })
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('story:title')}</h1>
          <p className="text-sm text-muted-foreground">{t('story:subtitle')}</p>
        </div>
        {canCreateStory && (
          <Button onClick={() => navigate('/stories/new')}>
            <Plus className="size-4" data-icon="inline-start" />
            {t('story:add')}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBar
          value={search}
          onChange={handleSearchChange}
          placeholder={t('story:search.placeholder')}
          ariaLabel={t('story:search.ariaLabel')}
        />
        <div className="inline-flex items-center rounded-md border p-0.5">
          <Toggle
            size="sm"
            pressed={viewMode === 'card'}
            onPressedChange={() => setViewMode('card')}
            aria-label={t('story:view.card')}
          >
            <LayoutGrid className="size-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={viewMode === 'list'}
            onPressedChange={() => setViewMode('list')}
            aria-label={t('story:view.list')}
          >
            <List className="size-4" />
          </Toggle>
        </div>
      </div>

      {storiesQuery.isError ? (
        storiesForbidden ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
            <ShieldAlert className="size-6 text-destructive" />
            <p className="text-sm font-medium">{t('story:errors.forbidden')}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
            {t('story:errors.loadData')}
          </div>
        )
      ) : (
        <>
          {storiesQuery.isPending ? (
            viewMode === 'card' ? (
              <StoriesCardSkeleton />
            ) : (
              <StoriesTableSkeleton />
            )
          ) : viewMode === 'card' ? (
            <StoryCard
              items={storiesQuery.data?.items ?? []}
              searchTerm={debouncedSearch}
              onResetSearch={handleResetSearch}
              onEdit={(story) => navigate(`/stories/${story.id}/edit`)}
              onDelete={setDeletingStory}
              onCreate={() => navigate('/stories/new')}
              canUpdate={can('story:update')}
              canDelete={can('story:delete')}
              canCreate={canCreateStory}
            />
          ) : (
            <StoryTable
              items={storiesQuery.data?.items ?? []}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              searchTerm={debouncedSearch}
              onResetSearch={handleResetSearch}
              onEdit={(story) => navigate(`/stories/${story.id}/edit`)}
              onDelete={setDeletingStory}
              onCreate={() => navigate('/stories/new')}
              canUpdate={can('story:update')}
              canDelete={can('story:delete')}
              canCreate={canCreateStory}
            />
          )}

          <DataTablePagination
            page={page}
            limit={PAGE_LIMIT}
            total={storiesQuery.data?.total ?? 0}
            entityName={t('story:title')}
            isPending={storiesQuery.isPending}
            onPrev={() => setPage((prev) => Math.max(1, prev - 1))}
            onNext={() => setPage((prev) => prev + 1)}
          />
        </>
      )}

      {deletingStory && (
        <AlertDialog open onOpenChange={(open) => !open && setDeletingStory(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('story:delete.title')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('story:delete.description', { name: deletingStory.name })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button type="button" variant="outline" disabled={deleteStory.isPending}>
                  <X className="size-4" data-icon="inline-start" />
                  {t('common:actions.cancel')}
                </Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleteStory.isPending}
                  onClick={handleDelete}
                >
                  <Trash2 className="size-4" data-icon="inline-start" />
                  {deleteStory.isPending
                    ? t('common:actions.deleting')
                    : t('common:actions.delete')}
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
