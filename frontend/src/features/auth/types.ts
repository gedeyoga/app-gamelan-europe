export interface User {
  id: string
  email: string
  fullName: string
  status?: string
  isMember: boolean
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  fullName: string
  password: string
  phone?: string
  countryId?: string
}

export interface Country {
  id: number
  iso2: string
  name: string
  phoneCode?: string | null
  emoji?: string | null
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
  isMember: boolean
  avatar?: string | null
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
