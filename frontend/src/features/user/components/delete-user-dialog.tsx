import { Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
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

import type { User } from '../types'

export interface DeleteUserDialogProps {
  user: User
  isSubmitting: boolean
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
}

export function DeleteUserDialog({
  user,
  isSubmitting,
  onConfirm,
  onOpenChange,
}: DeleteUserDialogProps) {
  const { t } = useTranslation()
  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('user:delete.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('user:delete.description', { name: user.fullName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button type="button" variant="outline" disabled={isSubmitting}>
              <X data-icon="inline-start" className="size-4" />
              {t('common:actions.cancel')}
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              type="button"
              variant="destructive"
              disabled={isSubmitting}
              onClick={onConfirm}
            >
              <Trash2 data-icon="inline-start" className="size-4" />
              {isSubmitting ? t('common:actions.deleting') : t('common:actions.delete')}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
