'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Pause,
  Check,
  ChevronRight,
  ChevronLeft,
  Clock,
  Dumbbell,
  Footprints,
  Sparkles,
  Volume2,
  VolumeX,
  RotateCcw,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/ui/progress-bar'
import { cn } from '@/lib/utils'
import type { GeneratedSession, Exercise } from '@/types/sport'

interface SportSessionProps {
  session: GeneratedSession
  onComplete: () => void
  onBack: () => void
}

const sessionTypeIcons = {
  walking: Footprints,
  resistance: Dumbbell,
  cardio: Play,
  recovery: RotateCcw,
  stretching: Sparkles,
  hiit: Play,
}

const sessionTypeLabels = {
  walking: 'Marche',
  resistance: 'Renforcement',
  cardio: 'Cardio',
  recovery: 'Récupération',
  stretching: 'Étirements',
  hiit: 'HIIT',
}

export function SportSession({ session, onComplete, onBack }: SportSessionProps) {
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [currentExerciseIndex, setCurrentExerciseIndex] = React.useState(0)
  const [currentSet, setCurrentSet] = React.useState(1)
  const [timeRemaining, setTimeRemaining] = React.useState(0)
  const [isResting, setIsResting] = React.useState(false)
  const [completedExercises, setCompletedExercises] = React.useState<Set<string>>(new Set())
  const [isSoundEnabled, setIsSoundEnabled] = React.useState(true)
  const [sessionStarted, setSessionStarted] = React.useState(false)
  const [sessionTime, setSessionTime] = React.useState(0)

  const allExercises = React.useMemo(() => {
    const exercises: Exercise[] = []
    if (session.warmup) exercises.push(...session.warmup)
    exercises.push(...session.exercises)
    if (session.cooldown) exercises.push(...session.cooldown)
    return exercises
  }, [session])

  const currentExercise = allExercises[currentExerciseIndex]
  const totalExercises = allExercises.length
  const progress = ((currentExerciseIndex + 1) / totalExercises) * 100

  // Timer for session
  React.useEffect(() => {
    let interval: NodeJS.Timeout
    if (sessionStarted && isPlaying) {
      interval = setInterval(() => {
        setSessionTime((t) => t + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [sessionStarted, isPlaying])

  // Timer for exercise duration
  React.useEffect(() => {
    if (!isPlaying || !currentExercise) return

    // Initialize timer based on exercise type
    if (currentExercise.duration && timeRemaining === 0 && !isResting) {
      setTimeRemaining(currentExercise.duration)
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Timer finished
          if (isResting) {
            // Rest finished, move to next set or exercise
            setIsResting(false)
            if (currentExercise.sets && currentSet < currentExercise.sets) {
              setCurrentSet(currentSet + 1)
              return currentExercise.duration || 0
            } else {
              // Exercise complete
              handleExerciseComplete()
              return 0
            }
          } else {
            // Exercise duration finished
            if (currentExercise.sets && currentSet < currentExercise.sets) {
              // Start rest period
              setIsResting(true)
              return currentExercise.restBetweenSets || 30
            } else {
              // Exercise complete
              handleExerciseComplete()
              return 0
            }
          }
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isPlaying, isResting, currentSet, currentExercise])

  const handleExerciseComplete = () => {
    if (!currentExercise) return

    setCompletedExercises((prev) => new Set([...prev, currentExercise.id]))
    setCurrentSet(1)
    setIsResting(false)

    if (currentExerciseIndex < totalExercises - 1) {
      setCurrentExerciseIndex((i) => i + 1)
      const nextExercise = allExercises[currentExerciseIndex + 1]
      setTimeRemaining(nextExercise?.duration || 0)
    } else {
      // All exercises completed
      setIsPlaying(false)
      onComplete()
    }
  }

  const handleStart = () => {
    setSessionStarted(true)
    setIsPlaying(true)
    if (currentExercise?.duration) {
      setTimeRemaining(currentExercise.duration)
    }
  }

  const handlePause = () => {
    setIsPlaying(false)
  }

  const handleResume = () => {
    setIsPlaying(true)
  }

  const handleSkipExercise = () => {
    handleExerciseComplete()
  }

  const handlePreviousExercise = () => {
    if (currentExerciseIndex > 0) {
      setCurrentExerciseIndex((i) => i - 1)
      setCurrentSet(1)
      setIsResting(false)
      const prevExercise = allExercises[currentExerciseIndex - 1]
      setTimeRemaining(prevExercise?.duration || 0)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const Icon = sessionTypeIcons[session.type] || Play

  // Not started yet - show intro
  if (!sessionStarted) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] pb-20">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[var(--bg-primary)]/95 backdrop-blur-lg border-b border-[var(--border-light)]">
          <div className="flex items-center justify-between h-14 px-4">
            <button
              onClick={onBack}
              className="p-2 -ml-2 rounded-full hover:bg-[var(--bg-secondary)]"
            >
              <ChevronLeft className="h-5 w-5 text-[var(--text-secondary)]" />
            </button>
            <h1 className="text-base font-semibold text-[var(--text-primary)]">
              {sessionTypeLabels[session.type]}
            </h1>
            <div className="w-9" />
          </div>
        </div>

        <div className="p-4 space-y-6">
          {/* Session intro */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center pt-8"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
              <Icon className="h-10 w-10 text-violet-500" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
              {session.title}
            </h2>
            <p className="text-[var(--text-secondary)] mb-4">
              {session.description}
            </p>
            <div className="flex items-center justify-center gap-4 text-sm text-[var(--text-tertiary)]">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {session.duration} min
              </span>
              <span className="flex items-center gap-1">
                <Dumbbell className="h-4 w-4" />
                {totalExercises} exercices
              </span>
            </div>
          </motion.div>

          {/* Exercises preview */}
          <Card padding="default">
            <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
              Programme de la séance
            </h3>
            <div className="space-y-2">
              {allExercises.map((exercise, index) => (
                <div
                  key={exercise.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-[var(--bg-secondary)]"
                >
                  <span className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-500 text-xs flex items-center justify-center font-medium">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {exercise.name}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      {exercise.sets && exercise.reps
                        ? `${exercise.sets} séries × ${exercise.reps} reps`
                        : exercise.duration
                        ? `${Math.floor(exercise.duration / 60)} min`
                        : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* LymIA tip */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="p-4 rounded-xl bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-violet-600 dark:text-violet-400">
                  Conseil LymIA
                </p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  {session.aiReasoning || 'Écoute ton corps et adapte l\'intensité selon ton ressenti. L\'important c\'est de bouger avec plaisir !'}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Start button */}
          <Button
            size="lg"
            className="w-full h-14 text-lg"
            onClick={handleStart}
          >
            <Play className="h-5 w-5 mr-2" />
            Commencer la séance
          </Button>
        </div>
      </div>
    )
  }

  // Session in progress
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-20">
      {/* Header with progress */}
      <div className="sticky top-0 z-10 bg-[var(--bg-primary)]/95 backdrop-blur-lg">
        <div className="flex items-center justify-between h-14 px-4">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-full hover:bg-[var(--bg-secondary)]"
          >
            <ChevronLeft className="h-5 w-5 text-[var(--text-secondary)]" />
          </button>
          <div className="text-center">
            <p className="text-xs text-[var(--text-tertiary)]">
              Exercice {currentExerciseIndex + 1}/{totalExercises}
            </p>
            <p className="text-sm font-medium text-[var(--text-primary)]">
              {formatTime(sessionTime)}
            </p>
          </div>
          <button
            onClick={() => setIsSoundEnabled(!isSoundEnabled)}
            className="p-2 rounded-full hover:bg-[var(--bg-secondary)]"
          >
            {isSoundEnabled ? (
              <Volume2 className="h-5 w-5 text-[var(--text-secondary)]" />
            ) : (
              <VolumeX className="h-5 w-5 text-[var(--text-tertiary)]" />
            )}
          </button>
        </div>
        <ProgressBar value={progress} max={100} color="var(--accent-primary)" size="sm" />
      </div>

      <div className="p-4 space-y-6">
        {/* Current exercise */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentExercise?.id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="space-y-4"
          >
            {/* Exercise visual */}
            <div className="relative aspect-video bg-[var(--bg-secondary)] rounded-2xl overflow-hidden">
              {currentExercise?.imageUrl ? (
                <img
                  src={currentExercise.imageUrl}
                  alt={currentExercise.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Icon className="h-20 w-20 text-[var(--text-tertiary)]" />
                </div>
              )}

              {/* Timer overlay */}
              {(currentExercise?.duration || isResting) && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <div className="text-center">
                    <p className={cn(
                      'text-5xl font-bold',
                      isResting ? 'text-amber-400' : 'text-white'
                    )}>
                      {formatTime(timeRemaining)}
                    </p>
                    {isResting && (
                      <p className="text-amber-400 text-sm mt-1">Repos</p>
                    )}
                    {currentExercise?.sets && (
                      <p className="text-white/80 text-sm mt-1">
                        Série {currentSet}/{currentExercise.sets}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Exercise info */}
            <div className="text-center">
              <h2 className="text-xl font-bold text-[var(--text-primary)]">
                {currentExercise?.name}
              </h2>
              <p className="text-[var(--text-secondary)] mt-1">
                {currentExercise?.description}
              </p>

              {/* Sets/reps info */}
              {currentExercise?.sets && currentExercise?.reps && (
                <div className="flex items-center justify-center gap-4 mt-3">
                  <div className="px-4 py-2 rounded-lg bg-[var(--bg-secondary)]">
                    <p className="text-lg font-bold text-[var(--text-primary)]">
                      {currentExercise.reps}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">reps</p>
                  </div>
                  <div className="px-4 py-2 rounded-lg bg-[var(--bg-secondary)]">
                    <p className="text-lg font-bold text-[var(--text-primary)]">
                      {currentSet}/{currentExercise.sets}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">séries</p>
                  </div>
                </div>
              )}
            </div>

            {/* Tips */}
            {currentExercise?.tips && currentExercise.tips.length > 0 && (
              <Card padding="default" className="bg-violet-500/10 border-violet-500/20">
                <p className="text-xs font-medium text-violet-600 dark:text-violet-400 mb-1">
                  💡 Conseil
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {currentExercise.tips[0]}
                </p>
              </Card>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Controls */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-[var(--bg-primary)] border-t border-[var(--border-light)]">
          <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
            <Button
              variant="outline"
              size="lg"
              onClick={handlePreviousExercise}
              disabled={currentExerciseIndex === 0}
              className="w-12 h-12 p-0"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>

            {isPlaying ? (
              <Button
                size="lg"
                onClick={handlePause}
                className="flex-1 h-12"
              >
                <Pause className="h-5 w-5 mr-2" />
                Pause
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={handleResume}
                className="flex-1 h-12"
              >
                <Play className="h-5 w-5 mr-2" />
                Reprendre
              </Button>
            )}

            {/* Skip/Complete button */}
            {currentExercise?.duration ? (
              <Button
                variant="outline"
                size="lg"
                onClick={handleSkipExercise}
                className="w-12 h-12 p-0"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            ) : (
              <Button
                variant="default"
                size="lg"
                onClick={handleExerciseComplete}
                className="flex-1 h-12 bg-emerald-500 hover:bg-emerald-600"
              >
                <Check className="h-5 w-5 mr-2" />
                Terminé
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
