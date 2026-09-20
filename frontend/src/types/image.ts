export type ImageVariantName = 'large' | 'medium' | 'thumbnail'

export interface ImageVariant {
  name: ImageVariantName
  url: string
  key: string
  width: number
  height: number
  size: number
  mimeType: string
}

export interface UploadedImage {
  id: string
  url: string
  key: string
  filename: string
  mimeType: string | null
  size: number
  width: number
  height: number
  variants: ImageVariant[]
}
