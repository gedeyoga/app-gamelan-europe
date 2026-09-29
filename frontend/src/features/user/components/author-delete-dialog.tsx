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
import type { UserOption } from '@/components/shared/user-combobox'
import { getApiErrorMessage, isValidationError, toastError, toastSuccess } from '@/lib/toast'

import { useDeleteUser } from '../hooks/use-delete-user'

export interface AuthorDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `null` saat tertutup. */
  author: UserOption | null
  onDeleted: (authorId: string) => void
}

function labelOf(author: UserOption): string {
  return author.fullName.trim() || author.email?.trim() || author.id
}

/**
 * Konfirmasi hapus author dari field author (story/event/archive).
 * Menghapus user **dan** semua konten di mana ia terdaftar sebagai author
 * (`DELETE /users/:id?cascadeContent=true`) — destruktif, tanpa undo.
 */
export function AuthorDeleteDialog({
  open,
  onOpenChange,
  author,
  onDeleted,
}: AuthorDeleteDialogProps) {
  const { t } = useTranslation()
  const deleteUser = useDeleteUser()

  function handleConfirm() {
    if (!author) return
    deleteUser.mutate(
      { id: author.id, options: { cascadeContent: true } },
      {
        onSuccess: () => {
          onDeleted(author.id)
          onOpenChange(false)
          toastSuccess(t('user:toast.deleted'))
        },
        onError: (err: unknown) => {
          if (isValidationError(err)) return
          toastError(getApiErrorMessage(err, t('user:toast.deleteFailed')))
        },
      },
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('user:deleteAuthor.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('user:deleteAuthor.description', { name: author ? labelOf(author) : '' })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button type="button" variant="outline" disabled={deleteUser.isPending}>
              <X data-icon="inline-start" className="size-4" />
              {t('common:actions.cancel')}
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteUser.isPending}
              onClick={handleConfirm}
            >
              <Trash2 data-icon="inline-start" className="size-4" />
              {deleteUser.isPending ? t('common:actions.deleting') : t('common:actions.delete')}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
