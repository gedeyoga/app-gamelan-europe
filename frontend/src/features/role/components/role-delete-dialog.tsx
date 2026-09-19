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

import type { ApiError } from '@/lib/api-client'

import type { Role } from '../types'

export interface RoleDeleteDialogProps {
  role: Role
  isPending: boolean
  error: ApiError | null
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
}

export function RoleDeleteDialog({ role, isPending, error, onConfirm, onOpenChange }: RoleDeleteDialogProps) {
  const { t } = useTranslation()
  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('role:delete.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('role:delete.description', { name: role.name })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <div role="alert" className="text-sm text-destructive">
            {error.statusCode === 409
              ? t('role:delete.conflict')
              : error.message}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button type="button" variant="outline" disabled={isPending}>
              <X data-icon="inline-start" className="size-4" />
              {t('common:actions.cancel')}
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={onConfirm}
            >
              <Trash2 data-icon="inline-start" className="size-4" />
              {isPending ? t('common:actions.deleting') : t('common:actions.delete')}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
