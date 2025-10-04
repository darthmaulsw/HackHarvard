import React, { useState, useEffect } from 'react'
import { Phone } from 'lucide-react'

interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  error?: string
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  placeholder = "Enter your phone number",
  disabled = false,
  error
}) => {
  const [displayValue, setDisplayValue] = useState('')

  // Format phone number as user types
  const formatPhoneNumber = (input: string) => {
    // Remove all non-digits
    const digits = input.replace(/\D/g, '')
    
    // Limit to 10 digits (US format)
    const limitedDigits = digits.slice(0, 10)
    
    // Format as (XXX) XXX-XXXX
    if (limitedDigits.length === 0) return ''
    if (limitedDigits.length <= 3) return `(${limitedDigits}`
    if (limitedDigits.length <= 6) return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3)}`
    return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3, 6)}-${limitedDigits.slice(6)}`
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value)
    setDisplayValue(formatted)
    // Send raw digits to parent
    onChange(e.target.value.replace(/\D/g, ''))
  }

  // Update display value when prop changes
  useEffect(() => {
    setDisplayValue(formatPhoneNumber(value))
  }, [value])

  return (
    <div className="w-full">
      <div className="relative">
        {/* <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/70 w- h-5" /> */}
        <input
          type="tel"
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          className={`input pl-16 ${error ? 'border-red-400' : ''}`}
          maxLength={14} // (XXX) XXX-XXXX
        />
      </div>
      {error && (
        <p className="text-red-400 text-sm mt-2">{error}</p>
      )}
    </div>
  )
}
