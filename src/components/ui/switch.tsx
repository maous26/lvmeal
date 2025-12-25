'use client'

import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

interface SwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
  label?: string
  description?: string
}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  SwitchProps
>(({ className, label, description, ...props }, ref) => {
  const id = React.useId()

  if (label || description) {
    return (
      <div className="flex items-center justify-between">
        <div className="flex-1 mr-4">
          {label && (
            <label
              htmlFor={id}
              className="text-sm font-medium text-[var(--text-primary)] cursor-pointer"
            >
              {label}
            </label>
          )}
          {description && (
            <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
              {description}
            </p>
          )}
        </div>
        <SwitchPrimitive.Root
          id={id}
          ref={ref}
          className={cn(
            'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full',
            'border-2 border-transparent',
            'transition-colors duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'data-[state=checked]:bg-[var(--accent-primary)]',
            'data-[state=unchecked]:bg-[var(--border-default)]',
            className
          )}
          {...props}
        >
          <SwitchPrimitive.Thumb
            className={cn(
              'pointer-events-none block h-5 w-5 rounded-full',
              'bg-[var(--bg-elevated)] shadow-[var(--shadow-sm)]',
              'transition-transform duration-200',
              'data-[state=checked]:translate-x-5',
              'data-[state=unchecked]:translate-x-0'
            )}
          />
        </SwitchPrimitive.Root>
      </div>
    )
  }

  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full',
        'border-2 border-transparent',
        'transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:bg-[var(--accent-primary)]',
        'data-[state=unchecked]:bg-[var(--border-default)]',
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block h-5 w-5 rounded-full',
          'bg-[var(--bg-elevated)] shadow-[var(--shadow-sm)]',
          'transition-transform duration-200',
          'data-[state=checked]:translate-x-5',
          'data-[state=unchecked]:translate-x-0'
        )}
      />
    </SwitchPrimitive.Root>
  )
})
Switch.displayName = SwitchPrimitive.Root.displayName

export { Switch }
