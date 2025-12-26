'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { DietType, ReligiousDiet, UserProfile } from '@/types'

interface StepDietProps {
  data: Partial<UserProfile>
  onChange: (data: Partial<UserProfile>) => void
  className?: string
}

// Types d'alimentation (base)
const dietTypes: {
  value: DietType
  label: string
  emoji: string
  description: string
}[] = [
  {
    value: 'omnivore',
    label: 'Omnivore',
    emoji: '🍖',
    description: 'Je mange de tout',
  },
  {
    value: 'vegetarian',
    label: 'Vegetarien',
    emoji: '🥗',
    description: 'Sans viande ni poisson',
  },
  {
    value: 'vegan',
    label: 'Vegan',
    emoji: '🌱',
    description: 'Sans produit animal',
  },
  {
    value: 'pescatarian',
    label: 'Pescetarien',
    emoji: '🐟',
    description: 'Poisson mais pas de viande',
  },
  {
    value: 'keto',
    label: 'Keto',
    emoji: '🥑',
    description: 'Tres peu de glucides',
  },
  {
    value: 'paleo',
    label: 'Paleo',
    emoji: '🥩',
    description: 'Alimentation ancestrale',
  },
]

// Options religieuses (peuvent se combiner avec le type d'alimentation)
const religiousOptions: {
  value: NonNullable<ReligiousDiet>
  label: string
  emoji: string
  description: string
}[] = [
  {
    value: 'halal',
    label: 'Halal',
    emoji: '🌙',
    description: 'Selon les preceptes islamiques',
  },
  {
    value: 'casher',
    label: 'Casher',
    emoji: '✡️',
    description: 'Selon les lois juives',
  },
]

const commonAllergies = [
  'Gluten',
  'Lactose',
  'Arachides',
  'Fruits a coque',
  'Oeufs',
  'Soja',
  'Crustaces',
  'Poisson',
]

export function StepDiet({ data, onChange, className }: StepDietProps) {
  const [selectedAllergies, setSelectedAllergies] = React.useState<string[]>(
    data.allergies || []
  )

  const toggleAllergy = (allergy: string) => {
    const updated = selectedAllergies.includes(allergy)
      ? selectedAllergies.filter((a) => a !== allergy)
      : [...selectedAllergies, allergy]
    setSelectedAllergies(updated)
    onChange({ ...data, allergies: updated })
  }

  const toggleReligiousDiet = (value: NonNullable<ReligiousDiet>) => {
    // Si deja selectionne, on deselectionne
    if (data.religiousDiet === value) {
      onChange({ ...data, religiousDiet: null })
    } else {
      onChange({ ...data, religiousDiet: value })
    }
  }

  return (
    <div className={cn('space-y-8', className)}>
      {/* Diet type selection */}
      <div>
        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
          Type d&apos;alimentation
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {dietTypes.map((diet, index) => {
            const isSelected = data.dietType === diet.value

            return (
              <motion.button
                key={diet.value}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => onChange({ ...data, dietType: diet.value })}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-xl text-center',
                  'border-2 transition-all duration-200',
                  isSelected
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-light)]'
                    : 'border-[var(--border-light)] bg-[var(--bg-elevated)] hover:border-[var(--border-focus)]'
                )}
              >
                <span className="text-2xl">{diet.emoji}</span>
                <div>
                  <span
                    className={cn(
                      'block font-medium text-sm',
                      isSelected ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'
                    )}
                  >
                    {diet.label}
                  </span>
                  <span className="text-xs text-[var(--text-tertiary)]">
                    {diet.description}
                  </span>
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Religious dietary options - separate section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-2">
          Restriction religieuse
        </h3>
        <p className="text-xs text-[var(--text-tertiary)] mb-3">
          Optionnel - peut se combiner avec ton type d&apos;alimentation
        </p>
        <div className="flex gap-3">
          {religiousOptions.map((option) => {
            const isSelected = data.religiousDiet === option.value

            return (
              <button
                key={option.value}
                onClick={() => toggleReligiousDiet(option.value)}
                className={cn(
                  'flex-1 flex items-center gap-3 p-4 rounded-xl',
                  'border-2 transition-all duration-200',
                  isSelected
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-[var(--border-light)] bg-[var(--bg-elevated)] hover:border-[var(--border-focus)]'
                )}
              >
                <span className="text-2xl">{option.emoji}</span>
                <div className="text-left">
                  <span
                    className={cn(
                      'block font-medium text-sm',
                      isSelected ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--text-primary)]'
                    )}
                  >
                    {option.label}
                  </span>
                  <span className="text-xs text-[var(--text-tertiary)]">
                    {option.description}
                  </span>
                </div>
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="ml-auto w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center"
                  >
                    <span className="text-white text-xs">✓</span>
                  </motion.div>
                )}
              </button>
            )
          })}
        </div>
      </motion.div>

      {/* Allergies */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
          Allergies ou intolerances
        </h3>
        <p className="text-xs text-[var(--text-tertiary)] mb-3">
          Selectionne toutes celles qui s&apos;appliquent (optionnel)
        </p>
        <div className="flex flex-wrap gap-2">
          {commonAllergies.map((allergy) => {
            const isSelected = selectedAllergies.includes(allergy)

            return (
              <button
                key={allergy}
                onClick={() => toggleAllergy(allergy)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium',
                  'border transition-all duration-150',
                  isSelected
                    ? 'border-[var(--error)] bg-[var(--error)]/10 text-[var(--error)]'
                    : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-focus)]'
                )}
              >
                {allergy}
              </button>
            )
          })}
        </div>
      </motion.div>

      {/* Resume selection */}
      {(data.dietType || data.religiousDiet) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-3 rounded-lg bg-[var(--bg-tertiary)]"
        >
          <p className="text-sm text-[var(--text-secondary)] text-center">
            {data.dietType && dietTypes.find(d => d.value === data.dietType)?.label}
            {data.dietType && data.religiousDiet && ' + '}
            {data.religiousDiet && religiousOptions.find(r => r.value === data.religiousDiet)?.label}
          </p>
        </motion.div>
      )}
    </div>
  )
}
