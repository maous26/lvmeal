'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Moon, Droplets, Brain, Activity, Sparkles, Zap, ChevronDown, ChevronUp, Dumbbell } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { ProgressBar } from '@/components/ui/progress-bar'
import { DailyCheckin } from './daily-checkin'
import { useWellnessStore } from '@/stores/wellness-store'
import { useUserStore } from '@/stores/user-store'
import { useSportProgramStore } from '@/stores/sport-program-store'
import { cn } from '@/lib/utils'

interface WellnessSummaryProps {
  className?: string
}

export function WellnessSummary({ className }: WellnessSummaryProps) {
  const {
    todayScore,
    weeklyAverageScore,
    streaks,
    getInsights,
    getEntryForDate,
    targets,
    entries,
  } = useWellnessStore()

  const { profile } = useUserStore()
  const { totalSessionsCompleted, currentStreak, getPhaseProgress } = useSportProgramStore()

  const [mounted, setMounted] = React.useState(false)
  const [showHistory, setShowHistory] = React.useState(false)

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

  const today = new Date().toISOString().split('T')[0]
  const todayEntry = getEntryForDate(today)
  const insights = getInsights()
  const isAdaptive = profile?.metabolismProfile === 'adaptive'

  // Check if check-in is needed
  const needsCheckin = !todayEntry || todayEntry.sleepHours === 0

  // Get last 7 days data
  const getLast7Days = () => {
    const days = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      const entry = entries[dateStr]
      days.push({
        date: dateStr,
        dayName: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][date.getDay()],
        entry,
        score: entry ? todayScore : 0, // Simplified - would calculate per day
      })
    }
    return days
  }

  const weekData = getLast7Days()

  // Score interpretation
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500'
    if (score >= 60) return 'text-blue-500'
    if (score >= 40) return 'text-amber-500'
    return 'text-red-500'
  }

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent'
    if (score >= 60) return 'Bon'
    if (score >= 40) return 'Peut mieux faire'
    return 'Attention'
  }

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'from-emerald-500/20 to-emerald-500/5'
    if (score >= 60) return 'from-blue-500/20 to-blue-500/5'
    if (score >= 40) return 'from-amber-500/20 to-amber-500/5'
    return 'from-red-500/20 to-red-500/5'
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Daily Check-in if needed */}
      {needsCheckin && (
        <DailyCheckin />
      )}

      {/* Score global */}
      <Card padding="lg" className={cn('bg-gradient-to-br', getScoreBg(todayScore))}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
              <Sparkles className="h-5 w-5 text-indigo-500" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-[var(--text-primary)]">
                Score Bien-etre
              </h3>
              <p className="text-xs text-[var(--text-tertiary)]">
                Aujourd&apos;hui
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className={cn('text-3xl font-bold', getScoreColor(todayScore))}>
              {todayScore}
            </span>
            <span className="text-lg text-[var(--text-tertiary)]">/100</span>
          </div>
        </div>

        <div className="space-y-2">
          <ProgressBar
            value={todayScore}
            max={100}
            color={todayScore >= 60 ? 'var(--success)' : 'var(--warning)'}
            size="lg"
          />
          <div className="flex justify-between text-xs text-[var(--text-tertiary)]">
            <span>{getScoreLabel(todayScore)}</span>
            <span>Moyenne 7j: {weeklyAverageScore}/100</span>
          </div>
        </div>

        {/* Adaptive profile message */}
        {isAdaptive && (
          <div className="mt-4 pt-4 border-t border-[var(--border-light)]">
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              💚 Rappel: Le bien-etre global (sommeil, stress) est prioritaire pour ton metabolisme
            </p>
          </div>
        )}
      </Card>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Sleep */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card padding="default">
            <div className="flex items-center gap-2 mb-2">
              <Moon className="h-4 w-4 text-indigo-500" />
              <span className="text-xs text-[var(--text-tertiary)]">Sommeil</span>
            </div>
            <p className="text-xl font-bold text-[var(--text-primary)]">
              {todayEntry?.sleepHours || '--'}h
            </p>
            <div className="flex items-center gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={cn(
                    'text-xs',
                    star <= (todayEntry?.sleepQuality || 0)
                      ? 'text-amber-400'
                      : 'text-[var(--bg-tertiary)]'
                  )}
                >
                  ★
                </span>
              ))}
            </div>
            {streaks.sleep7h > 0 && (
              <p className="text-xs text-emerald-500 mt-1">
                🔥 {streaks.sleep7h}j de suite
              </p>
            )}
          </Card>
        </motion.div>

        {/* Water */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card padding="default">
            <div className="flex items-center gap-2 mb-2">
              <Droplets className="h-4 w-4 text-cyan-500" />
              <span className="text-xs text-[var(--text-tertiary)]">Hydratation</span>
            </div>
            <p className="text-xl font-bold text-[var(--text-primary)]">
              {todayEntry?.waterLiters?.toFixed(1) || '--'}L
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">
              / {targets.waterLiters}L objectif
            </p>
            {streaks.water2L > 0 && (
              <p className="text-xs text-emerald-500 mt-1">
                🔥 {streaks.water2L}j de suite
              </p>
            )}
          </Card>
        </motion.div>

        {/* Stress */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card padding="default">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4 text-rose-500" />
              <span className="text-xs text-[var(--text-tertiary)]">Stress</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">
                {['🧘', '😊', '😐', '😰', '🤯'][
                  (todayEntry?.stressLevel || 3) - 1
                ]}
              </span>
              <span className="text-sm text-[var(--text-secondary)]">
                {['Zen', 'Calme', 'Moyen', 'Stresse', 'Intense'][
                  (todayEntry?.stressLevel || 3) - 1
                ]}
              </span>
            </div>
            {streaks.lowStress > 0 && (
              <p className="text-xs text-emerald-500 mt-1">
                🧘 {streaks.lowStress}j zen
              </p>
            )}
          </Card>
        </motion.div>

        {/* Energy */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card padding="default">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-[var(--text-tertiary)]">Energie</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">
                {['🔋', '😴', '😐', '💪', '⚡'][
                  (todayEntry?.energyLevel || 3) - 1
                ]}
              </span>
              <span className="text-sm text-[var(--text-secondary)]">
                {['Epuise', 'Fatigue', 'Normal', 'En forme', 'Top'][
                  (todayEntry?.energyLevel || 3) - 1
                ]}
              </span>
            </div>
          </Card>
        </motion.div>

        {/* Steps */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card padding="default">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-[var(--text-tertiary)]">Pas</span>
            </div>
            <p className="text-xl font-bold text-[var(--text-primary)]">
              {todayEntry?.steps?.toLocaleString() || '--'}
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">
              / {targets.dailySteps.toLocaleString()} objectif
            </p>
            {streaks.steps > 0 && (
              <p className="text-xs text-emerald-500 mt-1">
                🔥 {streaks.steps}j de suite
              </p>
            )}
          </Card>
        </motion.div>

        {/* Sport LymIA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Card padding="default">
            <div className="flex items-center gap-2 mb-2">
              <Dumbbell className="h-4 w-4 text-violet-500" />
              <span className="text-xs text-[var(--text-tertiary)]">Sport LymIA</span>
            </div>
            <p className="text-xl font-bold text-[var(--text-primary)]">
              {totalSessionsCompleted}
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">
              séances complétées
            </p>
            {currentStreak > 0 && (
              <p className="text-xs text-emerald-500 mt-1">
                🔥 {currentStreak}j de suite
              </p>
            )}
          </Card>
        </motion.div>
      </div>

      {/* Weekly History */}
      <Card padding="default">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between"
        >
          <h3 className="text-sm font-medium text-[var(--text-secondary)]">
            Historique 7 jours
          </h3>
          {showHistory ? (
            <ChevronUp className="h-4 w-4 text-[var(--text-tertiary)]" />
          ) : (
            <ChevronDown className="h-4 w-4 text-[var(--text-tertiary)]" />
          )}
        </button>

        {showHistory && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-3 pt-3 border-t border-[var(--border-light)]"
          >
            <div className="grid grid-cols-7 gap-1">
              {weekData.map((day, i) => (
                <div key={day.date} className="text-center">
                  <p className="text-xs text-[var(--text-tertiary)] mb-1">
                    {day.dayName}
                  </p>
                  <div
                    className={cn(
                      'w-8 h-8 mx-auto rounded-full flex items-center justify-center text-xs font-medium',
                      day.entry
                        ? day.entry.sleepHours >= 7
                          ? 'bg-emerald-500/20 text-emerald-600'
                          : 'bg-amber-500/20 text-amber-600'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
                    )}
                  >
                    {day.entry ? (day.entry.sleepHours >= 7 ? '✓' : '−') : '·'}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </Card>

      {/* Insights */}
      {insights.length > 0 && (
        <Card padding="default">
          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
            Conseils personnalises
          </h3>
          <div className="space-y-2">
            {insights.slice(0, 3).map((insight, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * index }}
                className={cn(
                  'p-3 rounded-lg text-sm',
                  insight.type === 'positive'
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : insight.type === 'warning'
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                    : 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
                )}
              >
                <p>{insight.message}</p>
                {insight.actionable && (
                  <p className="text-xs mt-1 opacity-80">💡 {insight.actionable}</p>
                )}
              </motion.div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
