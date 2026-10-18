import { zodResolver } from '@hookform/resolvers/zod'
import { Save, X } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useForm, type FieldPath } from 'react-hook-form'
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
import { Form } from '@/components/ui/form'
import { ApiError, isValidationError } from '@/lib/api-client'
import { mapApiFieldErrors } from '@/lib/field-errors'
import { getApiErrorMessage, toastError, toastSuccess } from '@/lib/toast'

import { useCreateNetwork } from '../hooks/use-create-network'
import { buildNetworkPayload } from '../lib/payload'
import { createNetworkSchema, EMPTY_NETWORK_VALUES, type NetworkFormValues } from '../lib/schema'
import { NetworkMetaPanel } from './network-meta-panel'

export interface NetworkCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (network: { id: string; name: string }) => void
  /** Override judul dialog. Default: network:form.createTitle. */
  title?: string
  /** Override deskripsi dialog. Default: network:form.createDescription. */
  description?: string
}

/**
 * Dialog create network reusable (mis. field penyelenggara event).
 * Memakai `NetworkMetaPanel` (bukan `NetworkForm` full-page) + `buildNetworkPayload`;
 * konten rich HTML diabaikan karena opsional.
 */
export function NetworkCreateDialog({
  open,
  onOpenChange,
  onCreated,
  title,
  description,
}: NetworkCreateDialogProps) {
  return (
    <>
      {/* Mount kondisional agar `useForm` + mutation di anak re-init bersih tiap dibuka. */}
      {open && (
        <NetworkCreateDialogContent
          onOpenChange={onOpenChange}
          onCreated={onCreated}
          title={title}
          description={description}
        />
      )}
    </>
  )
}

type NetworkCreateDialogContentProps = Omit<NetworkCreateDialogProps, 'open'>

function NetworkCreateDialogContent({
  onOpenChange,
  onCreated,
  title,
  description,
}: NetworkCreateDialogContentProps) {
  const { t } = useTranslation()
  const schema = useMemo(() => createNetworkSchema(t), [t])
  const form = useForm<NetworkFormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_NETWORK_VALUES,
  })
  const createNetwork = useCreateNetwork()

  // 422 -> per-field via setError; tanpa toast, tanpa banner.
  useEffect(() => {
    if (!isValidationError(createNetwork.error)) return
    form.clearErrors()
    for (const [field, message] of Object.entries(mapApiFieldErrors(createNetwork.error))) {
      form.setError(field as FieldPath<NetworkFormValues>, { type: 'server', message })
    }
  }, [createNetwork.error, form])

  // Banner global hanya untuk error non-422.
  const globalMessage =
    createNetwork.error instanceof ApiError && createNetwork.error.statusCode !== 422
      ? createNetwork.error.message
      : null

  function handleSubmit(values: NetworkFormValues) {
    createNetwork.mutate(buildNetworkPayload(values), {
      onSuccess: (created) => {
        onCreated({ id: created.id, name: created.name })
        onOpenChange(false)
        toastSuccess(t('network:toast.created'))
      },
      onError: (err: unknown) => {
        // 422 mengalir ke form via mutation error -> per-field; dialog tetap terbuka, tanpa toast.
        if (isValidationError(err)) return
        toastError(getApiErrorMessage(err, t('network:toast.createFailed')))
      },
    })
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title ?? t('network:form.createTitle')}</DialogTitle>
          <DialogDescription>
            {description ?? t('network:form.createDescription')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="network-create-form"
            onSubmit={(event) => {
              // Dialog diportal, tapi event React tetap bubble ke <form> induk (editor event)
              // → hentikan agar form konten tidak ikut tersubmit.
              event.stopPropagation()
              void form.handleSubmit(handleSubmit)(event)
            }}
            className="space-y-4"
          >
            {globalMessage && (
              <p
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {globalMessage}
              </p>
            )}

            <NetworkMetaPanel
              form={form}
              disabled={createNetwork.isPending}
              showSubmitter={false}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={createNetwork.isPending}
            onClick={() => onOpenChange(false)}
          >
            <X data-icon="inline-start" className="size-4" />
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form="network-create-form" disabled={createNetwork.isPending}>
            <Save data-icon="inline-start" className="size-4" />
            {createNetwork.isPending ? t('common:actions.saving') : t('common:actions.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
