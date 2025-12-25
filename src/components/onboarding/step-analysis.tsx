'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Check, Flame, Beef, Wheat, Droplets, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { ProgressRing } from '@/components/ui/progress-ring'
import type { UserProfile, NutritionalNeeds } from '@/types'
import { formatNumber } from '@/lib/utils'

interface StepAnalysisProps {
  profile: Partial<UserProfile>
  needs: NutritionalNeeds
  className?: string
}

export function StepAnalysis({ profile, needs, className }: StepAnalysisProps) {
  const [showResults, setShowResults] = React.useState(false)

  React.useEffect(() => {
    // Simulate calculation
    const timer = setTimeout(() => {
      setShowResults(true)
    }, 1500)
    return () => clearTimeout(timer)
  }, [])

  if (!showResults) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12', className)}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-20 h-20 rounded-full border-4 border-[var(--border-light)] border-t-[var(--accent-primary)]"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Target className="h-8 w-8 text-[var(--accent-primary)]" />
          </div>
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6 text-lg font-medium text-[var(--text-primary)]"
        >
          Analyse en cours...
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-2 text-sm text-[var(--text-secondary)]"
        >
          Calcul de vos besoins nutritionnels
        </motion.p>
      </div>
    )
  }

  const macros = [
    {
      label: 'Protéines',
      value: needs.proteins,
      unit: 'g',
      icon: Beef,
      color: 'var(--proteins)',
    },
    {
      label: 'Glucides',
      value: needs.carbs,
      unit: 'g',
      icon: Wheat,
      color: 'var(--carbs)',
    },
    {
      label: 'Lipides',
      value: needs.fats,
      unit: 'g',
      icon: Droplets,
      color: 'var(--fats)',
    },
  ]

  return (
    <div className={cn('space-y-6', className)}>
      {/* Success message */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-3 p-4 rounded-xl bg-[var(--accent-light)]"
      >
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[var(--accent-primary)]">
          <Check className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-[var(--text-primary)]">
            Profil analysé avec succès !
          </p>
          <p className="text-sm text-[var(--text-secondary)]">
            Voici vos objectifs personnalisés
          </p>
        </div>
      </motion.div>

      {/* Calories target */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="text-center" padding="lg">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Flame className="h-5 w-5 text-[var(--calories)]" />
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              Objectif calorique quotidien
            </span>
          </div>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-5xl font-bold text-[var(--text-primary)] tabular-nums">
              {formatNumber(needs.calories)}
            </span>
            <span className="text-xl text-[var(--text-tertiary)]">kcal</span>
          </div>
          <p className="text-sm text-[var(--text-tertiary)] mt-2">
            Basé sur votre profil et objectif : {profile.goal === 'weight_loss' ? 'perte de poids' : profile.goal === 'muscle_gain' ? 'prise de muscle' : 'maintien'}
          </p>
        </Card>
      </motion.div>

      {/* Macros breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
          Répartition des macronutriments
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {macros.map((macro, index) => {
            const Icon = macro.icon
            return (
              <motion.div
                key={macro.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + index * 0.1 }}
              >
                <Card className="text-center" padding="default">
                  <div
                    className="mx-auto w-10 h-10 rounded-lg flex items-center justify-center mb-2"
                    style={{ backgroundColor: `${macro.color}20` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: macro.color }} />
                  </div>
                  <div className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">
                    {formatNumber(macro.value)}
                  </div>
                  <div className="text-xs text-[var(--text-tertiary)]">
                    {macro.unit} de {macro.label.toLowerCase()}
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </motion.div>

      {/* Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="p-4 rounded-xl bg-[var(--bg-secondary)]"
      >
        <h4 className="font-medium text-[var(--text-primary)] mb-2">
          Récapitulatif de votre profil
        </h4>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--text-tertiary)]">Prénom</span>
            <span className="text-[var(--text-primary)]">{profile.firstName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-tertiary)]">Taille</span>
            <span className="text-[var(--text-primary)]">{profile.height} cm</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-tertiary)]">Poids actuel</span>
            <span className="text-[var(--text-primary)]">{profile.weight} kg</span>
          </div>
          {profile.targetWeight && (
            <div className="flex justify-between">
              <span className="text-[var(--text-tertiary)]">Objectif</span>
              <span className="text-[var(--text-primary)]">{profile.targetWeight} kg</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-[var(--text-tertiary)]">Régime</span>
            <span className="text-[var(--text-primary)] capitalize">{profile.dietType}</span>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
