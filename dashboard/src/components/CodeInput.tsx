import React, { useRef, useEffect } from 'react'

interface CodeInputProps {
  value: string
  onChange: (value: string) => void
  length?: number
  disabled?: boolean
  error?: string
}

export const CodeInput: React.FC<CodeInputProps> = ({
  value,
  onChange,
  length = 6,
  disabled = false,
  error
}) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const handleChange = (index: number, digit: string) => {
    if (digit.length > 1) return // Prevent multiple characters
    
    const newValue = value.split('')
    newValue[index] = digit
    const newCode = newValue.join('').slice(0, length)
    
    onChange(newCode)
    
    // Auto-focus next input
    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      // Move to previous input if current is empty
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    onChange(pastedData)
    
    // Focus the last filled input or the first empty one
    const focusIndex = Math.min(pastedData.length, length - 1)
    inputRefs.current[focusIndex]?.focus()
  }

  return (
    <div className="w-full">
      <div className="flex justify-center gap-3">
        {Array.from({ length }, (_, index) => (
          <input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={value[index] || ''}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            disabled={disabled}
            className={`
              w-12 h-12 text-center text-xl font-semibold
              border-2 rounded-lg
              bg-white/10 backdrop-blur-sm
              text-white placeholder-white/50
              focus:outline-none focus:ring-2 focus:ring-white/50
              transition-all duration-200
              ${error ? 'border-red-400' : 'border-white/30 focus:border-white/60'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            maxLength={1}
          />
        ))}
      </div>
      {error && (
        <p className="text-red-400 text-sm mt-3 text-center">{error}</p>
      )}
    </div>
  )
}
