export interface User {
  id: string
  email: string
  fullName: string
  status?: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  fullName: string
  password: string
}

export interface SessionRole {
  id: string
  name: string
}

export interface SessionUser {
  id: string
  email: string
  fullName: string
  status: string
  role: SessionRole | null
  permissions: string[]
}

export interface RefreshResponse {
  accessToken: string
  refreshToken: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: User
}
