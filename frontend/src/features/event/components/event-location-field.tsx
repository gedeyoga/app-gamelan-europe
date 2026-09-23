import { useTranslation } from 'react-i18next'
import type { UseFormReturn } from 'react-hook-form'

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { LocationMapPicker } from '@/components/shared/location-map-picker'
import { cn } from '@/lib/utils'

import type { EventFormValues } from '../lib/schema'

export interface EventLocationFieldProps {
  form: UseFormReturn<EventFormValues>
  disabled?: boolean
  className?: string
}

// Lokasi event (wajib): name + address + map. Satu event = satu lokasi.
export function EventLocationField({
  form,
  disabled = false,
  className,
}: EventLocationFieldProps) {
  const { t } = useTranslation()
  const lat = form.watch('location.lat')
  const lng = form.watch('location.lng')
  const address = form.watch('location.address')

  function handlePick(nextLat: string, nextLng: string) {
    form.setValue('location.lat', nextLat, { shouldDirty: true })
    form.setValue('location.lng', nextLng, { shouldDirty: true })
  }

  function handleAddressChange(nextAddress: string) {
    form.setValue('location.address', nextAddress, { shouldDirty: true })
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <FormField
        control={form.control}
        name="location.name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('event:location.nameLabel')}</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder={t('event:location.namePlaceholder')}
                disabled={disabled}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="location.address"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('event:location.addressLabel')}</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder={t('event:location.addressPlaceholder')}
                disabled={disabled}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">{t('event:location.mapLabel')}</label>
        <LocationMapPicker
          lat={lat}
          lng={lng}
          address={address}
          onChange={handlePick}
          onAddressChange={handleAddressChange}
          disabled={disabled}
        />
      </div>
    </div>
  )
}
