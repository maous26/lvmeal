'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Footprints, Dumbbell, Timer, TrendingUp, Play, CheckCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { ProgressBar } from '@/components/ui/progress-bar'
import { useSportProgramStore } from '@/stores/sport-program-store'
import { cn } from '@/lib/utils'

interface SportSummaryProps {
  className?: string
}

const phaseLabels = {
  neat_focus: 'Focus NEAT',
  walking_program: 'Programme Marche',
  resistance_intro: 'Intro Musculation',
  full_program: 'Programme Complet',
}

const phaseDescriptions = {
  neat_focus: 'Bouger plus au quotidien',
  walking_program: 'Développer l\'habitude de marcher',
  resistance_intro: 'Premiers exercices de renforcement',
  full_program: 'Programme sportif complet',
}

export function SportSummary({ className }: SportSummaryProps) {
  const {
    currentProgram,
    totalSessionsCompleted,
    currentStreak,
    longestStreak,
    getPhaseProgress,
    getTodayNeatMinutes,
    neatLogs,
  } = useSportProgramStore()

  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="animate-pulse bg-[var(--bg-secondary)] h-32 rounded-xl" />
      </div>
    )
  }

  const phaseProgress = getPhaseProgress()
  const todayNeat = getTodayNeatMinutes()

  // Get today's session if any
  const today = new Date().getDay()
  const todaySession = currentProgram?.sessions.find(
    (s) => s.dayOfWeek === today && !s.isCompleted
  )
  const completedToday = currentProgram?.sessions.filter(
    (s) => s.isCompleted && s.completedAt?.startsWith(new Date().toISOString().split('T')[0])
  ).length || 0

  // Weekly stats
  const weeklyGoals = currentProgram?.weeklyGoals
  const completedSessions = currentProgram?.sessions.filter((s) => s.isCompleted).length || 0
  const totalSessions = currentProgram?.sessions.length || 0
  const weeklyProgress = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0

  return (
    <div className={cn('space-y-4', className)}>
      {/* Phase progress */}
      <Card padding="lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-[var(--text-primary)]">
                {phaseLabels[phaseProgress.phase]}
              </h3>
              <p className="text-xs text-[var(--text-tertiary)]">
                Semaine {phaseProgress.weekInPhase}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-emerald-500">
              {Math.round(phaseProgress.progress)}%
            </span>
          </div>
        </div>

        <ProgressBar
          value={phaseProgress.progress}
          max={100}
          color="var(--success)"
          size="md"
        />

        <p className="text-xs text-[var(--text-tertiary)] mt-2">
          {phaseDescriptions[phaseProgress.phase]}
        </p>
      </Card>

      {/* Today's session */}
      {todaySession && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card padding="default" className="border-2 border-[var(--accent-primary)]/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[var(--accent-light)]">
                  <Play className="h-5 w-5 text-[var(--accent-primary)]" />
                </div>
                <div>
                  <h3 className="font-medium text-[var(--text-primary)]">
                    {todaySession.title}
                  </h3>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {todaySession.duration} min
                  </p>
                </div>
              </div>
              <button className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium">
                Commencer
              </button>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Sessions completed */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card padding="default">
            <div className="flex items-center gap-2 mb-2">
              <Dumbbell className="h-4 w-4 text-purple-500" />
              <span className="text-xs text-[var(--text-tertiary)]">Séances</span>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)]">
              {totalSessionsCompleted}
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">
              complétées
            </p>
          </Card>
        </motion.div>

        {/* Streak */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card padding="default">
            <div className="flex items-center gap-2 mb-2">
              <Timer className="h-4 w-4 text-orange-500" />
              <span className="text-xs text-[var(--text-tertiary)]">Série</span>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)]">
              {currentStreak}
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">
              jours (record: {longestStreak})
            </p>
          </Card>
        </motion.div>
      </div>

      {/* Weekly progress */}
      {currentProgram && (
        <Card padding="default">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-[var(--text-secondary)]">
              Semaine en cours
            </h3>
            <span className="text-xs text-[var(--text-tertiary)]">
              {completedSessions}/{totalSessions} séances
            </span>
          </div>

          <ProgressBar
            value={weeklyProgress}
            max={100}
            color="var(--accent-primary)"
            size="md"
          />

          {/* Session list */}
          <div className="mt-4 space-y-2">
            {currentProgram.sessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  'flex items-center gap-3 p-2 rounded-lg',
                  session.isCompleted
                    ? 'bg-emerald-500/10'
                    : 'bg-[var(--bg-secondary)]'
                )}
              >
                {session.isCompleted ? (
                  <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-[var(--border-default)] flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-sm truncate',
                      session.isCompleted
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-[var(--text-primary)]'
                    )}
                  >
                    {session.title}
                  </p>
                </div>
                <span className="text-xs text-[var(--text-tertiary)]">
                  {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][session.dayOfWeek]}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* NEAT activities */}
      <Card padding="default">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Footprints className="h-4 w-4 text-teal-500" />
            <h3 className="text-sm font-medium text-[var(--text-secondary)]">
              Activités NEAT
            </h3>
          </div>
          <span className="text-sm font-semibold text-teal-500">
            {todayNeat} min
          </span>
        </div>

        <p className="text-xs text-[var(--text-tertiary)]">
          Mouvement au quotidien (escaliers, marche, tâches ménagères...)
        </p>

        {weeklyGoals && (
          <div className="mt-3">
            <ProgressBar
              value={(todayNeat / (weeklyGoals.activeMinutes / 7)) * 100}
              max={100}
              color="var(--teal-500)"
              size="sm"
            />
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              Objectif: {Math.round(weeklyGoals.activeMinutes / 7)} min/jour
            </p>
          </div>
        )}
      </Card>

      {/* Motivational message */}
      {currentProgram?.motivationalMessage && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 rounded-xl bg-gradient-to-r from-[var(--accent-light)] to-transparent border border-[var(--accent-primary)]/20"
        >
          <p className="text-sm text-[var(--text-secondary)] italic">
            &ldquo;{currentProgram.motivationalMessage}&rdquo;
          </p>
        </motion.div>
      )}
    </div>
  )
}
