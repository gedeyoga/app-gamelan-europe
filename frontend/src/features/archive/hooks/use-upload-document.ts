import { useMutation } from '@tanstack/react-query'

import { uploadDocument } from '../api/documents'

// Dokumen belum terikat archive sampai simpan — jangan invalidate list archive.
export function useUploadDocument() {
  return useMutation({
    mutationFn: uploadDocument,
  })
}
