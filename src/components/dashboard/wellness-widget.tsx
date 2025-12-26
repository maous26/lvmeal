'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Moon, Droplets, Brain, Activity, ChevronRight, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { ProgressBar } from '@/components/ui/progress-bar'
import { useWellnessStore } from '@/stores/wellness-store'
import { cn } from '@/lib/utils'

interface WellnessWidgetProps {
  className?: string
}

export function WellnessWidget({ className }: WellnessWidgetProps) {
  const router = useRouter()
  const {
    todayScore,
    getEntryForDate,
    targets,
  } = useWellnessStore()

  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className={cn('animate-pulse bg-[var(--bg-secondary)] h-24 rounded-xl', className)} />
    )
  }

  const today = new Date().toISOString().split('T')[0]
  const todayEntry = getEntryForDate(today)

  // Score color
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500'
    if (score >= 60) return 'text-blue-500'
    if (score >= 40) return 'text-amber-500'
    return 'text-red-500'
  }

  return (
    <Card
      padding="default"
      className={cn('cursor-pointer hover:shadow-md transition-shadow', className)}
      onClick={() => router.push('/wellness')}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
            <Sparkles className="h-4 w-4 text-indigo-500" />
          </div>
          <h3 className="text-sm font-medium text-[var(--text-primary)]">Bien-etre</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-lg font-bold', getScoreColor(todayScore))}>
            {todayScore}
          </span>
          <span className="text-sm text-[var(--text-tertiary)]">/100</span>
          <ChevronRight className="h-4 w-4 text-[var(--text-tertiary)]" />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {/* Sleep */}
        <div className="text-center">
          <Moon className="h-4 w-4 text-indigo-500 mx-auto mb-1" />
          <p className="text-xs font-semibold text-[var(--text-primary)]">
            {todayEntry?.sleepHours || '--'}h
          </p>
        </div>

        {/* Water */}
        <div className="text-center">
          <Droplets className="h-4 w-4 text-cyan-500 mx-auto mb-1" />
          <p className="text-xs font-semibold text-[var(--text-primary)]">
            {todayEntry?.waterLiters?.toFixed(1) || '--'}L
          </p>
        </div>

        {/* Stress */}
        <div className="text-center">
          <Brain className="h-4 w-4 text-rose-500 mx-auto mb-1" />
          <p className="text-xs font-semibold text-[var(--text-primary)]">
            {todayEntry?.stressLevel ? ['Zen', 'Calme', 'Ok', 'Haut', 'Max'][todayEntry.stressLevel - 1] : '--'}
          </p>
        </div>

        {/* Steps */}
        <div className="text-center">
          <Activity className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
          <p className="text-xs font-semibold text-[var(--text-primary)]">
            {todayEntry?.steps ? `${Math.round(todayEntry.steps / 1000)}k` : '--'}
          </p>
        </div>
      </div>
    </Card>
  )
}
