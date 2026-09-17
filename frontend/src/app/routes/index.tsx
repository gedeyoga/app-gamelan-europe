import { createBrowserRouter, Navigate } from 'react-router-dom'

import { RequirePermission } from '@/components/shared/require-permission'
import { GuestRoute, ProtectedRoute } from '@/features/auth/auth-routes'

import { ForbiddenPage } from './403'
import { DashboardLayout } from './dashboard'
import { DashboardHomePage } from './dashboard-home'
import { LoginPage } from './login'
import { ProfilePage } from './profile'
import { RegisterPage } from './register'
import { RolesPage } from './roles'
import { UsersPage } from './users'

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardHomePage /> },
      {
        path: 'users',
        element: (
          <RequirePermission code="user:read">
            <UsersPage />
          </RequirePermission>
        ),
      },
      {
        path: 'roles',
        element: (
          <RequirePermission code="role:read">
            <RolesPage />
          </RequirePermission>
        ),
      },
      { path: 'profile', element: <ProfilePage /> },
      { path: '403', element: <ForbiddenPage /> },
    ],
  },
  {
    path: '/login',
    element: (
      <GuestRoute>
        <LoginPage />
      </GuestRoute>
    ),
  },
  {
    path: '/register',
    element: (
      <GuestRoute>
        <RegisterPage />
      </GuestRoute>
    ),
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])
