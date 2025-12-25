'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-[var(--accent-light)] text-[var(--accent-primary)]',
        secondary: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]',
        success: 'bg-[#E8F0EA] text-[var(--success)]',
        warning: 'bg-[#FDF3E7] text-[var(--warning)]',
        error: 'bg-[#FAE8E8] text-[var(--error)]',
        info: 'bg-[#E8EEF0] text-[var(--info)]',
        outline: 'border border-[var(--border-default)] text-[var(--text-secondary)]',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        default: 'px-2.5 py-0.5 text-xs',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean
  dotColor?: string
}

function Badge({ className, variant, size, dot, dotColor, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className="mr-1.5 h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: dotColor || 'currentColor' }}
        />
      )}
      {children}
    </div>
  )
}

export { Badge, badgeVariants }
