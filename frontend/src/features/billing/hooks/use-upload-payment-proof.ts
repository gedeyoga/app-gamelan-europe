import { useMutation } from '@tanstack/react-query'

import { uploadPaymentProof } from '../api/upload-payment-proof'

// Bukti belum terikat billing sampai simpan — jangan invalidate list.
export function useUploadPaymentProof() {
  return useMutation({
    mutationFn: uploadPaymentProof,
  })
}
