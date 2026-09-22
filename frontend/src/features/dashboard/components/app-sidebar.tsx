import { useEffect } from 'react'
import { Home, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink, useLocation } from 'react-router-dom'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

import { SidebarUser, type SidebarUserInfo } from './sidebar-user'

export interface NavItem {
  title: string
  url: string
  icon: LucideIcon
  /** Kode permission (`resource:action`) syarat tampil menu; tanpa ini selalu tampil. */
  permission?: string | string[]
}

interface AppSidebarProps {
  navItems: NavItem[]
  dataManagementItems: NavItem[]
  paymentItems: NavItem[]
  user: SidebarUserInfo | null
  onLogout: () => void
  className?: string
}

export function AppSidebar({
  navItems,
  dataManagementItems,
  paymentItems,
  user,
  onLogout,
  className,
}: AppSidebarProps) {
  const { t } = useTranslation('dashboard')
  const { pathname } = useLocation()
  const { setOpenMobile } = useSidebar()

  useEffect(() => {
    setOpenMobile(false)
  }, [pathname, setOpenMobile])

  return (
    <Sidebar collapsible="icon" className={cn(className)}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="data-[active=true]:bg-transparent">
              <NavLink to="/" end>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Home />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">European Gamelan Society</span>
                </div>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.url}
                  tooltip={item.title}
                >
                  <NavLink to={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {dataManagementItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>{t('group.dataManagement')}</SidebarGroupLabel>
            <SidebarMenu>
              {dataManagementItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    tooltip={item.title}
                  >
                    <NavLink to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {paymentItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>{t('group.payment')}</SidebarGroupLabel>
            <SidebarMenu>
              {paymentItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    tooltip={item.title}
                  >
                    <NavLink to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        {user && <SidebarUser user={user} onLogout={onLogout} />}
      </SidebarFooter>
    </Sidebar>
  )
}