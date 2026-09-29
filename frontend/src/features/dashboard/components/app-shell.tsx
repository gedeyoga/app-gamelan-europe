import { Archive, Building2, CalendarDays, CreditCard, Home, KeyRound, Newspaper, Receipt, Shield, Users } from 'lucide-react'
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
  const { t: tStory } = useTranslation('story')
  const { t: tEvent } = useTranslation('event')
  const { t: tNetwork } = useTranslation('network')
  const { theme, toggleTheme } = useTheme()
  const { pathname: rawPathname } = useLocation()
  // Normalisasi trailing slash (kecuali root `/`) agar `/stories/new/` tetap match.
  const pathname = rawPathname.length > 1 ? rawPathname.replace(/\/+$/, '') : rawPathname

  const isStoryEditor =
    pathname === '/stories/new' || /^\/stories\/[^/]+\/edit$/.test(pathname)
  const isEventEditor =
    pathname === '/events/new' || /^\/events\/[^/]+\/edit$/.test(pathname)
  const isNetworkEditor =
    pathname === '/networks/new' || /^\/networks\/[^/]+\/edit$/.test(pathname)
  // `/stories/:id` (bukan `/new`, bukan `/edit`): halaman read-only dengan layout penuh tanpa sidebar/header.
  const isStoryDetail = /^\/stories\/(?!new$)[^/]+$/.test(pathname)
  // `/events/:id`: halaman detail read-only — pola sama, tanpa sidebar/header.
  const isEventDetail = /^\/events\/(?!new$)[^/]+$/.test(pathname)
  // `/story-submissions/:id`: halaman detail usulan story (reuse layout `StoryDetail`) — pola sama.
  const isStorySubmissionDetail = /^\/story-submissions\/[^/]+$/.test(pathname)

  const dashboardNavItems: NavItem[] = useMemo(
    () => [
      { title: t('nav.dashboard'), url: '/', icon: Home },
      { title: t('nav.story'), url: '/stories', icon: Newspaper, permission: 'admin:access' },
      { title: t('nav.archives'), url: '/archives', icon: Archive, permission: 'archive:read' },
      { title: t('nav.event'), url: '/events', icon: CalendarDays, permission: 'event:read' },
      { title: t('nav.myBilling'), url: '/my-billings', icon: Receipt },
    ],
    [t],
  )

  const dataManagementNavItems: NavItem[] = useMemo(
    () => [
      { title: t('nav.users'), url: '/users', icon: Users, permission: 'user:read' },
      { title: t('nav.roles'), url: '/roles', icon: Shield, permission: 'role:read' },
      {
        title: t('nav.networks'),
        url: '/networks',
        icon: Building2,
        permission: 'network:read',
      },
      { title: t('nav.apiKey'), url: '/api-keys', icon: KeyRound, permission: 'apikey:read' },
    ],
    [t],
  )

  const paymentNavItems: NavItem[] = useMemo(
    () => [
      {
        title: t('nav.subscription'),
        url: '/subscriptions',
        icon: CreditCard,
        permission: 'subscription:read',
      },
      { title: t('nav.billing'), url: '/billings', icon: Receipt, permission: 'billing:read' },
    ],
    [t],
  )

  const visibleDashboardNavItems = useMemo(
    () => dashboardNavItems.filter((item) => isNavVisible(item, can)),
    [dashboardNavItems, can],
  )

  const visibleDataManagementNavItems = useMemo(
    () => dataManagementNavItems.filter((item) => isNavVisible(item, can)),
    [dataManagementNavItems, can],
  )

  const visiblePaymentNavItems = useMemo(
    () => paymentNavItems.filter((item) => isNavVisible(item, can)),
    [paymentNavItems, can],
  )

  const currentItem: NavItem | undefined =
    [...visibleDashboardNavItems, ...visibleDataManagementNavItems, ...visiblePaymentNavItems].find(
      (item) => item.url === pathname,
    ) ??
    (pathname === '/profile'
      ? { title: t('userMenu.profile'), url: '/profile', icon: Home }
      : undefined)

  // Route detail story/event/submission: benar-benar kosong — tanpa sidebar, tanpa header/breadcrumb, tanpa padding.
  if (isStoryDetail || isEventDetail || isStorySubmissionDetail) {
    return <Outlet />
  }

  // Route editor story/event/network: tanpa sidebar, header ringkas + breadcrumb Dashboard / section / judul.
  if (isStoryEditor || isEventEditor || isNetworkEditor) {
    const editorTitle = isNetworkEditor
      ? pathname === '/networks/new'
        ? tNetwork('form.createTitle')
        : tNetwork('form.editTitle')
      : isStoryEditor
        ? pathname === '/stories/new'
          ? tStory('form.createTitle')
          : tStory('form.editTitle')
        : pathname === '/events/new'
          ? tEvent('form.createTitle')
          : tEvent('form.editTitle')
    const sectionLabel = isNetworkEditor
      ? t('nav.networks')
      : isStoryEditor
        ? t('nav.story')
        : t('nav.event')
    const sectionUrl = isNetworkEditor
      ? '/networks'
      : isStoryEditor
        ? '/stories'
        : '/events'
    return (
      <TooltipProvider delayDuration={0}>
        <div className="flex min-h-svh flex-col lg:h-svh lg:overflow-hidden">
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <NavLink to="/">{t('nav.dashboard')}</NavLink>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <NavLink to={sectionUrl}>{sectionLabel}</NavLink>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{editorTitle}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-2">
              <LanguageSwitcher />
              <ThemeToggle theme={theme} onToggle={toggleTheme} />
            </div>
          </header>
          <main className="flex flex-1 flex-col lg:min-h-0 lg:overflow-hidden">
            <Outlet />
          </main>
        </div>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider>
        <AppSidebar
          navItems={visibleDashboardNavItems}
          dataManagementItems={visibleDataManagementNavItems}
          paymentItems={visiblePaymentNavItems}
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
