'use client'

import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '@/lib/utils'

interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  label?: string
  showValue?: boolean
  formatValue?: (value: number) => string
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, label, showValue, formatValue, ...props }, ref) => {
  const value = props.value?.[0] ?? props.defaultValue?.[0] ?? 0

  return (
    <div className="w-full space-y-3">
      {(label || showValue) && (
        <div className="flex justify-between items-center">
          {label && (
            <label className="text-sm font-medium text-[var(--text-primary)]">
              {label}
            </label>
          )}
          {showValue && (
            <span className="text-sm font-medium text-[var(--accent-primary)] tabular-nums">
              {formatValue ? formatValue(value) : value}
            </span>
          )}
        </div>
      )}
      <SliderPrimitive.Root
        ref={ref}
        className={cn(
          'relative flex w-full touch-none select-none items-center',
          className
        )}
        {...props}
      >
        <SliderPrimitive.Track
          className={cn(
            'relative h-2 w-full grow overflow-hidden rounded-full',
            'bg-[var(--border-light)]'
          )}
        >
          <SliderPrimitive.Range
            className="absolute h-full bg-[var(--accent-primary)] rounded-full"
          />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className={cn(
            'block h-5 w-5 rounded-full',
            'border-2 border-[var(--accent-primary)]',
            'bg-[var(--bg-elevated)]',
            'shadow-[var(--shadow-sm)]',
            'transition-all duration-150',
            'hover:scale-110',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2',
            'disabled:pointer-events-none disabled:opacity-50'
          )}
        />
      </SliderPrimitive.Root>
    </div>
  )
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
