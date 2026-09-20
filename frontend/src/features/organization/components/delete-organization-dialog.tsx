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

import type { Organization } from '../types'

export interface DeleteOrganizationDialogProps {
  organization: Organization
  isSubmitting: boolean
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
}

export function DeleteOrganizationDialog({
  organization,
  isSubmitting,
  onConfirm,
  onOpenChange,
}: DeleteOrganizationDialogProps) {
  const { t } = useTranslation()
  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('organization:delete.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('organization:delete.description', { name: organization.name })}
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
