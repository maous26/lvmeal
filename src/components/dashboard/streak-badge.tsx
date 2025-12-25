'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Flame, Zap, Award } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StreakBadgeProps {
  days: number
  isActive?: boolean
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

export function StreakBadge({
  days,
  isActive = true,
  size = 'md',
  showLabel = true,
  className,
}: StreakBadgeProps) {
  const sizeConfig = {
    sm: { icon: 'h-4 w-4', text: 'text-sm', padding: 'px-3 py-1.5', glow: '8px' },
    md: { icon: 'h-5 w-5', text: 'text-base', padding: 'px-4 py-2', glow: '12px' },
    lg: { icon: 'h-7 w-7', text: 'text-xl', padding: 'px-5 py-2.5', glow: '16px' },
  }

  const config = sizeConfig[size]

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05 }}
      className={cn(
        'relative inline-flex items-center gap-2 rounded-full shadow-lg',
        config.padding,
        isActive
          ? 'bg-gradient-to-r from-[#FF6B5B] to-[#FFB347] text-white'
          : 'bg-[var(--bg-tertiary)]',
        className
      )}
      style={isActive ? {
        boxShadow: `0 4px 20px rgba(255, 107, 91, 0.4), 0 0 ${config.glow} rgba(255, 179, 71, 0.3)`
      } : undefined}
    >
      {/* Animated glow effect */}
      {isActive && (
        <motion.div
          className="absolute inset-0 rounded-full bg-gradient-to-r from-[#FF6B5B] to-[#FFB347] blur-lg opacity-40"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      <motion.div
        animate={isActive ? { rotate: [0, -10, 10, -10, 0] } : undefined}
        transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
      >
        <Flame
          className={cn(
            config.icon,
            isActive ? 'text-white drop-shadow-lg' : 'text-[var(--text-tertiary)]'
          )}
        />
      </motion.div>
      <span
        className={cn(
          'font-bold tabular-nums relative',
          config.text,
          isActive ? 'text-white' : 'text-[var(--text-tertiary)]'
        )}
      >
        {days}
      </span>
      {showLabel && (
        <span
          className={cn(
            'font-medium relative',
            size === 'sm' ? 'text-xs' : 'text-sm',
            isActive ? 'text-white/90' : 'text-[var(--text-tertiary)]'
          )}
        >
          jour{days > 1 ? 's' : ''}
        </span>
      )}
    </motion.div>
  )
}

// XP display
interface XPDisplayProps {
  current: number
  level: number
  toNextLevel: number
  className?: string
}

export function XPDisplay({ current, level, toNextLevel, className }: XPDisplayProps) {
  const progress = (current / (current + toNextLevel)) * 100

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <motion.div
        className="relative flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--info)] shadow-lg"
        style={{ boxShadow: '0 4px 20px rgba(0, 119, 182, 0.3)' }}
        whileHover={{ scale: 1.05 }}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        >
          <Zap className="h-5 w-5 text-white drop-shadow-lg" />
        </motion.div>
        <span className="text-base font-bold text-white tabular-nums">
          Nv.{level}
        </span>
      </motion.div>

      <div className="flex-1">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-sm font-medium text-[var(--text-secondary)]">
            {current} XP
          </span>
          <span className="text-xs text-[var(--text-tertiary)]">
            {toNextLevel} pour niveau {level + 1}
          </span>
        </div>
        <div className="h-2.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden shadow-inner">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--info)]"
            style={{ boxShadow: '0 0 10px rgba(0, 119, 182, 0.5)' }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
      </div>
    </div>
  )
}

// Achievement badge
interface AchievementBadgeProps {
  name: string
  icon?: React.ReactNode
  earned?: boolean
  className?: string
}

export function AchievementBadge({ name, icon, earned = false, className }: AchievementBadgeProps) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={earned ? { scale: 1.08, y: -4 } : undefined}
      className={cn(
        'relative flex flex-col items-center gap-2 p-4 rounded-2xl transition-all duration-300',
        earned
          ? 'bg-gradient-to-br from-[var(--accent-light)] to-white shadow-lg'
          : 'bg-[var(--bg-secondary)]',
        className
      )}
      style={earned ? {
        boxShadow: '0 8px 25px rgba(0, 119, 182, 0.15)'
      } : undefined}
    >
      {/* Glow effect for earned badges */}
      {earned && (
        <motion.div
          className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[var(--accent-primary)]/10 to-transparent"
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      <motion.div
        className={cn(
          'relative p-3 rounded-full',
          earned
            ? 'bg-gradient-to-br from-[var(--accent-primary)] to-[var(--info)] shadow-lg'
            : 'bg-[var(--bg-tertiary)]'
        )}
        style={earned ? {
          boxShadow: '0 4px 15px rgba(0, 119, 182, 0.3)'
        } : undefined}
        animate={earned ? { rotate: [0, 5, -5, 0] } : undefined}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
      >
        {icon || (
          <Award
            className={cn(
              'h-6 w-6',
              earned ? 'text-white drop-shadow-lg' : 'text-[var(--text-tertiary)]'
            )}
          />
        )}
      </motion.div>
      <span
        className={cn(
          'text-xs font-semibold text-center relative',
          earned ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'
        )}
      >
        {name}
      </span>

      {/* Locked overlay */}
      {!earned && (
        <div className="absolute inset-0 rounded-2xl bg-[var(--bg-secondary)]/60 backdrop-blur-[1px] flex items-center justify-center">
          <div className="text-[var(--text-tertiary)] text-lg">🔒</div>
        </div>
      )}
    </motion.div>
  )
}
