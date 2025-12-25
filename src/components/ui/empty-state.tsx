'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    variant?: 'default' | 'secondary' | 'outline'
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  className?: string
  children?: React.ReactNode
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  children,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'flex flex-col items-center justify-center text-center py-12 px-6',
        className
      )}
    >
      {Icon && (
        <div className="mb-4 p-4 rounded-full bg-[var(--bg-secondary)]">
          <Icon className="h-8 w-8 text-[var(--text-tertiary)]" />
        </div>
      )}

      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
        {title}
      </h3>

      {description && (
        <p className="text-sm text-[var(--text-secondary)] max-w-sm mb-6">
          {description}
        </p>
      )}

      {children}

      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          {action && (
            <Button
              variant={action.variant || 'default'}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="ghost"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  )
}
