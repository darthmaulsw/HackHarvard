import axios from 'axios'
import { ApiResponse, User } from '../types/auth'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const authApi = {
  // Send verification code to phone number
  sendVerificationCode: async (phoneNumber: string): Promise<ApiResponse> => {
    try {
      const response = await api.post('/auth/send-code', {
        phoneNumber: phoneNumber.replace(/\D/g, ''), // Remove non-digits
      })
      return response.data
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to send verification code',
      }
    }
  },

  // Verify the code sent to phone
  verifyCode: async (phoneNumber: string, code: string): Promise<ApiResponse<{ user: User; token: string }>> => {
    try {
      const response = await api.post('/auth/verify-code', {
        phoneNumber: phoneNumber.replace(/\D/g, ''),
        code,
      })
      return response.data
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Invalid verification code',
      }
    }
  },

  // Verify existing token
  verifyToken: async (): Promise<ApiResponse<User>> => {
    try {
      const response = await api.get('/auth/verify-token')
      return response.data
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Invalid token',
      }
    }
  },

  // Resend verification code
  resendCode: async (phoneNumber: string): Promise<ApiResponse> => {
    try {
      const response = await api.post('/auth/resend-code', {
        phoneNumber: phoneNumber.replace(/\D/g, ''),
      })
      return response.data
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to resend code',
      }
    }
  },
}
