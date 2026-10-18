import { useId, useState } from 'react'

import { DateTimePicker } from '@/components/shared/date-time-picker'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
  /** Dipanggil dengan ISO 8601 (UTC) + pilihan notifikasi email setelah konfirmasi. */
  onConfirm: (publishedAt: string, notify: boolean) => void
  isPending?: boolean
  title: string
  description: string
  dateLabel: string
  datePlaceholder: string
  /** Label tombol utama pada langkah pertama (jadwal). Default: `confirmLabel`. */
  nextLabel?: string
  /** Judul langkah konfirmasi. Kosong → dialog satu langkah. */
  confirmTitle?: string
  /** Deskripsi langkah konfirmasi. */
  confirmDescription?: string
  confirmLabel: string
  cancelLabel: string
  /** Bila diisi, baris checkbox notifikasi email dirender. */
  notifyLabel?: string
  /** Default status checkbox notifikasi email (default `false` = tidak tercentang). */
  notifyDefaultValue?: boolean
  /** ISO 8601 (UTC); nilai awal tiap dialog dibuka. Kosong → tombol konfirmasi nonaktif. */
  defaultValue?: string
  className?: string
}

type PublishScheduleDialogContentProps = Omit<
  PublishScheduleDialogProps,
  'open' | 'onOpenChange' | 'className'
> & { onClose: () => void }

// Body dirender sebagai child `DialogContent`; Radix meng-unmount konten saat tertutup sehingga
// state nilai otomatis reset ke `defaultValue` tiap dialog dibuka.
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
  notifyLabel,
  notifyDefaultValue = false,
}: PublishScheduleDialogContentProps) {
  const dateId = useId()
  const notifyId = useId()
  const [value, setValue] = useState<string | undefined>(defaultValue)
  const [notify, setNotify] = useState(notifyDefaultValue)
  const [step, setStep] = useState<'schedule' | 'confirm'>('schedule')

  function handleConfirm() {
    if (!value) return
    onConfirm(value, notify)
  }

  const isConfirmStep = step === 'confirm'
  const activeDescription = isConfirmStep ? confirmDescription : description

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isConfirmStep ? confirmTitle : title}</DialogTitle>
        {activeDescription && <DialogDescription>{activeDescription}</DialogDescription>}
      </DialogHeader>

      {step === 'schedule' && (
        <>
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

          {notifyLabel && (
            <div className="flex items-center gap-2">
              <Checkbox
                id={notifyId}
                checked={notify}
                onCheckedChange={(checked) => setNotify(checked === true)}
                disabled={isPending}
              />
              <label htmlFor={notifyId} className="text-sm font-medium">
                {notifyLabel}
              </label>
            </div>
          )}
        </>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={onClose}>
          {cancelLabel}
        </Button>
        {!isConfirmStep ? (
          <Button
            type="button"
            size="sm"
            disabled={isPending || !value}
            onClick={() => (confirmTitle ? setStep('confirm') : handleConfirm())}
          >
            {nextLabel ?? confirmLabel}
          </Button>
        ) : (
          <Button type="button" size="sm" disabled={isPending} onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        )}
      </DialogFooter>
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
