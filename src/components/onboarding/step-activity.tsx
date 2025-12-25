'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Armchair, Footprints, Bike, Dumbbell, Medal } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ActivityLevel, UserProfile } from '@/types'

interface StepActivityProps {
  data: Partial<UserProfile>
  onChange: (data: Partial<UserProfile>) => void
  className?: string
}

const activityLevels: {
  value: ActivityLevel
  label: string
  description: string
  icon: typeof Armchair
  multiplier: string
}[] = [
  {
    value: 'sedentary',
    label: 'Sédentaire',
    description: 'Travail de bureau, peu de marche',
    icon: Armchair,
    multiplier: 'x1.2',
  },
  {
    value: 'light',
    label: 'Légèrement actif',
    description: 'Marche quotidienne, activité légère',
    icon: Footprints,
    multiplier: 'x1.4',
  },
  {
    value: 'moderate',
    label: 'Modérément actif',
    description: 'Exercice 3-5 fois par semaine',
    icon: Bike,
    multiplier: 'x1.6',
  },
  {
    value: 'active',
    label: 'Très actif',
    description: 'Exercice intense 6-7 fois par semaine',
    icon: Dumbbell,
    multiplier: 'x1.8',
  },
  {
    value: 'athlete',
    label: 'Athlète',
    description: 'Entraînement intensif quotidien',
    icon: Medal,
    multiplier: 'x2.0',
  },
]

export function StepActivity({ data, onChange, className }: StepActivityProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {activityLevels.map((level, index) => {
        const Icon = level.icon
        const isSelected = data.activityLevel === level.value

        return (
          <motion.button
            key={level.value}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onChange({ ...data, activityLevel: level.value })}
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
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'font-semibold',
                    isSelected ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'
                  )}
                >
                  {level.label}
                </span>
                <span
                  className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded-full',
                    isSelected
                      ? 'bg-[var(--accent-primary)] text-white'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
                  )}
                >
                  {level.multiplier}
                </span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                {level.description}
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
