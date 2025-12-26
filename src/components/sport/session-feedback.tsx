'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Heart, ThumbsUp, ThumbsDown, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GeneratedSession, SessionFeedback, PerceivedDifficulty, EnergyAfterSession } from '@/types/sport'

interface SessionFeedbackModalProps {
  session: GeneratedSession
  isOpen: boolean
  onClose: () => void
  onSubmit: (feedback: Omit<SessionFeedback, 'sessionId' | 'date'>) => void
}

const feelingEmojis = [
  { value: 1, emoji: '😫', label: 'Très difficile' },
  { value: 2, emoji: '😕', label: 'Difficile' },
  { value: 3, emoji: '😐', label: 'Correct' },
  { value: 4, emoji: '🙂', label: 'Bien' },
  { value: 5, emoji: '😄', label: 'Super !' },
]

const difficultyOptions: { value: PerceivedDifficulty; label: string; color: string }[] = [
  { value: 'too_easy', label: 'Trop facile', color: 'text-blue-500' },
  { value: 'just_right', label: 'Parfait', color: 'text-green-500' },
  { value: 'challenging', label: 'Challengeant', color: 'text-orange-500' },
  { value: 'too_hard', label: 'Trop dur', color: 'text-red-500' },
]

const energyOptions: { value: EnergyAfterSession; label: string; emoji: string }[] = [
  { value: 'exhausted', label: 'Épuisé(e)', emoji: '😴' },
  { value: 'tired', label: 'Fatigué(e)', emoji: '😓' },
  { value: 'good', label: 'Bien', emoji: '😊' },
  { value: 'energized', label: 'En forme !', emoji: '⚡' },
]

