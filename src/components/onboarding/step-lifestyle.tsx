'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Moon, Droplets, Brain, Battery, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserProfile, LifestyleHabits } from '@/types'

interface StepLifestyleProps {
  data: Partial<UserProfile>
  onChange: (data: Partial<UserProfile>) => void
  className?: string
}

const sleepOptions = [
  { value: 5, label: '< 5h', emoji: '😴' },
  { value: 6, label: '5-6h', emoji: '🥱' },
  { value: 7, label: '6-7h', emoji: '😊' },
  { value: 8, label: '7-8h', emoji: '😌' },
  { value: 9, label: '8h+', emoji: '💤' },
]

const sleepQualityOptions: {
  value: LifestyleHabits['sleepQualityPerception']
  label: string
  emoji: string
}[] = [
  { value: 'poor', label: 'Difficile', emoji: '😫' },
  { value: 'average', label: 'Moyen', emoji: '😐' },
  { value: 'good', label: 'Bon', emoji: '🙂' },
  { value: 'excellent', label: 'Excellent', emoji: '😴' },
]

const stressOptions: {
  value: LifestyleHabits['stressLevelDaily']
  label: string
  emoji: string
  description: string
}[] = [
  { value: 'low', label: 'Zen', emoji: '🧘', description: 'Rarement stressé(e)' },
  { value: 'moderate', label: 'Modéré', emoji: '😊', description: 'Parfois stressé(e)' },
  { value: 'high', label: 'Élevé', emoji: '😰', description: 'Souvent stressé(e)' },
  { value: 'very_high', label: 'Intense', emoji: '🤯', description: 'Stress constant' },
]

const waterOptions = [
  { value: 0.5, label: '< 1L', emoji: '💧' },
  { value: 1, label: '1L', emoji: '💧💧' },
  { value: 1.5, label: '1.5L', emoji: '💧💧💧' },
  { value: 2, label: '2L', emoji: '🌊' },
  { value: 2.5, label: '2.5L+', emoji: '🌊🌊' },
]

