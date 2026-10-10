import { Ban, X } from 'lucide-react'
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

import type { MemberSubscription } from '../types'

export interface CancelBillingDialogProps {
  member: MemberSubscription
  isSubmitting: boolean
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
}

export function CancelBillingDialog({
  member,
  isSubmitting,
  onConfirm,
  onOpenChange,
}: CancelBillingDialogProps) {
  const { t } = useTranslation()
  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('billing:cancel.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('billing:cancel.description', { name: member.user.fullName })}
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
              <Ban data-icon="inline-start" className="size-4" />
              {isSubmitting ? t('common:actions.saving') : t('billing:cancel.confirm')}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
