'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  max: number
  color?: string
  backgroundColor?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  showLabel?: boolean
  label?: string
  animated?: boolean
  className?: string
}

const sizeClasses = {
  xs: 'h-1',
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-3',
}

export function ProgressBar({
  value,
  max,
  color = 'var(--accent-primary)',
  backgroundColor = 'var(--border-light)',
  size = 'md',
  showLabel = false,
  label,
  animated = true,
  className,
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))

  return (
    <div className={cn('w-full', className)}>
      {(showLabel || label) && (
        <div className="flex justify-between items-center mb-2">
          {label && (
            <span className="text-sm font-medium text-[var(--text-secondary)]">{label}</span>
          )}
          {showLabel && (
            <span className="text-sm tabular-nums text-[var(--text-tertiary)]">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      <div
        className={cn('w-full rounded-full overflow-hidden', sizeClasses[size])}
        style={{ backgroundColor }}
      >
        <motion.div
          className={cn('h-full rounded-full')}
          style={{ backgroundColor: color }}
          initial={animated ? { width: 0 } : { width: `${percentage}%` }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
        />
      </div>
    </div>
  )
}

// Stacked progress bar for multiple values
interface StackedProgressBarProps {
  segments: {
    value: number
    color: string
    label?: string
  }[]
  total: number
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

export function StackedProgressBar({
  segments,
  total,
  size = 'md',
  className,
}: StackedProgressBarProps) {
  return (
    <div
      className={cn(
        'w-full rounded-full overflow-hidden flex bg-[var(--border-light)]',
        sizeClasses[size],
        className
      )}
    >
      {segments.map((segment, index) => {
        const percentage = (segment.value / total) * 100
        return (
          <motion.div
            key={segment.label || index}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ backgroundColor: segment.color }}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1], delay: index * 0.1 }}
          />
        )
      })}
    </div>
  )
}
