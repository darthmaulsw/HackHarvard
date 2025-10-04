import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { AuthContextType, AuthState, User, ApiResponse } from '../types/auth'
import { authApi } from '../services/authApi'

type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'LOGOUT' }
  | { type: 'SET_AUTHENTICATED'; payload: boolean }

const initialState: AuthState = {
  user: null,
  isLoading: true,
  isAuthenticated: false,
}

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    case 'SET_USER':
      return { 
        ...state, 
        user: action.payload,
        isAuthenticated: !!action.payload?.isVerified
      }
    case 'LOGOUT':
      return { ...state, user: null, isAuthenticated: false }
    case 'SET_AUTHENTICATED':
      return { ...state, isAuthenticated: action.payload }
    default:
      return state
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('auth_token')
        if (token) {
          const response = await authApi.verifyToken()
          if (response.success && response.data) {
            dispatch({ type: 'SET_USER', payload: response.data })
          } else {
            localStorage.removeItem('auth_token')
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        localStorage.removeItem('auth_token')
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false })
      }
    }

    checkAuth()
  }, [])

  const signUp = async (phoneNumber: string): Promise<{ success: boolean; message: string }> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      const response = await authApi.sendVerificationCode(phoneNumber)
      
      if (response.success) {
        // Store phone number for verification step
        localStorage.setItem('pending_phone', phoneNumber)
      }
      
      return response
    } catch (error) {
      return { 
        success: false, 
        message: 'Network error. Please try again.' 
      }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }

  const verifyCode = async (code: string): Promise<{ success: boolean; message: string }> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      const phoneNumber = localStorage.getItem('pending_phone')
      
      if (!phoneNumber) {
        return { 
          success: false, 
          message: 'No pending verification found. Please start over.' 
        }
      }

      const response = await authApi.verifyCode(phoneNumber, code)
      
      if (response.success && response.data) {
        // Store auth token
        localStorage.setItem('auth_token', response.data.token)
        localStorage.removeItem('pending_phone')
        
        // Set user in context
        dispatch({ type: 'SET_USER', payload: response.data.user })
      }
      
      return response
    } catch (error) {
      return { 
        success: false, 
        message: 'Network error. Please try again.' 
      }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }

  const resendCode = async (): Promise<{ success: boolean; message: string }> => {
    try {
      const phoneNumber = localStorage.getItem('pending_phone')
      
      if (!phoneNumber) {
        return { 
          success: false, 
          message: 'No pending verification found. Please start over.' 
        }
      }

      return await authApi.sendVerificationCode(phoneNumber)
    } catch (error) {
      return { 
        success: false, 
        message: 'Network error. Please try again.' 
      }
    }
  }

  const logout = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('pending_phone')
    dispatch({ type: 'LOGOUT' })
  }

  const value: AuthContextType = {
    ...state,
    signUp,
    verifyCode,
    logout,
    resendCode,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