export function StepLifestyle({ data, onChange, className }: StepLifestyleProps) {
  const [habits, setHabits] = React.useState<Partial<LifestyleHabits>>(
    data.lifestyleHabits || {}
  )

  const updateHabits = (updates: Partial<LifestyleHabits>) => {
    const updated = { ...habits, ...updates }
    setHabits(updated)
    onChange({
      ...data,
      lifestyleHabits: updated as LifestyleHabits,
    })
  }

  return (
    <div className={cn('space-y-8', className)}>
      {/* Introduction */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20"
      >
        <div className="flex items-start gap-3">
          <Sun className="h-6 w-6 text-indigo-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">
              Tes habitudes quotidiennes
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Le sommeil, le stress et l&apos;hydratation jouent un rôle clé dans ton bien-être
              et ton métabolisme. On en tient compte !
            </p>
          </div>
        </div>
      </motion.div>

      {/* Sleep Duration */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Moon className="h-5 w-5 text-indigo-500" />
          <h3 className="text-sm font-medium text-[var(--text-secondary)]">
            Tu dors combien d&apos;heures en moyenne ?
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {sleepOptions.map((option) => {
            const isSelected = habits.averageSleepHours === option.value

            return (
              <button
                key={option.value}
                onClick={() => updateHabits({ averageSleepHours: option.value })}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl',
                  'border-2 transition-all duration-200',
                  isSelected
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-[var(--border-light)] bg-[var(--bg-elevated)] hover:border-[var(--border-focus)]'
                )}
              >
                <span className="text-lg">{option.emoji}</span>
                <span
                  className={cn(
                    'font-medium text-sm',
                    isSelected ? 'text-indigo-500' : 'text-[var(--text-primary)]'
                  )}
                >
                  {option.label}
                </span>
              </button>
            )
          })}
        </div>
      </motion.div>

      {/* Sleep Quality */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Battery className="h-5 w-5 text-purple-500" />
          <h3 className="text-sm font-medium text-[var(--text-secondary)]">
            Comment est ton sommeil en général ?
          </h3>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {sleepQualityOptions.map((option) => {
            const isSelected = habits.sleepQualityPerception === option.value

            return (
              <button
                key={option.value}
                onClick={() => updateHabits({ sleepQualityPerception: option.value })}
                className={cn(
                  'flex flex-col items-center gap-1 p-3 rounded-xl',
                  'border-2 transition-all duration-200',
                  isSelected
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-[var(--border-light)] bg-[var(--bg-elevated)] hover:border-[var(--border-focus)]'
                )}
              >
                <span className="text-2xl">{option.emoji}</span>
                <span
                  className={cn(
                    'font-medium text-xs',
                    isSelected ? 'text-purple-500' : 'text-[var(--text-primary)]'
                  )}
                >
                  {option.label}
                </span>
              </button>
            )
          })}
        </div>
      </motion.div>

      {/* Stress Level */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Brain className="h-5 w-5 text-rose-500" />
          <h3 className="text-sm font-medium text-[var(--text-secondary)]">
            Ton niveau de stress au quotidien ?
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {stressOptions.map((option) => {
            const isSelected = habits.stressLevelDaily === option.value

            return (
              <button
                key={option.value}
                onClick={() => updateHabits({ stressLevelDaily: option.value })}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl text-left',
                  'border-2 transition-all duration-200',
                  isSelected
                    ? 'border-rose-500 bg-rose-500/10'
                    : 'border-[var(--border-light)] bg-[var(--bg-elevated)] hover:border-[var(--border-focus)]'
                )}
              >
                <span className="text-2xl">{option.emoji}</span>
                <div>
                  <span
                    className={cn(
                      'font-medium text-sm block',
                      isSelected ? 'text-rose-500' : 'text-[var(--text-primary)]'
                    )}
                  >
                    {option.label}
                  </span>
                  <span className="text-xs text-[var(--text-tertiary)]">
                    {option.description}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </motion.div>

      {/* Water Intake */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Droplets className="h-5 w-5 text-cyan-500" />
          <h3 className="text-sm font-medium text-[var(--text-secondary)]">
            Tu bois combien d&apos;eau par jour ?
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {waterOptions.map((option) => {
            const isSelected = habits.waterIntakeDaily === option.value

            return (
              <button
                key={option.value}
                onClick={() => updateHabits({ waterIntakeDaily: option.value })}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl',
                  'border-2 transition-all duration-200',
                  isSelected
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-[var(--border-light)] bg-[var(--bg-elevated)] hover:border-[var(--border-focus)]'
                )}
              >
                <span className="text-sm">{option.emoji}</span>
                <span
                  className={cn(
                    'font-medium text-sm',
                    isSelected ? 'text-cyan-500' : 'text-[var(--text-primary)]'
                  )}
                >
                  {option.label}
                </span>
              </button>
            )
          })}
        </div>
      </motion.div>

      {/* Personalized Message based on selections */}
      {habits.averageSleepHours && habits.stressLevelDaily && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 rounded-xl bg-gradient-to-r from-[var(--accent-light)] to-transparent border border-[var(--accent-primary)]/20"
        >
          <p className="text-sm text-[var(--text-secondary)]">
            {habits.averageSleepHours < 7 && habits.stressLevelDaily !== 'low'
              ? "On va t'aider à améliorer ton sommeil et gérer ton stress - ça fait toute la différence pour ton métabolisme et ton énergie !"
              : habits.averageSleepHours < 7
              ? "Améliorer ton sommeil pourrait vraiment booster ton énergie et tes résultats. On t'accompagne !"
              : habits.stressLevelDaily === 'high' || habits.stressLevelDaily === 'very_high'
              ? "Le stress peut impacter ton métabolisme. On va intégrer des conseils pour t'aider à le gérer."
              : "Super ! Tes habitudes sont une bonne base. On va construire là-dessus !"}
          </p>
        </motion.div>
      )}
    </div>
  )
}
