import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { UseFormReturn } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'

import { CategoryCombobox } from '@/components/shared/category-combobox'
import { GalleryUpload } from './gallery-upload'
import { ThumbnailUpload } from '@/components/shared/thumbnail-upload'
import type { StoryFormValues } from '../lib/schema'
import { VISIBILITIES } from '../types'
import type { StoryCategory, UploadedImage } from '../types'

export interface StoryMetaPanelProps {
  form: UseFormReturn<StoryFormValues>
  slugTouched: boolean
  onNameChange: (value: string) => void
  onSlugTouched: () => void
  onGenerateSlug: () => void
  thumbnail: string | null
  thumbnailPreviewUrl: string | null
  isUploadingThumbnail: boolean
  thumbnailError: string | null
  onUploadThumbnail: (file: File) => void
  onRemoveThumbnail: () => void
  galleryImages: UploadedImage[]
  onChangeGallery: (next: UploadedImage[]) => void
  onUploadGalleryImage: (file: File) => void
  isUploadingGallery: boolean
  galleryError: string | null
  flyerImages: UploadedImage[]
  onChangeFlyer: (next: UploadedImage[]) => void
  onUploadFlyerImage: (file: File) => void
  isUploadingFlyer: boolean
  flyerError: string | null
  categories: StoryCategory[]
  isLoadingCategories: boolean
  canReadCategories: boolean
  canCreateCategory: boolean
  onCreateCategory: (name: string) => Promise<StoryCategory | undefined>
  disabled?: boolean
  className?: string
}

export function StoryMetaPanel({
  form,
  slugTouched,
  onNameChange,
  onSlugTouched,
  onGenerateSlug,
  thumbnail,
  thumbnailPreviewUrl,
  isUploadingThumbnail,
  thumbnailError,
  onUploadThumbnail,
  onRemoveThumbnail,
  galleryImages,
  onChangeGallery,
  onUploadGalleryImage,
  isUploadingGallery,
  galleryError,
  flyerImages,
  onChangeFlyer,
  onUploadFlyerImage,
  isUploadingFlyer,
  flyerError,
  categories,
  isLoadingCategories,
  canReadCategories,
  canCreateCategory,
  onCreateCategory,
  disabled = false,
  className,
}: StoryMetaPanelProps) {
  const { t } = useTranslation()

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('story:form.titleLabel')}</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder={t('story:form.titlePlaceholder')}
                onChange={(event) => {
                  field.onChange(event)
                  onNameChange(event.target.value)
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="slug"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('story:form.slugLabel')}</FormLabel>
            <div className="flex gap-2">
              <FormControl>
                <Input
                  {...field}
                  placeholder={t('story:form.slugPlaceholder')}
                  onChange={(event) => {
                    onSlugTouched()
                    field.onChange(event)
                  }}
                />
              </FormControl>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={onGenerateSlug}
                aria-label={t('story:form.slugGenerate')}
                title={t('story:form.slugGenerate')}
              >
                <RefreshCw className="size-4" />
              </Button>
            </div>
            {slugTouched && (
              <p className="text-xs text-muted-foreground">{t('story:form.slugManualHint')}</p>
            )}
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="visibility"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('story:form.visibility')}</FormLabel>
            <FormControl>
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                disabled={disabled}
                aria-label={t('story:form.visibility')}
                className="flex flex-wrap gap-4"
              >
                {VISIBILITIES.map((value) => (
                  <FormItem key={value} className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <RadioGroupItem value={value} />
                    </FormControl>
                    <FormLabel className="font-normal">
                      {t(`story:visibilityOptions.${value}`)}
                    </FormLabel>
                  </FormItem>
                ))}
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="categoryIds"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('story:form.categories')}</FormLabel>
            <CategoryCombobox
              options={categories}
              value={field.value}
              onChange={field.onChange}
              isLoading={isLoadingCategories}
              disabled={!canReadCategories}
              canCreate={canCreateCategory}
              onCreate={onCreateCategory}
            />
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="thumbnail"
        render={() => (
          <FormItem>
            <FormLabel>{t('story:form.thumbnail')}</FormLabel>
            <ThumbnailUpload
              value={thumbnail}
              previewUrl={thumbnailPreviewUrl}
              isUploading={isUploadingThumbnail}
              error={thumbnailError}
              disabled={disabled}
              onUpload={onUploadThumbnail}
              onRemove={onRemoveThumbnail}
            />
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">{t('story:gallery.title')}</label>
        <GalleryUpload
          value={galleryImages}
          onChange={onChangeGallery}
          onUpload={onUploadGalleryImage}
          isUploading={isUploadingGallery}
          error={galleryError}
          disabled={disabled}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">{t('story:flyer.title')}</label>
        <GalleryUpload
          i18nPrefix="flyer"
          value={flyerImages}
          onChange={onChangeFlyer}
          onUpload={onUploadFlyerImage}
          isUploading={isUploadingFlyer}
          error={flyerError}
          disabled={disabled}
        />
      </div>
    </div>
  )
}
