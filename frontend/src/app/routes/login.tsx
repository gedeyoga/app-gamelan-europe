import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

import { LoginForm } from '@/features/auth/components/LoginForm'

export function LoginPage() {
  const { t } = useTranslation('auth')
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t('login.title')}</CardTitle>
          <CardDescription>
            {t('login.descriptionPrefix')}{' '}
            <Link to="/register" className="text-primary hover:underline">
              {t('login.descriptionLink')}
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  )
}
