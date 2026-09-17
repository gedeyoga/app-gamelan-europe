import { request } from '@/lib/api-client'

import type {
  AuthResponse,
  LoginRequest,
  RefreshResponse,
  RegisterRequest,
  SessionUser,
  User,
} from '../types'

export function login(payload: LoginRequest): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function register(payload: RegisterRequest): Promise<User> {
  return request<User>('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function me(): Promise<SessionUser> {
  return request<SessionUser>('/auth/me')
}

export function refreshToken(refreshToken: string): Promise<RefreshResponse> {
  return request<RefreshResponse>('/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
}

export function logoutApi(refreshToken?: string): Promise<null> {
  return request<null>('/auth/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(refreshToken ? { refreshToken } : {}),
  })
}
