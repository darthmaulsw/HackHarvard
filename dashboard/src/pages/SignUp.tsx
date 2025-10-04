import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { PhoneInput } from '../components/PhoneInput'
import { Waves } from '../components/ui/waves-background'
import { LogInIcon } from '../components/ui/LogInIcon'
import { ArrowRight } from 'lucide-react'

const SignUp: React.FC = () => {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const { signUp, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const validatePhoneNumber = (phone: string): boolean => {
    // US phone number validation (10 digits)
    const digits = phone.replace(/\D/g, '')
    return digits.length === 10
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validatePhoneNumber(phoneNumber)) {
      setError('Please enter a valid 10-digit phone number')
      return
    }

    setIsSubmitting(true)
    
    try {
      const result = await signUp(phoneNumber)
      
      if (result.success) {
        navigate('/verify', { replace: true })
      } else {
        setError(result.message)
      }
    } catch (error) {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

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
              <LogInIcon className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Welcome to HandAuth 
            </h1>
            <p className="text-white/80">
              Enter your phone number to get started
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-white/90 mb-2">
                Phone Number
              </label>
              <PhoneInput
                value={phoneNumber}
                onChange={setPhoneNumber}
                placeholder="(555) 123-4567"
                disabled={isSubmitting}
                error={error}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !phoneNumber}
              className="btn btn-primary w-full"
            >
              {isSubmitting ? (
                <>
                  <div className="spinner"></div>
                  Sending Code...
                </>
              ) : (
                <>
                  Send Verification Code
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-white/60 text-sm">
              We'll send you a verification code via SMS
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SignUp
