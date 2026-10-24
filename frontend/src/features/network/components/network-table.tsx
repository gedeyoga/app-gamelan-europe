import { Check, Loader2, MoreHorizontal, Pencil, RotateCcw, Send, Trash2, Undo2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MobileRecordList } from '@/components/shared/mobile-record-list'
import { MobileSortChips } from '@/components/shared/mobile-sort-chips'
import { SortableHeader, type SortOrder } from '@/components/shared/sortable-header'
import { formatDateTime } from '@/lib/datetime'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import type { Network, NetworkStatus } from '../types'

const STATUS_VARIANT: Record<NetworkStatus, 'default' | 'secondary' | 'outline'> = {
  DRAFT: 'secondary',
  REQUEST: 'outline',
  APPROVED: 'default',
  PUBLISHED: 'default',
}

export interface NetworkTableProps {
  items: Network[]
  sortBy: string | null
  sortOrder: SortOrder | null
  onSort: (field: string) => void
  searchTerm?: string
  onResetSearch?: () => void
  onEdit: (network: Network) => void
  onDelete: (network: Network) => void
  /** `POST /networks/:id/submit` (`DRAFT` → `REQUEST`). */
  onSubmit?: (network: Network) => void
  /** `POST /networks/:id/approve` langsung dari `DRAFT`/`REQUEST`. */
  onPublish?: (network: Network) => void
  /** `POST /networks/:id/unpublish` (`PUBLISHED` → `DRAFT`). */
  onUnpublish?: (network: Network) => void
  /** Gate `network:approve` — tombol Publish disembunyikan bila `false`. Default `true`. */
  canApprove?: boolean
  /** Gate `network:update` — tombol Edit/Submit disembunyikan bila `false`. Default `true`. */
  canUpdate?: boolean
  /** Gate `network:delete` — tombol Hapus disembunyikan bila `false`. Default `true`. */
  canDelete?: boolean
  /** Gate `network:unpublish` — tombol Unpublish disembunyikan bila `false`. Default `true`. */
  canUnpublish?: boolean
  /** ID network terpilih (bulk update). */
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  /** Seluruh baris cocok kriteria (lintas halaman) terpilih. */
  allSelected: boolean
  /** Select-all lintas halaman / clear. */
  onToggleAll: () => void
  /** Sedang mengambil semua ID (select-all). */
  isSelectingAll?: boolean
  /** Mutasi bulk sedang berjalan — checkbox baris di-disable. */
  isBulkPending?: boolean
  /** Tampilkan kolom checkbox. Default `true`. */
  canBulkUpdate?: boolean
}

interface RowActionsProps {
  network: Network
  onEdit: (network: Network) => void
  onDelete: (network: Network) => void
  onSubmit?: (network: Network) => void
  onPublish?: (network: Network) => void
  onUnpublish?: (network: Network) => void
  canUpdate: boolean
  canDelete: boolean
  canApprove: boolean
  canUnpublish: boolean
}

