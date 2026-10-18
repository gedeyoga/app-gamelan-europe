import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, ShieldAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-provider'
import { useSession } from '@/features/auth/hooks/useSession'
import { isForbiddenError } from '@/features/auth/lib/permissions'
import {
  ProfileCard,
  type ProfileFormValues,
} from '@/features/profile/components/profile-card'
import { useChangePassword } from '@/features/profile/hooks/use-change-password'
import { useUpdateProfile } from '@/features/profile/hooks/use-update-profile'
import { useUploadImage } from '@/features/profile/hooks/use-upload-image'
import { NotificationPreferencesCard } from '@/features/notification/components/notification-preferences-card'
import { useNotificationPreferences } from '@/features/notification/hooks/use-notification-preferences'
import { useUpdateNotificationPreference } from '@/features/notification/hooks/use-update-notification-preference'
import type { NotificationType } from '@/features/notification/types'
import { getApiErrorMessage, isValidationError, toastError, toastSuccess } from '@/lib/toast'

export function ProfilePage() {
  const { t } = useTranslation('profile')
  const auth = useAuth()
  const navigate = useNavigate()
  const session = useSession(auth.user ?? undefined)
  const updateProfile = useUpdateProfile()
  const changePassword = useChangePassword()
  const uploadImage = useUploadImage()
  const notificationPreferences = useNotificationPreferences()
  const updateNotificationPreference = useUpdateNotificationPreference()

  // Counter increment → trigger ProfileCard reset form.
  const [resetSignal, setResetSignal] = useState(0)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  const isPending = updateProfile.isPending || changePassword.isPending
  const submissionError = updateProfile.error ?? changePassword.error

  function handleSubmit(values: ProfileFormValues) {
    // Step 1: update profile SELALU dipanggil (nama + email).
    updateProfile.mutate(
      { fullName: values.fullName, email: values.email },
      {
        onSuccess: () => {
          if (values.changePassword) {
            // Step 2: changePassword hanya jika user centang checkbox.
            changePassword.mutate(
              {
                currentPassword: values.currentPassword,
                newPassword: values.newPassword,
                confirmPassword: values.confirmPassword,
              },
              {
                onSuccess: () => {
                  // BE revoke refresh family → paksa logout agar user tahu harus login ulang.
                  setResetSignal((prev) => prev + 1)
                  toastSuccess(t('toast.profileUpdated'))
                  auth.logout()
                  navigate('/login', { replace: true })
                  toastSuccess(t('toast.passwordChanged'))
                },
                onError: (err: unknown) => {
                  if (isValidationError(err)) return
                  toastError(getApiErrorMessage(err, t('toast.changePasswordFailed')))
                },
              },
            )
            return
          }
          // Hanya update profile — reset form, toast sukses.
          setResetSignal((prev) => prev + 1)
          toastSuccess(t('toast.profileUpdated'))
        },
        onError: (err: unknown) => {
          if (isValidationError(err)) return
          toastError(getApiErrorMessage(err, t('toast.updateProfileFailed')))
        },
      },
    )
  }

  function saveAvatar(avatar: string | null) {
    updateProfile.mutate(
      { avatar },
      {
        onSuccess: () => toastSuccess(t('toast.avatarUpdated')),
        onError: (err: unknown) => {
          if (isValidationError(err)) return
          toastError(getApiErrorMessage(err, t('toast.avatarUpdateFailed')))
        },
      },
    )
  }

  async function handleAvatarUpload(file: File) {
    setAvatarError(null)
    try {
      // BE membalas profil lengkap + `avatar` — cache & AuthProvider di-update di hook.
      await uploadImage.mutateAsync(file)
      toastSuccess(t('toast.avatarUpdated'))
    } catch (err) {
      if (isValidationError(err)) {
        setAvatarError(t('thumbnail.uploadInvalid'))
        return
      }
      toastError(getApiErrorMessage(err, t('toast.avatarUpdateFailed')))
    }
  }

  function handleAvatarRemove() {
    setAvatarError(null)
    saveAvatar(null)
  }

  function handleNotificationToggle(type: NotificationType, emailEnabled: boolean) {
    updateNotificationPreference.mutate(
      { type, emailEnabled },
      {
        onSuccess: () => toastSuccess(t('notification:toast.preferenceUpdated')),
        onError: (err: unknown) => {
          if (isValidationError(err)) return
          toastError(getApiErrorMessage(err, t('notification:toast.preferenceUpdateFailed')))
        },
      },
    )
  }

  const user = session.data ?? auth.user

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {session.isError ? (
        isForbiddenError(session.error) ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
            <ShieldAlert className="size-6 text-destructive" />
            <p className="text-sm font-medium">{t('common:forbidden.title')}</p>
          </div>
        ) : (
          <div
            role="alert"
            className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            <span>{t('errors.loadProfile')}</span>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-destructive"
              onClick={() => void session.refetch()}
            >
              <RefreshCw data-icon="inline-start" className="size-4" />
              {t('common:actions.retry')}
            </Button>
          </div>
        )
      ) : user ? (
        <div className="flex flex-col gap-4">
          <ProfileCard
            user={user}
            isLoading={session.isPending && !session.data}
            isPending={isPending}
            submissionError={submissionError}
            onSubmit={handleSubmit}
            resetSignal={resetSignal}
            avatar={user.avatar ?? null}
            isUploadingAvatar={uploadImage.isPending}
            avatarError={avatarError}
            onAvatarUpload={(file) => void handleAvatarUpload(file)}
            onAvatarRemove={handleAvatarRemove}
          />
          <NotificationPreferencesCard
            items={notificationPreferences.data ?? []}
            isLoading={notificationPreferences.isPending}
            isError={notificationPreferences.isError}
            pendingType={
              updateNotificationPreference.isPending
                ? (updateNotificationPreference.variables?.type ?? null)
                : null
            }
            onToggle={handleNotificationToggle}
            onRetry={() => void notificationPreferences.refetch()}
          />
        </div>
      ) : null}
    </div>
  )
}