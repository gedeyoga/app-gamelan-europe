import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

import { RegisterForm } from '@/features/auth/components/RegisterForm'

export function RegisterPage() {
  const { t } = useTranslation('auth')
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t('register.title')}</CardTitle>
          <CardDescription>
            {t('register.descriptionPrefix')}{' '}
            <Link to="/login" className="text-primary hover:underline">
              {t('register.descriptionLink')}
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RegisterForm />
        </CardContent>
      </Card>
    </main>
  )
}
