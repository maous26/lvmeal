'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: LucideIcon
  rightIcon?: LucideIcon
  onRightIconClick?: () => void
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, hint, leftIcon: LeftIcon, rightIcon: RightIcon, onRightIconClick, ...props }, ref) => {
    const id = React.useId()

    return (
      <div className="w-full space-y-2">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-[var(--text-primary)]"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {LeftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
              <LeftIcon className="h-5 w-5" />
            </div>
          )}
          <input
            id={id}
            type={type}
            className={cn(
              `flex h-12 w-full rounded-xl
               bg-[var(--bg-elevated)] border border-[var(--border-default)]
               px-4 py-3 text-base text-[var(--text-primary)]
               placeholder:text-[var(--text-tertiary)]
               transition-all duration-200
               hover:border-[var(--border-focus)]
               focus:outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-light)]
               disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[var(--bg-secondary)]`,
              LeftIcon && 'pl-11',
              RightIcon && 'pr-11',
              error && 'border-[var(--error)] focus:border-[var(--error)] focus:ring-[var(--error)]/20',
              className
            )}
            ref={ref}
            {...props}
          />
          {RightIcon && (
            <button
              type="button"
              onClick={onRightIconClick}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            >
              <RightIcon className="h-5 w-5" />
            </button>
          )}
        </div>
        {error && (
          <p className="text-sm text-[var(--error)]">{error}</p>
        )}
        {hint && !error && (
          <p className="text-sm text-[var(--text-tertiary)]">{hint}</p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }
