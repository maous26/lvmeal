'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { TrendingDown, Dumbbell, Scale, Heart, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Goal, UserProfile } from '@/types'

interface StepGoalProps {
  data: Partial<UserProfile>
  onChange: (data: Partial<UserProfile>) => void
  className?: string
}

const goals: {
  value: Goal
  label: string
  description: string
  icon: typeof TrendingDown
  calorieAdjust: string
}[] = [
  {
    value: 'weight_loss',
    label: 'Perdre du poids',
    description: 'Créer un déficit calorique progressif et sain',
    icon: TrendingDown,
    calorieAdjust: '-300 à -500 kcal',
  },
  {
    value: 'muscle_gain',
    label: 'Prendre du muscle',
    description: 'Augmenter la masse musculaire avec un surplus contrôlé',
    icon: Dumbbell,
    calorieAdjust: '+200 à +400 kcal',
  },
  {
    value: 'maintenance',
    label: 'Maintenir mon poids',
    description: 'Équilibrer apports et dépenses caloriques',
    icon: Scale,
    calorieAdjust: 'Équilibre',
  },
  {
    value: 'health',
    label: 'Améliorer ma santé',
    description: 'Optimiser la qualité nutritionnelle de mon alimentation',
    icon: Heart,
    calorieAdjust: 'Personnalisé',
  },
  {
    value: 'energy',
    label: 'Plus d\'énergie',
    description: 'Améliorer vitalité et performance au quotidien',
    icon: Zap,
    calorieAdjust: 'Personnalisé',
  },
]

export function StepGoal({ data, onChange, className }: StepGoalProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {goals.map((goal, index) => {
        const Icon = goal.icon
        const isSelected = data.goal === goal.value

        return (
          <motion.button
            key={goal.value}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onChange({ ...data, goal: goal.value })}
            className={cn(
              'w-full flex items-center gap-4 p-4 rounded-xl text-left',
              'border-2 transition-all duration-200',
              isSelected
                ? 'border-[var(--accent-primary)] bg-[var(--accent-light)]'
                : 'border-[var(--border-light)] bg-[var(--bg-elevated)] hover:border-[var(--border-focus)]'
            )}
          >
            <div
              className={cn(
                'flex items-center justify-center w-12 h-12 rounded-xl',
                isSelected
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
              )}
            >
              <Icon className="h-6 w-6" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'font-semibold',
                    isSelected ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'
                  )}
                >
                  {goal.label}
                </span>
                <span
                  className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap',
                    isSelected
                      ? 'bg-[var(--accent-primary)] text-white'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
                  )}
                >
                  {goal.calorieAdjust}
                </span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                {goal.description}
              </p>
            </div>

            {/* Selection indicator */}
            <div
              className={cn(
                'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                isSelected
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]'
                  : 'border-[var(--border-default)]'
              )}
            >
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-2 h-2 rounded-full bg-white"
                />
              )}
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}
