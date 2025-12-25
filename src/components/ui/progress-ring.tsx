'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ProgressRingProps {
  value: number
  max: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  strokeWidth?: number
  color?: string
  backgroundColor?: string
  showPercentage?: boolean
  label?: string
  sublabel?: string
  className?: string
  children?: React.ReactNode
}

const sizeConfig = {
  sm: { size: 64, stroke: 4, fontSize: 'text-sm' },
  md: { size: 96, stroke: 6, fontSize: 'text-lg' },
  lg: { size: 140, stroke: 8, fontSize: 'text-2xl' },
  xl: { size: 180, stroke: 10, fontSize: 'text-3xl' },
}

export function ProgressRing({
  value,
  max,
  size = 'md',
  strokeWidth,
  color = 'var(--accent-primary)',
  backgroundColor = 'var(--border-light)',
  showPercentage = false,
  label,
  sublabel,
  className,
  children,
}: ProgressRingProps) {
  const config = sizeConfig[size]
  const actualStrokeWidth = strokeWidth ?? config.stroke
  const radius = (config.size - actualStrokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const percentage = Math.min(100, (value / max) * 100)
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={config.size}
        height={config.size}
        viewBox={`0 0 ${config.size} ${config.size}`}
        className="-rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={config.size / 2}
          cy={config.size / 2}
          r={radius}
          fill="none"
          stroke={backgroundColor}
          strokeWidth={actualStrokeWidth}
        />
        {/* Progress circle */}
        <motion.circle
          cx={config.size / 2}
          cy={config.size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={actualStrokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children ? (
          children
        ) : (
          <>
            {showPercentage && (
              <span className={cn('font-semibold text-[var(--text-primary)] tabular-nums', config.fontSize)}>
                {Math.round(percentage)}%
              </span>
            )}
            {label && (
              <span className={cn('font-semibold text-[var(--text-primary)] tabular-nums', config.fontSize)}>
                {label}
              </span>
            )}
            {sublabel && (
              <span className="text-xs text-[var(--text-tertiary)] mt-0.5">
                {sublabel}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// Multiple ring variant for macros
interface MultiRingProps {
  rings: {
    value: number
    max: number
    color: string
    label: string
  }[]
  size?: 'sm' | 'md' | 'lg'
  className?: string
  centerContent?: React.ReactNode
}

export function MultiProgressRing({ rings, size = 'md', className, centerContent }: MultiRingProps) {
  const baseConfig = sizeConfig[size]
  const baseSize = baseConfig.size
  const baseStroke = baseConfig.stroke
  const gap = baseStroke + 2

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={baseSize}
        height={baseSize}
        viewBox={`0 0 ${baseSize} ${baseSize}`}
        className="-rotate-90"
      >
        {rings.map((ring, index) => {
          const strokeWidth = baseStroke - index * 1
          const radius = (baseSize - strokeWidth) / 2 - index * gap
          const circumference = radius * 2 * Math.PI
          const percentage = Math.min(100, (ring.value / ring.max) * 100)
          const strokeDashoffset = circumference - (percentage / 100) * circumference

          return (
            <g key={ring.label}>
              {/* Background */}
              <circle
                cx={baseSize / 2}
                cy={baseSize / 2}
                r={radius}
                fill="none"
                stroke="var(--border-light)"
                strokeWidth={strokeWidth}
                opacity={0.5}
              />
              {/* Progress */}
              <motion.circle
                cx={baseSize / 2}
                cy={baseSize / 2}
                r={radius}
                fill="none"
                stroke={ring.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1, ease: [0.4, 0, 0.2, 1], delay: index * 0.1 }}
              />
            </g>
          )
        })}
      </svg>

      {centerContent && (
        <div className="absolute inset-0 flex items-center justify-center">
          {centerContent}
        </div>
      )}
    </div>
  )
}
