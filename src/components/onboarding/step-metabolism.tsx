'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Heart, Shield, Flame, Snowflake } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserProfile, MetabolismFactors } from '@/types'

interface StepMetabolismProps {
  data: Partial<UserProfile>
  onChange: (data: Partial<UserProfile>) => void
  className?: string
}

// Questions de diagnostic - langage bienveillant, tutoiement
const metabolismQuestions: {
  id: keyof MetabolismFactors
  question: string
  explanation: string
  icon: typeof Heart
}[] = [
  {
    id: 'restrictiveDietsHistory',
    question: 'Tu as déjà fait plusieurs régimes restrictifs ?',
    explanation: 'Ton corps a appris à s\'adapter - c\'est une force !',
    icon: Shield,
  },
  {
    id: 'eatsLessThanHunger',
    question: 'Tu manges souvent beaucoup moins que ta faim réelle ?',
    explanation: 'Écouter sa faim est la clé d\'un équilibre durable',
    icon: Heart,
  },
  {
    id: 'restrictionCrashCycle',
    question: 'Tu as des périodes où tu manges très peu puis craquage ?',
    explanation: 'Ce cycle est naturel quand on se restreint trop',
    icon: Flame,
  },
  {
    id: 'metabolicSymptoms',
    question: 'Fatigue, froid, difficultés à perdre malgré peu de calories ?',
    explanation: 'Ton corps te protège - on va l\'accompagner en douceur',
    icon: Snowflake,
  },
]

export function StepMetabolism({ data, onChange, className }: StepMetabolismProps) {
  const [factors, setFactors] = React.useState<Partial<MetabolismFactors>>(
    data.metabolismFactors || {}
  )

  // Count positive answers to determine profile
  const positiveCount = Object.values(factors).filter(Boolean).length
  const isAdaptive = positiveCount >= 2

  const handleFactorChange = (factorId: keyof MetabolismFactors, value: boolean) => {
    const updated = { ...factors, [factorId]: value }
    setFactors(updated)

    // Determine metabolism profile based on factors (≥2 = adaptive)
    const count = Object.values(updated).filter(Boolean).length
    const profile = count >= 2 ? 'adaptive' : 'standard'

    onChange({
      ...data,
      metabolismFactors: updated as MetabolismFactors,
      metabolismProfile: profile,
    })
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Introduction bienveillante */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-xl bg-gradient-to-r from-[var(--accent-light)] to-transparent border border-[var(--accent-primary)]/20"
      >
        <div className="flex items-start gap-3">
          <Sparkles className="h-6 w-6 text-[var(--accent-primary)] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">
              Mieux te connaître
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Ces questions nous aident à personnaliser ton accompagnement.
              Il n&apos;y a pas de bonne ou mauvaise réponse !
            </p>
          </div>
        </div>
      </motion.div>

      {/* Questions */}
      <div className="space-y-3">
        {metabolismQuestions.map((q, index) => {
          const Icon = q.icon
          const isChecked = factors[q.id] || false

          return (
            <motion.button
              key={q.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              onClick={() => handleFactorChange(q.id, !isChecked)}
              className={cn(
                'w-full flex items-start gap-4 p-4 rounded-xl text-left',
                'border-2 transition-all duration-200',
                isChecked
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-light)]'
                  : 'border-[var(--border-light)] bg-[var(--bg-elevated)] hover:border-[var(--border-focus)]'
              )}
            >
              <div
                className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0',
                  isChecked
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                )}
              >
                <Icon className="h-5 w-5" />
              </div>

              <div className="flex-1 min-w-0">
                <span className="font-medium text-[var(--text-primary)] block">
                  {q.question}
                </span>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">
                  {q.explanation}
                </p>
              </div>

              {/* Checkbox indicator */}
              <div
                className={cn(
                  'w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1',
                  isChecked
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]'
                    : 'border-[var(--border-default)]'
                )}
              >
                {isChecked && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-white text-sm"
                  >
                    ✓
                  </motion.span>
                )}
              </div>
            </motion.button>
          )
        })}
      </div>

      {/* Message adaptatif (visible si ≥2 réponses positives) */}
      {isAdaptive && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-emerald-500/20">
              <Heart className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h4 className="font-semibold text-emerald-700 dark:text-emerald-400">
                On va y aller en douceur
              </h4>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                On va relancer doucement ton métabolisme avec une approche progressive,
                sans frustration. Ton corps va adorer !
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Message standard (si pas adaptatif mais réponses données) */}
      {!isAdaptive && positiveCount > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-3 rounded-lg bg-[var(--bg-tertiary)]"
        >
          <p className="text-sm text-[var(--text-tertiary)] text-center">
            Merci pour ces infos ! On adapte ton programme en conséquence.
          </p>
        </motion.div>
      )}
    </div>
  )
}
