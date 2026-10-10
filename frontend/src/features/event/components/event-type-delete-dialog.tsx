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
import { getApiErrorMessage, isValidationError, toastError, toastSuccess } from '@/lib/toast'

import { useDeleteEventType } from '../hooks/use-delete-event-type'
import type { EventType } from '../types'

export interface EventTypeDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `null` saat tertutup. */
  eventType: EventType | null
  onDeleted: (eventTypeId: string) => void
}

/**
 * Konfirmasi hapus tipe event dari combobox.
 * Destruktif, tanpa undo — tipe dihapus dari semua event terkait.
 */
export function EventTypeDeleteDialog({
  open,
  onOpenChange,
  eventType,
  onDeleted,
}: EventTypeDeleteDialogProps) {
  const { t } = useTranslation()
  const deleteEventType = useDeleteEventType()

  function handleConfirm() {
    if (!eventType) return
    deleteEventType.mutate(eventType.id, {
      onSuccess: () => {
        onDeleted(eventType.id)
        onOpenChange(false)
        toastSuccess(t('event:toast.eventTypeDeleted'))
      },
      onError: (err: unknown) => {
        if (isValidationError(err)) return
        toastError(getApiErrorMessage(err, t('event:toast.eventTypeDeleteFailed')))
      },
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('event:deleteEventType.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('event:deleteEventType.description', { name: eventType?.name ?? '' })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button type="button" variant="outline" disabled={deleteEventType.isPending}>
              <X data-icon="inline-start" className="size-4" />
              {t('common:actions.cancel')}
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteEventType.isPending}
              onClick={handleConfirm}
            >
              <Trash2 data-icon="inline-start" className="size-4" />
              {deleteEventType.isPending
                ? t('common:actions.deleting')
                : t('common:actions.delete')}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
