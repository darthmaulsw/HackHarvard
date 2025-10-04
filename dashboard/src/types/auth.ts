export interface User {
  id: string
  phoneNumber: string
  isVerified: boolean
  createdAt: string
}

export interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
}

export interface AuthContextType extends AuthState {
  signUp: (phoneNumber: string) => Promise<{ success: boolean; message: string }>
  verifyCode: (code: string) => Promise<{ success: boolean; message: string }>
  logout: () => void
  resendCode: () => Promise<{ success: boolean; message: string }>
}

export interface ApiResponse<T = any> {
  success: boolean
  message: string
  data?: T
}
