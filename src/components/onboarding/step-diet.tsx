'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { DietType, UserProfile } from '@/types'

interface StepDietProps {
  data: Partial<UserProfile>
  onChange: (data: Partial<UserProfile>) => void
  className?: string
}

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
    label: 'Végétarien',
    emoji: '🥗',
    description: 'Sans viande ni poisson',
  },
  {
    value: 'vegan',
    label: 'Végan',
    emoji: '🌱',
    description: 'Sans produit animal',
  },
  {
    value: 'pescatarian',
    label: 'Pescétarien',
    emoji: '🐟',
    description: 'Poisson mais pas de viande',
  },
  {
    value: 'keto',
    label: 'Keto',
    emoji: '🥑',
    description: 'Très peu de glucides',
  },
  {
    value: 'paleo',
    label: 'Paléo',
    emoji: '🥩',
    description: 'Alimentation ancestrale',
  },
]

const commonAllergies = [
  'Gluten',
  'Lactose',
  'Arachides',
  'Fruits à coque',
  'Œufs',
  'Soja',
  'Crustacés',
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

      {/* Allergies */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
          Allergies ou intolérances
        </h3>
        <p className="text-xs text-[var(--text-tertiary)] mb-3">
          Sélectionnez toutes celles qui s&apos;appliquent (optionnel)
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
    </div>
  )
}
