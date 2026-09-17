import { useAuth } from '@/features/auth/auth-provider'
import { useAuthPermissions } from '@/features/auth/hooks/use-permissions'
import { useLogout } from '@/features/auth/hooks/useLogout'
import { AppShell } from '@/features/dashboard/components/app-shell'

export function DashboardLayout() {
  const { user } = useAuth()
  const { can } = useAuthPermissions()
  const logoutMutation = useLogout()

  function handleLogout() {
    logoutMutation.mutate()
  }

  return <AppShell user={user} onLogout={handleLogout} can={can} />
}
