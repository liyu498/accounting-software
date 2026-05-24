import React from 'react'
import { cn } from '../../lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, size, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    const sizeClasses: Record<string, string> = {
      sm: 'h-8 px-2 text-sm',
      md: 'h-10 px-3 text-base',
      lg: 'h-12 px-4 text-lg',
    }

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-gray-700"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400',
            'transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed',
            error && 'border-red-500 focus:ring-red-500 focus:border-red-500',
            size && sizeClasses[size] || sizeClasses['md'],
            className
          )}
          size={size as unknown as number | undefined}
          {...props}
        />
        {error && (
          <span className="text-sm text-red-500">{error}</span>
        )}
        {hint && !error && (
          <span className="text-sm text-gray-500">{hint}</span>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export { Input }
