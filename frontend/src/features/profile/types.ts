export interface ChangePasswordInput {
  currentPassword: string
  newPassword: string
  /** Client-side only — tidak dikirim ke backend. */
  confirmPassword: string
}

export interface UpdateProfileInput {
  fullName?: string
  email?: string
}