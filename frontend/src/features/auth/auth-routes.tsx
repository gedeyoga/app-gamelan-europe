import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from './auth-provider'

function AuthLoading() {
  const { t } = useTranslation('auth')
  return (
    <div className="flex min-h-svh items-center justify-center">
      <p className="text-sm text-muted-foreground">{t('loading')}</p>
    </div>
  )
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status, isAuthenticated } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <AuthLoading />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}

export function GuestRoute({ children }: { children: ReactNode }) {
  const { status, isAuthenticated } = useAuth()

  if (status === 'loading') {
    return <AuthLoading />
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
