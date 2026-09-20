import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toastError, toastSuccess } from '@/lib/toast'

export interface ApiKeyCreatedDialogProps {
  open: boolean
  apiKeyName: string
  /** Raw key — hanya tersedia sekali dari response create. */
  rawKey: string
  onOpenChange: (open: boolean) => void
}

/**
 * Dialog copy-once: menampilkan raw key sekali.
 * Setelah 1x klik Copy tombol disabled ("Tersalin"). Menutup dialog membuang
 * raw key dari state container — tidak bisa ditampilkan lagi.
 */
export function ApiKeyCreatedDialog({
  open,
  apiKeyName,
  rawKey,
  onOpenChange,
}: ApiKeyCreatedDialogProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(rawKey)
      setCopied(true)
      toastSuccess(t('api-key:created.copiedToast'))
    } catch {
      toastError(t('common:toast.errorDefault'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t('api-key:created.title')}</DialogTitle>
          <DialogDescription>{t('api-key:created.description', { name: apiKeyName })}</DialogDescription>
        </DialogHeader>

        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {t('api-key:created.warning')}
        </div>

        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={rawKey}
            onFocus={(event) => event.target.select()}
            className="font-mono text-xs"
            aria-label={t('api-key:created.keyLabel')}
          />
          <Button type="button" variant="outline" onClick={handleCopy} disabled={copied}>
            {copied ? (
              <Check data-icon="inline-start" className="size-4" />
            ) : (
              <Copy data-icon="inline-start" className="size-4" />
            )}
            {copied ? t('api-key:created.copied') : t('api-key:created.copy')}
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            {t('api-key:created.done')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