export function SessionFeedbackModal({
  session,
  isOpen,
  onClose,
  onSubmit,
}: SessionFeedbackModalProps) {
  const [step, setStep] = React.useState(1)
  const [feedback, setFeedback] = React.useState<{
    overallFeeling: 1 | 2 | 3 | 4 | 5
    perceivedDifficulty: PerceivedDifficulty
    energyAfter: EnergyAfterSession
    likedExercises: string[]
    dislikedExercises: string[]
    painOrDiscomfort: string
    actualDuration: number
    comment: string
  }>({
    overallFeeling: 3,
    perceivedDifficulty: 'just_right',
    energyAfter: 'good',
    likedExercises: [],
    dislikedExercises: [],
    painOrDiscomfort: '',
    actualDuration: session.duration,
    comment: '',
  })

  const handleSubmit = () => {
    onSubmit(feedback)
    onClose()
  }

  const toggleExercise = (exerciseId: string, type: 'liked' | 'disliked') => {
    if (type === 'liked') {
      const isLiked = feedback.likedExercises.includes(exerciseId)
      setFeedback({
        ...feedback,
        likedExercises: isLiked
          ? feedback.likedExercises.filter((id) => id !== exerciseId)
          : [...feedback.likedExercises, exerciseId],
        dislikedExercises: feedback.dislikedExercises.filter((id) => id !== exerciseId),
      })
    } else {
      const isDisliked = feedback.dislikedExercises.includes(exerciseId)
      setFeedback({
        ...feedback,
        dislikedExercises: isDisliked
          ? feedback.dislikedExercises.filter((id) => id !== exerciseId)
          : [...feedback.dislikedExercises, exerciseId],
        likedExercises: feedback.likedExercises.filter((id) => id !== exerciseId),
      })
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-[var(--bg-primary)] rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-light)]">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Comment tu te sens ?
                </h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  {session.title}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-[var(--bg-secondary)] transition-colors"
              >
                <X className="h-5 w-5 text-[var(--text-tertiary)]" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Step 1: Overall feeling */}
              {step === 1 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <h3 className="text-sm font-medium text-[var(--text-secondary)]">
                    Comment tu te sens après cette séance ?
                  </h3>
                  <div className="flex justify-between gap-2">
                    {feelingEmojis.map((item) => (
                      <button
                        key={item.value}
                        onClick={() => setFeedback({ ...feedback, overallFeeling: item.value as 1 | 2 | 3 | 4 | 5 })}
                        className={cn(
                          'flex-1 flex flex-col items-center gap-1 p-3 rounded-xl transition-all',
                          'border-2',
                          feedback.overallFeeling === item.value
                            ? 'border-[var(--accent-primary)] bg-[var(--accent-light)]'
                            : 'border-transparent bg-[var(--bg-secondary)]'
                        )}
                      >
                        <span className="text-3xl">{item.emoji}</span>
                        <span className="text-xs text-[var(--text-tertiary)]">
                          {item.label}
                        </span>
                      </button>
                    ))}
                  </div>

                  <h3 className="text-sm font-medium text-[var(--text-secondary)] mt-6">
                    C&apos;était comment niveau difficulté ?
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {difficultyOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setFeedback({ ...feedback, perceivedDifficulty: option.value })}
                        className={cn(
                          'p-3 rounded-xl text-center transition-all',
                          'border-2',
                          feedback.perceivedDifficulty === option.value
                            ? 'border-[var(--accent-primary)] bg-[var(--accent-light)]'
                            : 'border-transparent bg-[var(--bg-secondary)]'
                        )}
                      >
                        <span className={cn('font-medium', option.color)}>
                          {option.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Step 2: Energy and exercises */}
              {step === 2 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <h3 className="text-sm font-medium text-[var(--text-secondary)]">
                    Ton niveau d&apos;énergie maintenant ?
                  </h3>
                  <div className="flex justify-between gap-2">
                    {energyOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setFeedback({ ...feedback, energyAfter: option.value })}
                        className={cn(
                          'flex-1 flex flex-col items-center gap-1 p-3 rounded-xl transition-all',
                          'border-2',
                          feedback.energyAfter === option.value
                            ? 'border-[var(--accent-primary)] bg-[var(--accent-light)]'
                            : 'border-transparent bg-[var(--bg-secondary)]'
                        )}
                      >
                        <span className="text-2xl">{option.emoji}</span>
                        <span className="text-xs text-[var(--text-tertiary)]">
                          {option.label}
                        </span>
                      </button>
                    ))}
                  </div>

                  {session.exercises.length > 0 && (
                    <>
                      <h3 className="text-sm font-medium text-[var(--text-secondary)] mt-6">
                        Quels exercices tu as aimés ?
                      </h3>
                      <div className="space-y-2">
                        {session.exercises.map((exercise) => {
                          const isLiked = feedback.likedExercises.includes(exercise.id)
                          const isDisliked = feedback.dislikedExercises.includes(exercise.id)

                          return (
                            <div
                              key={exercise.id}
                              className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-secondary)]"
                            >
                              <span className="text-sm text-[var(--text-primary)]">
                                {exercise.name}
                              </span>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => toggleExercise(exercise.id, 'liked')}
                                  className={cn(
                                    'p-2 rounded-lg transition-colors',
                                    isLiked
                                      ? 'bg-green-500/20 text-green-500'
                                      : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
                                  )}
                                >
                                  <ThumbsUp className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => toggleExercise(exercise.id, 'disliked')}
                                  className={cn(
                                    'p-2 rounded-lg transition-colors',
                                    isDisliked
                                      ? 'bg-red-500/20 text-red-500'
                                      : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
                                  )}
                                >
                                  <ThumbsDown className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </motion.div>
              )}

              {/* Step 3: Pain and comments */}
              {step === 3 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="text-sm font-medium text-amber-600 dark:text-amber-400">
                          Un inconfort quelque part ?
                        </h3>
                        <p className="text-xs text-[var(--text-secondary)] mt-1">
                          Dis-nous si tu as ressenti une douleur (optionnel)
                        </p>
                      </div>
                    </div>
                  </div>

                  <input
                    type="text"
                    placeholder="Ex: Légère douleur au genou droit..."
                    value={feedback.painOrDiscomfort}
                    onChange={(e) => setFeedback({ ...feedback, painOrDiscomfort: e.target.value })}
                    className="w-full p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-light)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />

                  <h3 className="text-sm font-medium text-[var(--text-secondary)] mt-4">
                    Durée réelle de la séance
                  </h3>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min={5}
                      max={60}
                      step={5}
                      value={feedback.actualDuration}
                      onChange={(e) => setFeedback({ ...feedback, actualDuration: parseInt(e.target.value) })}
                      className="flex-1 accent-[var(--accent-primary)]"
                    />
                    <span className="text-sm font-medium text-[var(--text-primary)] w-16 text-right">
                      {feedback.actualDuration} min
                    </span>
                  </div>

                  <h3 className="text-sm font-medium text-[var(--text-secondary)] mt-4">
                    Un commentaire ? (optionnel)
                  </h3>
                  <textarea
                    placeholder="Partage ton ressenti..."
                    value={feedback.comment}
                    onChange={(e) => setFeedback({ ...feedback, comment: e.target.value })}
                    rows={3}
                    className="w-full p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-light)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)] resize-none"
                  />
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[var(--border-light)] flex gap-3">
              {step > 1 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="px-4 py-3 rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)] font-medium"
                >
                  Retour
                </button>
              )}
              <button
                onClick={() => {
                  if (step < 3) {
                    setStep(step + 1)
                  } else {
                    handleSubmit()
                  }
                }}
                className="flex-1 px-4 py-3 rounded-xl bg-[var(--accent-primary)] text-white font-medium"
              >
                {step < 3 ? 'Suivant' : 'Terminer'}
              </button>
            </div>

            {/* Progress dots */}
            <div className="flex justify-center gap-2 pb-4">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={cn(
                    'w-2 h-2 rounded-full transition-colors',
                    s === step ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-tertiary)]'
                  )}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
