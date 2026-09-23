import { useMutation } from '@tanstack/react-query'

import { uploadImage } from '../api/images'

// Upload gambar belum terikat archive sampai simpan — jangan invalidate list archive.
export function useUploadImage() {
  return useMutation({
    mutationFn: uploadImage,
  })
}
