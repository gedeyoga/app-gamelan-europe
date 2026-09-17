import { Home, Shield, Users } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { LanguageSwitcher } from '@/components/shared/language-switcher'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'

import { AppSidebar, type NavItem } from './app-sidebar'
import type { SidebarUserInfo } from './sidebar-user'
import { ThemeToggle } from './theme-toggle'
import { useTheme } from '../hooks/use-theme'

interface AppShellProps {
  user: SidebarUserInfo | null
  onLogout: () => void
  /**
   * Predikat permission (`resource:action`) untuk menyaring menu sidebar.
   * Di-inject dari route agar komponen tetap presentational
   * (tanpa import lintas-fitur ke `features/auth`). Default: semua terlihat.
   */
  can?: (code: string) => boolean
}

function isNavVisible(item: NavItem, can: (code: string) => boolean): boolean {
  if (!item.permission) return true
  const codes = Array.isArray(item.permission) ? item.permission : [item.permission]
  return codes.some((code) => can(code))
}

export function AppShell({ user, onLogout, can = () => true }: AppShellProps) {
  const { t } = useTranslation('dashboard')
  const { theme, toggleTheme } = useTheme()
  const { pathname } = useLocation()

  const dashboardNavItems: NavItem[] = useMemo(
    () => [{ title: t('nav.dashboard'), url: '/', icon: Home }],
    [t],
  )

  const dataManagementNavItems: NavItem[] = useMemo(
    () => [
      { title: t('nav.users'), url: '/users', icon: Users, permission: 'user:read' },
      { title: t('nav.roles'), url: '/roles', icon: Shield, permission: 'role:read' },
    ],
    [t],
  )

  const visibleDataManagementNavItems = useMemo(
    () => dataManagementNavItems.filter((item) => isNavVisible(item, can)),
    [dataManagementNavItems, can],
  )

  const currentItem: NavItem | undefined =
    [...dashboardNavItems, ...visibleDataManagementNavItems].find(
      (item) => item.url === pathname,
    ) ??
    (pathname === '/profile'
      ? { title: t('userMenu.profile'), url: '/profile', icon: Home }
      : undefined)

  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider>
        <AppSidebar
          navItems={dashboardNavItems}
          dataManagementItems={visibleDataManagementNavItems}
          user={user}
          onLogout={onLogout}
        />
        <SidebarInset>
          <header className="flex h-14 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <NavLink to="/">{t('nav.dashboard')}</NavLink>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {currentItem && currentItem.url !== '/' && (
                  <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{currentItem.title}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                )}
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-2">
              <LanguageSwitcher />
              <ThemeToggle theme={theme} onToggle={toggleTheme} />
            </div>
          </header>
          <main className="flex flex-1 flex-col gap-4 p-4">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
