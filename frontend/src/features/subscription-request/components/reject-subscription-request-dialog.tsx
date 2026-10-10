import { X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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

export interface RejectSubscriptionRequestDialogProps {
  name: string
  isSubmitting: boolean
  onConfirm: (note: string) => void
  onOpenChange: (open: boolean) => void
}

// Dialog tolak request langganan + catatan opsional (tanpa validasi wajib).
export function RejectSubscriptionRequestDialog({
  name,
  isSubmitting,
  onConfirm,
  onOpenChange,
}: RejectSubscriptionRequestDialogProps) {
  const { t } = useTranslation('subscriptionRequest')
  const [note, setNote] = useState('')

  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('rejectDialog.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('rejectDialog.description', { name })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="subscription-request-reject-note">
            {t('rejectDialog.noteLabel')}
          </Label>
          <Textarea
            id="subscription-request-reject-note"
            rows={3}
            value={note}
            disabled={isSubmitting}
            placeholder={t('rejectDialog.notePlaceholder')}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>

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
              onClick={() => onConfirm(note.trim())}
            >
              <X data-icon="inline-start" className="size-4" />
              {isSubmitting ? t('common:actions.saving') : t('rejectDialog.confirm')}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
