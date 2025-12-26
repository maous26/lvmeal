'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Utensils, TrendingUp, Heart, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface StepWelcomeProps {
  onStart: () => void
  className?: string
}

const features = [
  {
    icon: Utensils,
    title: 'Suivi nutritionnel',
    description: 'Enregistrez vos repas facilement',
  },
  {
    icon: TrendingUp,
    title: 'Objectifs personnalisés',
    description: 'Atteignez vos objectifs santé',
  },
  {
    icon: Heart,
    title: 'Conseils adaptés',
    description: 'LymIA, votre coach a votre ecoute',
  },
  {
    icon: Sparkles,
    title: 'Recettes sur mesure',
    description: 'Des idées adaptées à vos goûts',
  },
]

export function StepWelcome({ onStart, className }: StepWelcomeProps) {
  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Hero section */}
      <div className="text-center py-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[var(--accent-light)] mb-6"
        >
          <span className="text-4xl">🥗</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-3xl font-bold text-[var(--text-primary)] mb-3"
        >
          Bienvenue sur Presence
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-base text-[var(--text-secondary)] max-w-sm mx-auto"
        >
          Votre compagnon nutrition intelligent pour atteindre vos objectifs santé
        </motion.p>
      </div>

      {/* Features grid */}
      <div className="flex-1 py-6">
        <div className="grid grid-cols-2 gap-4">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className={cn(
                  'p-4 rounded-xl bg-[var(--bg-elevated)]',
                  'border border-[var(--border-light)]'
                )}
              >
                <div className="w-10 h-10 rounded-lg bg-[var(--accent-light)] flex items-center justify-center mb-3">
                  <Icon className="h-5 w-5 text-[var(--accent-primary)]" />
                </div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                  {feature.title}
                </h3>
                <p className="text-xs text-[var(--text-tertiary)]">
                  {feature.description}
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="pt-6"
      >
        <Button onClick={onStart} className="w-full" size="lg">
          Commencer
        </Button>
        <p className="text-center text-xs text-[var(--text-tertiary)] mt-4">
          Configuration en 2 minutes
        </p>
      </motion.div>
    </div>
  )
}