function RowActions({
  network,
  onEdit,
  onDelete,
  onSubmit,
  onPublish,
  onUnpublish,
  canUpdate,
  canDelete,
  canApprove,
  canUnpublish,
}: RowActionsProps) {
  const { t } = useTranslation()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('common:table.actionsFor', { name: network.name })}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canUpdate && network.status === 'DRAFT' && onSubmit && (
          <DropdownMenuItem onClick={() => onSubmit(network)}>
            <Send />
            {t('network:table.submit')}
          </DropdownMenuItem>
        )}
        {canApprove && onPublish && (network.status === 'DRAFT' || network.status === 'REQUEST') && (
          <DropdownMenuItem onClick={() => onPublish(network)}>
            <Check />
            {t('network:table.publish')}
          </DropdownMenuItem>
        )}
        {canUnpublish && network.status === 'PUBLISHED' && onUnpublish && (
          <DropdownMenuItem onClick={() => onUnpublish(network)}>
            <Undo2 />
            {t('network:table.unpublish')}
          </DropdownMenuItem>
        )}
        {canUpdate && (
          <DropdownMenuItem onClick={() => onEdit(network)}>
            <Pencil />
            {t('network:table.edit')}
          </DropdownMenuItem>
        )}
        {canDelete && (
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(network)}>
            <Trash2 />
            {t('network:table.delete')}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface SelectAllCheckboxProps {
  checked: boolean | 'indeterminate'
  disabled: boolean
  busy: boolean
  onToggle: (checked: boolean) => void
  /** Bila diberi, nama aksesibel diambil dari `<label htmlFor={id}>` pemanggil. */
  id?: string
}

function SelectAllCheckbox({ checked, disabled, busy, onToggle, id }: SelectAllCheckboxProps) {
  const { t } = useTranslation()
  return (
    <span className="flex items-center gap-1">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onToggle(value === true)}
        disabled={disabled}
        aria-label={id ? undefined : t('network:bulk.selectAll')}
      />
      {busy && (
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
      )}
    </span>
  )
}

interface RowCheckboxProps {
  network: Network
  checked: boolean
  disabled: boolean
  onToggle: (checked: boolean) => void
}

function RowCheckbox({ network, checked, disabled, onToggle }: RowCheckboxProps) {
  const { t } = useTranslation()
  return (
    <Checkbox
      checked={checked}
      onCheckedChange={(value) => onToggle(value === true)}
      disabled={disabled}
      aria-label={t('network:bulk.selectRow', { name: network.name })}
    />
  )
}

