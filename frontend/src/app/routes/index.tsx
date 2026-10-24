import { lazy } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'

import { RequirePermission } from '@/components/shared/require-permission'
import { GuestRoute, ProtectedRoute } from '@/features/auth/auth-routes'

import { DashboardLayout } from './dashboard'

const ForbiddenPage = lazy(() => import('./403').then((m) => ({ default: m.ForbiddenPage })))
const ApiKeysPage = lazy(() => import('./api-keys').then((m) => ({ default: m.ApiKeysPage })))
const ArchiveDetailPage = lazy(() =>
  import('./archive-detail').then((m) => ({ default: m.ArchiveDetailPage })),
)
const ArchiveEditPage = lazy(() =>
  import('./archive-edit').then((m) => ({ default: m.ArchiveEditPage })),
)
const ArchiveNewPage = lazy(() =>
  import('./archive-new').then((m) => ({ default: m.ArchiveNewPage })),
)
const ArchivesPage = lazy(() => import('./archives').then((m) => ({ default: m.ArchivesPage })))
const BillingsPage = lazy(() => import('./billings').then((m) => ({ default: m.BillingsPage })))
const DashboardHomePage = lazy(() =>
  import('./dashboard-home').then((m) => ({ default: m.DashboardHomePage })),
)
const EventDetailPage = lazy(() =>
  import('./event-detail').then((m) => ({ default: m.EventDetailPage })),
)
const EventEditPage = lazy(() =>
  import('./event-edit').then((m) => ({ default: m.EventEditPage })),
)
const EventsPage = lazy(() => import('./events').then((m) => ({ default: m.EventsPage })))
const EventNewPage = lazy(() => import('./event-new').then((m) => ({ default: m.EventNewPage })))
const LoginPage = lazy(() => import('./login').then((m) => ({ default: m.LoginPage })))
const MyBillingsPage = lazy(() =>
  import('./my-billings').then((m) => ({ default: m.MyBillingsPage })),
)
const NetworkEditPage = lazy(() =>
  import('./network-edit').then((m) => ({ default: m.NetworkEditPage })),
)
const NetworkJoinPage = lazy(() =>
  import('./network-join').then((m) => ({ default: m.NetworkJoinPage })),
)
const NetworkNewPage = lazy(() =>
  import('./network-new').then((m) => ({ default: m.NetworkNewPage })),
)
const NetworksPage = lazy(() => import('./networks').then((m) => ({ default: m.NetworksPage })))
const ProfilePage = lazy(() => import('./profile').then((m) => ({ default: m.ProfilePage })))
const RolesPage = lazy(() => import('./roles').then((m) => ({ default: m.RolesPage })))
const SubscriptionRequestDetailPage = lazy(() =>
  import('./subscription-request-detail').then((m) => ({ default: m.SubscriptionRequestDetailPage })),
)
const SubscriptionRequestsPage = lazy(() =>
  import('./subscription-requests').then((m) => ({ default: m.SubscriptionRequestsPage })),
)
const SubscriptionsPage = lazy(() =>
  import('./subscriptions').then((m) => ({ default: m.SubscriptionsPage })),
)
const StoriesPage = lazy(() => import('./stories').then((m) => ({ default: m.StoriesPage })))
const StoryDetailPage = lazy(() =>
  import('./story-detail').then((m) => ({ default: m.StoryDetailPage })),
)
const StoryEditPage = lazy(() => import('./story-edit').then((m) => ({ default: m.StoryEditPage })))
const StoryNewPage = lazy(() => import('./story-new').then((m) => ({ default: m.StoryNewPage })))
const UsersPage = lazy(() => import('./users').then((m) => ({ default: m.UsersPage })))

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
    path: '/network/join',
    element: <NetworkJoinPage />,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])
