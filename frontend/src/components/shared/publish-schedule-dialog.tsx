import { useId, useState } from 'react'

import { DateTimePicker } from '@/components/shared/date-time-picker'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface PublishScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Dipanggil dengan ISO 8601 (UTC) setelah konfirmasi. */
  onConfirm: (publishedAt: string) => void
  isPending?: boolean
  title: string
  description: string
  dateLabel: string
  datePlaceholder: string
  nextLabel: string
  confirmTitle: string
  confirmDescription: string
  confirmLabel: string
  cancelLabel: string
  /** ISO 8601 (UTC); nilai awal tiap dialog dibuka. Kosong → tombol "Lanjut" nonaktif. */
  defaultValue?: string
  className?: string
}

type PublishScheduleDialogContentProps = Omit<
  PublishScheduleDialogProps,
  'open' | 'onOpenChange' | 'className'
> & { onClose: () => void }

// Body dirender sebagai child `DialogContent`; Radix meng-unmount konten saat tertutup sehingga
// state langkah/nilai otomatis reset ke langkah 1 tiap dialog dibuka.
function PublishScheduleDialogContent({
  defaultValue,
  isPending = false,
  onConfirm,
  onClose,
  title,
  description,
  dateLabel,
  datePlaceholder,
  nextLabel,
  confirmTitle,
  confirmDescription,
  confirmLabel,
  cancelLabel,
}: PublishScheduleDialogContentProps) {
  const dateId = useId()
  const [step, setStep] = useState<'date' | 'confirm'>('date')
  const [value, setValue] = useState<string | undefined>(defaultValue)

  function handleConfirm() {
    if (!value) return
    onConfirm(value)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <label htmlFor={dateId} className="text-sm font-medium">
          {dateLabel}
        </label>
        <DateTimePicker
          id={dateId}
          value={value}
          onChange={setValue}
          placeholder={datePlaceholder}
          disabled={isPending}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isPending || !value}
          onClick={() => setStep('confirm')}
        >
          {nextLabel}
        </Button>
      </DialogFooter>

      <AlertDialog open={step === 'confirm'} onOpenChange={(open) => !open && setStep('date')}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>{cancelLabel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(event) => {
                // Tahan dialog konfirmasi tetap terbuka selama mutation `isPending`;
                // parent menutup dialog saat sukses (via `open`).
                event.preventDefault()
                handleConfirm()
              }}
            >
              {confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function PublishScheduleDialog({
  open,
  onOpenChange,
  className,
  ...content
}: PublishScheduleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={className}>
        <PublishScheduleDialogContent {...content} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}
