import { useMutation } from '@tanstack/react-query'

import { uploadImage } from '../api/images'

// Upload gambar belum terikat post sampai simpan — jangan invalidate list story.
export function useUploadImage() {
  return useMutation({
    mutationFn: uploadImage,
  })
}
