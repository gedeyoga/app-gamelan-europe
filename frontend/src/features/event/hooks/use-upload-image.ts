import { useMutation } from '@tanstack/react-query'

import { uploadImage } from '../api/images'

// Upload gambar belum terikat event sampai simpan — jangan invalidate list event.
export function useUploadImage() {
  return useMutation({
    mutationFn: uploadImage,
  })
}
