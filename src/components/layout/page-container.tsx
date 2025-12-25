'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface PageContainerProps {
  children: React.ReactNode
  className?: string
  noPadding?: boolean
  noBottomPadding?: boolean
  fullWidth?: boolean
}

export function PageContainer({
  children,
  className,
  noPadding = false,
  noBottomPadding = false,
  fullWidth = false,
}: PageContainerProps) {
  return (
    <main
      className={cn(
        'min-h-screen bg-[var(--bg-primary)]',
        !noPadding && 'px-4',
        !noBottomPadding && 'pb-24', // Space for bottom nav
        !fullWidth && 'max-w-lg mx-auto',
        className
      )}
    >
      {children}
    </main>
  )
}

// Section component for grouping content
interface SectionProps {
  children: React.ReactNode
  title?: React.ReactNode
  subtitle?: string
  action?: React.ReactNode
  className?: string
}

export function Section({
  children,
  title,
  subtitle,
  action,
  className,
}: SectionProps) {
  return (
    <section className={cn('py-4', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          <div>
            {title && (
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

// Divider component
export function Divider({ className }: { className?: string }) {
  return (
    <hr className={cn('border-t border-[var(--border-light)] my-6', className)} />
  )
}
