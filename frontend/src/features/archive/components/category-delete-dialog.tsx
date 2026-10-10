import { Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

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
import { Button } from '@/components/ui/button'
import type { CategoryOption } from '@/components/shared/category-combobox'
import { getApiErrorMessage, isValidationError, toastError, toastSuccess } from '@/lib/toast'

import { useDeleteCategory } from '../hooks/use-delete-category'

export interface CategoryDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `null` saat tertutup. */
  category: CategoryOption | null
  onDeleted: (categoryId: string) => void
}

/**
 * Konfirmasi hapus kategori Archive dari combobox.
 * Destruktif, tanpa undo — kategori dihapus dari semua arsip terkait.
 */
export function CategoryDeleteDialog({
  open,
  onOpenChange,
  category,
  onDeleted,
}: CategoryDeleteDialogProps) {
  const { t } = useTranslation()
  const deleteCategory = useDeleteCategory()

  function handleConfirm() {
    if (!category) return
    deleteCategory.mutate(category.id, {
      onSuccess: () => {
        onDeleted(category.id)
        onOpenChange(false)
        toastSuccess(t('archive:toast.categoryDeleted'))
      },
      onError: (err: unknown) => {
        if (isValidationError(err)) return
        toastError(getApiErrorMessage(err, t('archive:toast.categoryDeleteFailed')))
      },
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('archive:deleteCategory.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('archive:deleteCategory.description', { name: category?.name ?? '' })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button type="button" variant="outline" disabled={deleteCategory.isPending}>
              <X data-icon="inline-start" className="size-4" />
              {t('common:actions.cancel')}
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteCategory.isPending}
              onClick={handleConfirm}
            >
              <Trash2 data-icon="inline-start" className="size-4" />
              {deleteCategory.isPending ? t('common:actions.deleting') : t('common:actions.delete')}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
