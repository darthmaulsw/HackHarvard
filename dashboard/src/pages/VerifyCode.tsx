import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { CodeInput } from '../components/CodeInput'
import { Waves } from '../components/ui/waves-background'
import { Shield, ArrowLeft, RotateCcw } from 'lucide-react'

const VerifyCode: React.FC = () => {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [countdown, setCountdown] = useState(0)
  
  const { verifyCode, resendCode, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate])

  // Check if there's a pending phone number
  useEffect(() => {
    const pendingPhone = localStorage.getItem('pending_phone')
    if (!pendingPhone) {
      navigate('/signup', { replace: true })
    }
  }, [navigate])

  // Countdown timer for resend button
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code')
      return
    }

    setIsSubmitting(true)
    
    try {
      const result = await verifyCode(code)
      
      if (result.success) {
        navigate('/dashboard', { replace: true })
      } else {
        setError(result.message)
        setCode('') // Clear the code on error
      }
    } catch (error) {
      setError('Something went wrong. Please try again.')
      setCode('')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResendCode = async () => {
    if (countdown > 0) return
    
    setIsResending(true)
    setError('')
    
    try {
      const result = await resendCode()
      
      if (result.success) {
        setCountdown(60) // 60 second countdown
      } else {
        setError(result.message)
      }
    } catch (error) {
      setError('Failed to resend code. Please try again.')
    } finally {
      setIsResending(false)
    }
  }

  const handleBackToSignUp = () => {
    localStorage.removeItem('pending_phone')
    navigate('/signup', { replace: true })
  }

  const pendingPhone = localStorage.getItem('pending_phone')
  const maskedPhone = pendingPhone 
    ? `(${pendingPhone.slice(0, 3)}) ${pendingPhone.slice(3, 6)}-${pendingPhone.slice(6)}`
    : ''

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      {/* Waves Background */}
      <div className="absolute inset-0">
        <Waves
          lineColor="rgba(255, 255, 255, 0.3)"
          backgroundColor="transparent"
          waveSpeedX={0.015}
          waveSpeedY={0.008}
          waveAmpX={35}
          waveAmpY={18}
          friction={0.92}
          tension={0.008}
          maxCursorMove={100}
          xGap={15}
          yGap={40}
        />
      </div>
      
      <div className="w-full max-w-md relative z-10">
        <div className="card p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Verify Your Phone
            </h1>
            <p className="text-white/80">
              Enter the 6-digit code sent to
            </p>
            <p className="text-white font-medium">
              {maskedPhone}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-white/90 mb-4 text-center">
                Verification Code
              </label>
              <CodeInput
                value={code}
                onChange={setCode}
                length={6}
                disabled={isSubmitting}
                error={error}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || code.length !== 6}
              className="btn btn-primary w-full"
            >
              {isSubmitting ? (
                <>
                  <div className="spinner"></div>
                  Verifying...
                </>
              ) : (
                'Verify Code'
              )}
            </button>
          </form>

          {/* Resend Code */}
          <div className="mt-6 text-center">
            <button
              onClick={handleResendCode}
              disabled={isResending || countdown > 0}
              className="btn btn-secondary text-sm"
            >
              {isResending ? (
                <>
                  <div className="spinner"></div>
                  Sending...
                </>
              ) : countdown > 0 ? (
                `Resend in ${countdown}s`
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  Resend Code
                </>
              )}
            </button>
          </div>

          {/* Back to Sign Up */}
          <div className="mt-6 text-center">
            <button
              onClick={handleBackToSignUp}
              className="text-white/60 hover:text-white/80 text-sm flex items-center gap-2 mx-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              Use Different Phone Number
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VerifyCode
