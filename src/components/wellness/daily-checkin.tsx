'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Moon, Brain, Zap, X, Check } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useWellnessStore } from '@/stores/wellness-store'
import { cn } from '@/lib/utils'

interface DailyCheckinProps {
  onComplete?: () => void
  className?: string
}

type CheckinStep = 'sleep' | 'stress' | 'energy' | 'complete'

const sleepOptions = [
  { value: 5, label: '<5h', emoji: '😫' },
  { value: 6, label: '5-6h', emoji: '😴' },
  { value: 7, label: '6-7h', emoji: '😊' },
  { value: 8, label: '7-8h', emoji: '😄' },
  { value: 9, label: '8h+', emoji: '🌟' },
]

const sleepQualityOptions = [
  { value: 1 as const, emoji: '😫', label: 'Tres mauvaise' },
  { value: 2 as const, emoji: '😕', label: 'Mauvaise' },
  { value: 3 as const, emoji: '😐', label: 'Moyenne' },
  { value: 4 as const, emoji: '🙂', label: 'Bonne' },
  { value: 5 as const, emoji: '😄', label: 'Excellente' },
]

const stressOptions = [
  { value: 1 as const, emoji: '🧘', label: 'Zen' },
  { value: 2 as const, emoji: '😊', label: 'Calme' },
  { value: 3 as const, emoji: '😐', label: 'Normal' },
  { value: 4 as const, emoji: '😰', label: 'Stresse' },
  { value: 5 as const, emoji: '🤯', label: 'Intense' },
]

const energyOptions = [
  { value: 1 as const, emoji: '🔋', label: 'Epuise' },
  { value: 2 as const, emoji: '😴', label: 'Fatigue' },
  { value: 3 as const, emoji: '😐', label: 'Normal' },
  { value: 4 as const, emoji: '💪', label: 'En forme' },
  { value: 5 as const, emoji: '⚡', label: 'Plein d\'energie' },
]

export function DailyCheckin({ onComplete, className }: DailyCheckinProps) {
  const { logSleep, logStress, logEnergy, getEntryForDate } = useWellnessStore()

  const [step, setStep] = React.useState<CheckinStep>('sleep')
  const [sleepHours, setSleepHours] = React.useState<number | null>(null)
  const [sleepQuality, setSleepQuality] = React.useState<1 | 2 | 3 | 4 | 5 | null>(null)
  const [stressLevel, setStressLevel] = React.useState<1 | 2 | 3 | 4 | 5 | null>(null)
  const [energyLevel, setEnergyLevel] = React.useState<1 | 2 | 3 | 4 | 5 | null>(null)

  const today = new Date().toISOString().split('T')[0]
  const todayEntry = getEntryForDate(today)

  // Check if already completed today
  const alreadyCompleted = todayEntry && todayEntry.sleepHours > 0

  const handleNext = () => {
    if (step === 'sleep' && sleepHours && sleepQuality) {
      logSleep(sleepHours, sleepQuality)
      setStep('stress')
    } else if (step === 'stress' && stressLevel) {
      logStress(stressLevel)
      setStep('energy')
    } else if (step === 'energy' && energyLevel) {
      logEnergy(energyLevel)
      setStep('complete')
      onComplete?.()
    }
  }

  const canProceed = () => {
    switch (step) {
      case 'sleep':
        return sleepHours !== null && sleepQuality !== null
      case 'stress':
        return stressLevel !== null
      case 'energy':
        return energyLevel !== null
      default:
        return false
    }
  }

  if (alreadyCompleted || step === 'complete') {
    return (
      <Card padding="default" className={cn('border-emerald-500/30 bg-emerald-500/5', className)}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-emerald-500/20">
            <Check className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h3 className="font-medium text-[var(--text-primary)]">Check-in complete !</h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Reviens demain pour continuer ton suivi
            </p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card padding="lg" className={className}>
      <div className="space-y-4">
        {/* Header with progress */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[var(--text-primary)]">Check-in du jour</h3>
          <div className="flex gap-1">
            {['sleep', 'stress', 'energy'].map((s, i) => (
              <div
                key={s}
                className={cn(
                  'w-8 h-1 rounded-full transition-colors',
                  i <= ['sleep', 'stress', 'energy'].indexOf(step)
                    ? 'bg-[var(--accent-primary)]'
                    : 'bg-[var(--bg-tertiary)]'
                )}
              />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* SLEEP STEP */}
          {step === 'sleep' && (
            <motion.div
              key="sleep"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2">
                <Moon className="h-5 w-5 text-indigo-500" />
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  Combien as-tu dormi ?
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {sleepOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSleepHours(opt.value)}
                    className={cn(
                      'px-3 py-2 rounded-lg border text-sm transition-all',
                      sleepHours === opt.value
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600'
                        : 'border-[var(--border-default)] hover:border-[var(--border-hover)]'
                    )}
                  >
                    <span className="mr-1">{opt.emoji}</span>
                    {opt.label}
                  </button>
                ))}
              </div>

              {sleepHours && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                >
                  <p className="text-sm text-[var(--text-secondary)] mb-2">
                    Qualite du sommeil ?
                  </p>
                  <div className="flex gap-2">
                    {sleepQualityOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setSleepQuality(opt.value)}
                        className={cn(
                          'flex-1 py-3 rounded-lg border text-center transition-all',
                          sleepQuality === opt.value
                            ? 'border-indigo-500 bg-indigo-500/10'
                            : 'border-[var(--border-default)] hover:border-[var(--border-hover)]'
                        )}
                      >
                        <span className="text-xl">{opt.emoji}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* STRESS STEP */}
          {step === 'stress' && (
            <motion.div
              key="stress"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-rose-500" />
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  Ton niveau de stress ?
                </span>
              </div>

              <div className="flex gap-2">
                {stressOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setStressLevel(opt.value)}
                    className={cn(
                      'flex-1 py-4 rounded-lg border text-center transition-all',
                      stressLevel === opt.value
                        ? 'border-rose-500 bg-rose-500/10'
                        : 'border-[var(--border-default)] hover:border-[var(--border-hover)]'
                    )}
                  >
                    <span className="text-2xl block mb-1">{opt.emoji}</span>
                    <span className="text-xs text-[var(--text-secondary)]">{opt.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ENERGY STEP */}
          {step === 'energy' && (
            <motion.div
              key="energy"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  Ton niveau d'energie ?
                </span>
              </div>

              <div className="flex gap-2">
                {energyOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setEnergyLevel(opt.value)}
                    className={cn(
                      'flex-1 py-4 rounded-lg border text-center transition-all',
                      energyLevel === opt.value
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-[var(--border-default)] hover:border-[var(--border-hover)]'
                    )}
                  >
                    <span className="text-2xl block mb-1">{opt.emoji}</span>
                    <span className="text-xs text-[var(--text-secondary)]">{opt.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleNext}
            disabled={!canProceed()}
            className="px-6"
          >
            {step === 'energy' ? 'Terminer' : 'Suivant'}
          </Button>
        </div>
      </div>
    </Card>
  )
}
