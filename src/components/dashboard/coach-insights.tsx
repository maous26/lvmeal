'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lightbulb,
  AlertCircle,
  TrendingUp,
  Trophy,
  MessageCircle,
  ChevronRight,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type InsightType = 'tip' | 'warning' | 'success' | 'achievement' | 'info'

interface Insight {
  id: string
  type: InsightType
  title: string
  message: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
  dismissible?: boolean
}

interface CoachInsightsProps {
  insights: Insight[]
  onDismiss?: (id: string) => void
  onAction?: (id: string) => void
  className?: string
}

const insightConfig: Record<InsightType, {
  icon: typeof Lightbulb
  bgColor: string
  iconColor: string
  borderColor: string
}> = {
  tip: {
    icon: Lightbulb,
    bgColor: 'bg-[#FDF8E7]',
    iconColor: 'text-[#B8860B]',
    borderColor: 'border-l-[#D4A574]',
  },
  warning: {
    icon: AlertCircle,
    bgColor: 'bg-[#FDF3E7]',
    iconColor: 'text-[var(--warning)]',
    borderColor: 'border-l-[var(--warning)]',
  },
  success: {
    icon: TrendingUp,
    bgColor: 'bg-[var(--accent-light)]',
    iconColor: 'text-[var(--success)]',
    borderColor: 'border-l-[var(--success)]',
  },
  achievement: {
    icon: Trophy,
    bgColor: 'bg-[#FFF8E1]',
    iconColor: 'text-[#FFB300]',
    borderColor: 'border-l-[#FFB300]',
  },
  info: {
    icon: MessageCircle,
    bgColor: 'bg-[#E8EEF0]',
    iconColor: 'text-[var(--info)]',
    borderColor: 'border-l-[var(--info)]',
  },
}

export function CoachInsights({ insights, onDismiss, onAction, className }: CoachInsightsProps) {
  if (insights.length === 0) return null

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">
          Conseils du coach
        </h3>
        <span className="text-sm text-[var(--text-tertiary)]">
          {insights.length} nouveau{insights.length > 1 ? 'x' : ''}
        </span>
      </div>

      <AnimatePresence mode="popLayout">
        {insights.map((insight, index) => (
          <InsightCard
            key={insight.id}
            insight={insight}
            index={index}
            onDismiss={onDismiss}
            onAction={onAction}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

interface InsightCardProps {
  insight: Insight
  index: number
  onDismiss?: (id: string) => void
  onAction?: (id: string) => void
}

function InsightCard({ insight, index, onDismiss, onAction }: InsightCardProps) {
  const config = insightConfig[insight.type]
  const Icon = config.icon

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card
        className={cn(
          'relative overflow-hidden border-l-4',
          config.bgColor,
          config.borderColor
        )}
        padding="default"
      >
        <div className="flex gap-3">
          {/* Icon */}
          <div className={cn('flex-shrink-0 mt-0.5', config.iconColor)}>
            <Icon className="h-5 w-5" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
              {insight.title}
            </h4>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              {insight.message}
            </p>

            {/* Action */}
            {insight.action && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 -ml-2 text-[var(--accent-primary)]"
                onClick={() => {
                  insight.action?.onClick?.()
                  onAction?.(insight.id)
                }}
              >
                {insight.action.label}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>

          {/* Dismiss button */}
          {insight.dismissible !== false && onDismiss && (
            <button
              onClick={() => onDismiss(insight.id)}
              className={cn(
                'flex-shrink-0 p-1 rounded-full -mr-1 -mt-1',
                'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
                'hover:bg-black/5 transition-colors'
              )}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </Card>
    </motion.div>
  )
}

// Single featured insight
export function FeaturedInsight({ insight, onDismiss }: { insight: Insight; onDismiss?: () => void }) {
  const config = insightConfig[insight.type]
  const Icon = config.icon

  return (
    <Card
      className={cn(
        'relative overflow-hidden border-l-4',
        config.bgColor,
        config.borderColor
      )}
      padding="lg"
    >
      <div className="flex gap-4">
        <div className={cn(
          'flex-shrink-0 p-3 rounded-full',
          'bg-white/50'
        )}>
          <Icon className={cn('h-6 w-6', config.iconColor)} />
        </div>

        <div className="flex-1">
          <h4 className="text-base font-semibold text-[var(--text-primary)] mb-1">
            {insight.title}
          </h4>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            {insight.message}
          </p>

          {insight.action && (
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={insight.action.onClick}
            >
              {insight.action.label}
            </Button>
          )}
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className={cn(
              'absolute top-3 right-3 p-1.5 rounded-full',
              'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
              'hover:bg-black/5 transition-colors'
            )}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </Card>
  )
}
