import React from 'react'

interface LogInIconProps {
  className?: string
  size?: number
}

export const LogInIcon: React.FC<LogInIconProps> = ({ 
  className = "w-8 h-8", 
  size = 32 
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M15 3H19C20.1 3 21 3.9 21 5V19C21 20.1 20.1 21 19 21H15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 17L15 12L10 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 12H3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
