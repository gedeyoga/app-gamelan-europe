import { createBrowserRouter, Navigate } from 'react-router-dom'

import { RequirePermission } from '@/components/shared/require-permission'
import { GuestRoute, ProtectedRoute } from '@/features/auth/auth-routes'

import { ForbiddenPage } from './403'
import { ApiKeysPage } from './api-keys'
import { ArchiveDetailPage } from './archive-detail'
import { ArchiveEditPage } from './archive-edit'
import { ArchiveNewPage } from './archive-new'
import { ArchivesPage } from './archives'
import { BillingsPage } from './billings'
import { DashboardLayout } from './dashboard'
import { DashboardHomePage } from './dashboard-home'
import { EventDetailPage } from './event-detail'
import { EventEditPage } from './event-edit'
import { EventsPage } from './events'
import { EventNewPage } from './event-new'
import { LoginPage } from './login'
import { MyBillingsPage } from './my-billings'
import { NetworkEditPage } from './network-edit'
import { NetworkJoinPage } from './network-join'
import { NetworkNewPage } from './network-new'
import { NetworksPage } from './networks'
import { NotificationsPage } from './notifications'
import { ProfilePage } from './profile'
import { RegisterPage } from './register'
import { RolesPage } from './roles'
import { SubscriptionRequestDetailPage } from './subscription-request-detail'
import { SubscriptionRequestsPage } from './subscription-requests'
import { SubscriptionsPage } from './subscriptions'
import { StoriesPage } from './stories'
import { StoryDetailPage } from './story-detail'
import { StoryEditPage } from './story-edit'
import { StoryNewPage } from './story-new'
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
      {
        path: 'stories',
        element: (
          <RequirePermission code="story:read">
            <StoriesPage />
          </RequirePermission>
        ),
      },
      { path: 'stories/new', element: <StoryNewPage /> },
      { path: 'stories/:id/edit', element: <StoryEditPage /> },
      { path: 'stories/:id', element: <StoryDetailPage /> },
      {
        path: 'archives',
        element: (
          <RequirePermission code="archive:read">
            <ArchivesPage />
          </RequirePermission>
        ),
      },
      { path: 'archives/new', element: <ArchiveNewPage /> },
      { path: 'archives/:id/edit', element: <ArchiveEditPage /> },
      { path: 'archives/:id', element: <ArchiveDetailPage /> },
      {
        path: 'events',
        element: (
          <RequirePermission code="event:read">
            <EventsPage />
          </RequirePermission>
        ),
      },
      { path: 'events/new', element: <EventNewPage /> },
      { path: 'events/:id/edit', element: <EventEditPage /> },
      { path: 'events/:id', element: <EventDetailPage /> },
      {
        path: 'api-keys',
        element: (
          <RequirePermission code="apikey:read">
            <ApiKeysPage />
          </RequirePermission>
        ),
      },
      {
        path: 'networks',
        element: (
          <RequirePermission code="network:read">
            <NetworksPage />
          </RequirePermission>
        ),
      },
      { path: 'networks/new', element: <NetworkNewPage /> },
      { path: 'networks/:id/edit', element: <NetworkEditPage /> },
      {
        path: 'subscriptions',
        element: (
          <RequirePermission code="subscription:read">
            <SubscriptionsPage />
          </RequirePermission>
        ),
      },
      {
        path: 'subscription-requests',
        element: (
          <RequirePermission code="subscription-request:read">
            <SubscriptionRequestsPage />
          </RequirePermission>
        ),
      },
      { path: 'subscription-requests/:id', element: <SubscriptionRequestDetailPage /> },
      {
        path: 'billings',
        element: (
          <RequirePermission code="billing:read">
            <BillingsPage />
          </RequirePermission>
        ),
      },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'my-billings', element: <MyBillingsPage /> },
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
    path: '/network/join',
    element: <NetworkJoinPage />,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])
