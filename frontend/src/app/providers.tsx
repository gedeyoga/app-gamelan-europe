import { Suspense } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { RouterProvider } from 'react-router-dom'

import { AuthProvider } from '@/features/auth/auth-provider'
import i18n from '@/i18n'
import { queryClient } from '@/lib/query-client'
import { Toaster } from '@/components/ui/sonner'
import { router } from './routes'

export function Providers() {
  return (
    <I18nextProvider i18n={i18n}>
      <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Loading... / Memuat...</p>}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
          <Toaster richColors position="top-right" />
        </QueryClientProvider>
      </Suspense>
    </I18nextProvider>
  )
}