export function NetworkTable({
  items,
  sortBy,
  sortOrder,
  onSort,
  searchTerm,
  onResetSearch,
  onEdit,
  onDelete,
  onSubmit,
  onPublish,
  onUnpublish,
  canUpdate = true,
  canDelete = true,
  canApprove = true,
  canUnpublish = true,
  selectedIds,
  onSelectionChange,
  allSelected,
  onToggleAll,
  isSelectingAll = false,
  isBulkPending = false,
  canBulkUpdate = true,
}: NetworkTableProps) {
  const { t } = useTranslation()
  const trimmedSearch = searchTerm?.trim() ?? ''
  const showActions = canUpdate || canDelete || canUnpublish || canApprove
  const someSelected = selectedIds.length > 0 && !allSelected
  const columnCount = (showActions ? 7 : 6) + (canBulkUpdate ? 1 : 0)

  function toggleRow(id: string, checked: boolean) {
    onSelectionChange(checked ? [...selectedIds, id] : selectedIds.filter((x) => x !== id))
  }

  const rowEnabled = !isSelectingAll && !isBulkPending

  return (
    <>
      <div className={cn('overflow-hidden rounded-xl border', items.length > 0 && 'max-md:hidden')}>
        <Table>
          <TableHeader>
            <TableRow>
              {canBulkUpdate && (
                <TableHead className="w-10">
                  <SelectAllCheckbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onToggle={onToggleAll}
                    disabled={isSelectingAll}
                    busy={isSelectingAll}
                  />
                </TableHead>
              )}
              <TableHead>
                <SortableHeader label={t('network:table.name')} field="name" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
              </TableHead>
              <TableHead>
                <SortableHeader label={t('network:table.ledBy')} field="ledBy" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
              </TableHead>
              <TableHead>
                <SortableHeader label={t('network:table.city')} field="city" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
              </TableHead>
              <TableHead>
                <SortableHeader label={t('network:table.country')} field="country" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
              </TableHead>
              <TableHead>
                <SortableHeader label={t('network:table.status')} field="status" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
              </TableHead>
              <TableHead>
                <SortableHeader label={t('network:table.created')} field="createdAt" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
              </TableHead>
              {showActions && <TableHead className="text-right">{t('common:table.actions')}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="h-24 text-center text-sm text-muted-foreground">
                  {trimmedSearch.length > 0 ? (
                    <>
                      {t('network:table.notFound', { term: trimmedSearch })}{' '}
                      {onResetSearch && (
                        <button
                          className="inline-flex items-center gap-1 underline"
                          onClick={onResetSearch}
                        >
                          <RotateCcw className="size-3.5" aria-hidden="true" />
                          {t('network:table.reset')}
                        </button>
                      )}
                    </>
                  ) : (
                    t('network:table.empty')
                  )}
                </TableCell>
              </TableRow>
            ) : (
              items.map((network) => (
                <TableRow key={network.id}>
                  {canBulkUpdate && (
                    <TableCell className="w-10">
                      <RowCheckbox
                        network={network}
                        checked={selectedIds.includes(network.id)}
                        disabled={!rowEnabled}
                        onToggle={(checked) => toggleRow(network.id, checked)}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">{network.name}</TableCell>
                  <TableCell>{network.ledBy ?? '—'}</TableCell>
                  <TableCell>{network.city?.name ?? '—'}</TableCell>
                  <TableCell>{network.country ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[network.status]}>
                      {t(`network:statusOptions.${network.status}`, { defaultValue: network.status })}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDateTime(network.createdAt)}</TableCell>
                  {showActions && (
                    <TableCell className="text-right">
                      <RowActions
                        network={network}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onSubmit={onSubmit}
                        onPublish={onPublish}
                        onUnpublish={onUnpublish}
                        canUpdate={canUpdate}
                        canDelete={canDelete}
                        canApprove={canApprove}
                        canUnpublish={canUnpublish}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {items.length > 0 && (
        <MobileSortChips
          options={[
            { field: 'name', label: t('network:table.name') },
            { field: 'ledBy', label: t('network:table.ledBy') },
            { field: 'city', label: t('network:table.city') },
            { field: 'country', label: t('network:table.country') },
            { field: 'status', label: t('network:table.status') },
            { field: 'createdAt', label: t('network:table.created') },
          ]}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={onSort}
        />
      )}

      {canBulkUpdate && items.length > 0 && (
        <div className="flex items-center gap-2 md:hidden">
          <SelectAllCheckbox
            id="network-select-all-mobile"
            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
            onToggle={onToggleAll}
            disabled={isSelectingAll}
            busy={isSelectingAll}
          />
          <label htmlFor="network-select-all-mobile" className="text-sm text-muted-foreground">
            {t('network:bulk.selectAll')}
          </label>
        </div>
      )}

      {items.length > 0 && (
        <MobileRecordList
          items={items.map((network) => ({
            id: network.id,
            title: network.name,
            leading: canBulkUpdate ? (
              <RowCheckbox
                network={network}
                checked={selectedIds.includes(network.id)}
                disabled={!rowEnabled}
                onToggle={(checked) => toggleRow(network.id, checked)}
              />
            ) : undefined,
            badge: (
              <Badge variant={STATUS_VARIANT[network.status]}>
                {t(`network:statusOptions.${network.status}`, { defaultValue: network.status })}
              </Badge>
            ),
            fields: [
              { label: t('network:table.ledBy'), value: network.ledBy ?? '—' },
              { label: t('network:table.city'), value: network.city?.name ?? '—' },
              { label: t('network:table.country'), value: network.country ?? '—' },
              { label: t('network:table.created'), value: formatDateTime(network.createdAt) },
            ],
            actions: showActions ? (
              <RowActions
                network={network}
                onEdit={onEdit}
                onDelete={onDelete}
                onSubmit={onSubmit}
                onPublish={onPublish}
                onUnpublish={onUnpublish}
                canUpdate={canUpdate}
                canDelete={canDelete}
                canApprove={canApprove}
                canUnpublish={canUnpublish}
              />
            ) : undefined,
          }))}
        />
      )}
    </>
  )
}
