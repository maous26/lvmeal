'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Dumbbell, ChevronRight, Play, TrendingUp, Sparkles, Clock, Trophy } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { ProgressBar } from '@/components/ui/progress-bar'
import { Badge } from '@/components/ui/badge'
import { useSportProgramStore } from '@/stores/sport-program-store'
import { useUserStore } from '@/stores/user-store'
import { cn } from '@/lib/utils'

interface SportWidgetProps {
  className?: string
}

const phaseLabels = {
  discovery: 'Découverte',
  walking_program: 'Marche',
  resistance_intro: 'Musculation',
  full_program: 'Complet',
}

export function SportWidget({ className }: SportWidgetProps) {
  const router = useRouter()
  const { profile } = useUserStore()
  const {
    currentProgram,
    currentStreak,
    totalSessionsCompleted,
    getPhaseProgress,
  } = useSportProgramStore()

  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Check if sport is enabled
  const isSportEnabled = profile?.sportTrackingEnabled || profile?.metabolismProfile === 'adaptive'

  if (!mounted) {
    return (
      <div className={cn('animate-pulse bg-[var(--bg-secondary)] h-24 rounded-xl', className)} />
    )
  }

  // If sport not enabled, show activation prompt with LymIA branding
  if (!isSportEnabled) {
    return (
      <Card
        padding="default"
        className={cn('cursor-pointer hover:shadow-md transition-shadow', className)}
        onClick={() => router.push('/sport')}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20">
              <Sparkles className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-[var(--text-primary)]">Programme Sport LymIA</h3>
              <p className="text-xs text-[var(--text-tertiary)]">Activer pour un coaching personnalisé</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-[var(--text-tertiary)]" />
        </div>
      </Card>
    )
  }

  const phaseProgress = getPhaseProgress()

  // Get today's session if any
  const today = new Date().getDay()
  const todaySession = currentProgram?.sessions.find(
    (s) => s.dayOfWeek === today && !s.isCompleted
  )

  // Weekly stats
  const completedSessions = currentProgram?.sessions.filter((s) => s.isCompleted).length || 0
  const totalSessions = currentProgram?.sessions.length || 0
  const weeklyProgress = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0

  return (
    <Card
      padding="default"
      className={cn('cursor-pointer hover:shadow-md transition-shadow', className)}
      onClick={() => router.push('/sport')}
    >
      {/* Header with LymIA branding */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20">
            <Sparkles className="h-4 w-4 text-violet-500" />
          </div>
          <h3 className="text-sm font-medium text-[var(--text-primary)]">Sport LymIA</h3>
          <Badge variant="outline" size="sm" className="text-[10px] border-violet-500/30 text-violet-600">
            {phaseLabels[phaseProgress.phase]}
          </Badge>
        </div>
        <ChevronRight className="h-4 w-4 text-[var(--text-tertiary)]" />
      </div>

      {/* Today's session or weekly progress */}
      {todaySession ? (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Play className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">{todaySession.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {todaySession.duration} min
                </span>
                <span className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1">
                  <Dumbbell className="h-3 w-3" />
                  {todaySession.exercises.length} exo
                </span>
              </div>
            </div>
          </div>
          <span className="text-xs font-medium text-violet-500 bg-violet-500/10 px-2 py-1 rounded-full">
            À faire
          </span>
        </motion.div>
      ) : currentProgram ? (
        // Weekly progress
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-tertiary)]">Semaine en cours</span>
            <span className="text-[var(--text-secondary)] font-medium">
              {completedSessions}/{totalSessions} séances
            </span>
          </div>
          <ProgressBar
            value={weeklyProgress}
            max={100}
            color="var(--accent-primary)"
            size="sm"
          />
        </div>
      ) : (
        // No program yet
        <div className="flex items-center justify-center p-3 rounded-xl bg-[var(--bg-secondary)]">
          <p className="text-xs text-[var(--text-tertiary)]">
            Clique pour générer ton programme
          </p>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-[var(--border-light)]">
        {/* Streak */}
        <div className="text-center">
          <span className="text-base">🔥</span>
          <p className="text-xs font-semibold text-[var(--text-primary)]">
            {currentStreak}j
          </p>
          <p className="text-[10px] text-[var(--text-tertiary)]">Série</p>
        </div>

        {/* Sessions */}
        <div className="text-center">
          <Trophy className="h-4 w-4 text-amber-500 mx-auto" />
          <p className="text-xs font-semibold text-[var(--text-primary)]">
            {totalSessionsCompleted}
          </p>
          <p className="text-[10px] text-[var(--text-tertiary)]">Séances</p>
        </div>

        {/* Phase progress */}
        <div className="text-center">
          <TrendingUp className="h-4 w-4 text-emerald-500 mx-auto" />
          <p className="text-xs font-semibold text-[var(--text-primary)]">
            {Math.round(phaseProgress.progress)}%
          </p>
          <p className="text-[10px] text-[var(--text-tertiary)]">Phase</p>
        </div>
      </div>
    </Card>
  )
}
