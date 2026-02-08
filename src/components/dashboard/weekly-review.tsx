'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, X, Award, Droplets, Moon, Flame } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useMealsStore } from '@/stores/meals-store'
import { useWellnessStore } from '@/stores/wellness-store'
import { useUserStore } from '@/stores/user-store'

function getWeekDates(weeksAgo: number = 0) {
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - now.getDay() - (weeksAgo * 7) + 1) // Monday
  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

function TrendIcon({ value }: { value: number }) {
  if (value > 0) return <TrendingUp className="h-3.5 w-3.5 text-[var(--success)]" />
  if (value < 0) return <TrendingDown className="h-3.5 w-3.5 text-[var(--error)]" />
  return <Minus className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
}

export function WeeklyReview() {
  const [dismissed, setDismissed] = React.useState(false)
  const { getDailyNutrition } = useMealsStore()
  const { entries: wellnessEntries } = useWellnessStore()
  const { profile } = useUserStore()

  // Only show on Mondays or if last week had data
  const today = new Date()
  const isMonday = today.getDay() === 1

  const thisWeekDates = getWeekDates(0)
  const lastWeekDates = getWeekDates(1)

  // Calculate averages
  const calcWeekAvg = (dates: string[]) => {
    let totalCal = 0, totalProt = 0, count = 0
    dates.forEach(d => {
      const n = getDailyNutrition(d)
      if (n.calories > 0) { totalCal += n.calories; totalProt += n.proteins; count++ }
    })
    return count > 0 ? { calories: Math.round(totalCal / count), proteins: Math.round(totalProt / count), days: count } : null
  }

  const lastWeek = calcWeekAvg(lastWeekDates)
  const prevWeek = calcWeekAvg(getWeekDates(2))

  // Calculate wellness averages for last week
  const calcWellnessAvg = (dates: string[]) => {
    let totalSleep = 0, totalStress = 0, totalWater = 0, count = 0
    dates.forEach(d => {
      const e = wellnessEntries[d]
      if (e) { totalSleep += e.sleepHours; totalStress += e.stressLevel; totalWater += e.waterLiters; count++ }
    })
    return count > 0 ? {
      sleep: Math.round(totalSleep / count * 10) / 10,
      stress: Math.round(totalStress / count * 10) / 10,
      water: Math.round(totalWater / count * 10) / 10,
    } : null
  }

  const lastWeekWellness = calcWellnessAvg(lastWeekDates)

  // Don't show if no data or dismissed
  if (dismissed || !lastWeek || lastWeek.days < 3) return null

  const calorieTrend = prevWeek ? Math.round(((lastWeek.calories - prevWeek.calories) / prevWeek.calories) * 100) : 0
  const proteinTrend = prevWeek ? Math.round(((lastWeek.proteins - prevWeek.proteins) / prevWeek.proteins) * 100) : 0
  const calorieTarget = profile?.nutritionalNeeds?.calories || profile?.dailyCaloriesTarget || 2100

  const adherence = Math.round((lastWeek.days / 7) * 100)
  const calorieAccuracy = Math.round((1 - Math.abs(lastWeek.calories - calorieTarget) / calorieTarget) * 100)

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <Card padding="default" className="relative border-2 border-[var(--accent-primary)]/20 bg-gradient-to-r from-[var(--accent-primary)]/5 to-transparent">
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-[var(--bg-secondary)]"
          aria-label="Fermer le bilan"
        >
          <X className="h-4 w-4 text-[var(--text-tertiary)]" />
        </button>

        <div className="mb-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Bilan de la semaine</h3>
          <p className="text-xs text-[var(--text-secondary)]">
            {lastWeek.days} jours enregistrés sur 7
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-[var(--calories)]" />
            <div>
              <p className="text-xs text-[var(--text-tertiary)]">Moy. calories</p>
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold text-[var(--text-primary)]">{lastWeek.calories}</span>
                {prevWeek && <TrendIcon value={calorieTrend} />}
                {prevWeek && <span className="text-xs text-[var(--text-tertiary)]">{calorieTrend > 0 ? '+' : ''}{calorieTrend}%</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-[var(--proteins)]" />
            <div>
              <p className="text-xs text-[var(--text-tertiary)]">Moy. protéines</p>
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold text-[var(--text-primary)]">{lastWeek.proteins}g</span>
                {prevWeek && <TrendIcon value={proteinTrend} />}
              </div>
            </div>
          </div>
        </div>

        {lastWeekWellness && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center p-2 rounded-lg bg-[var(--bg-secondary)]">
              <Moon className="h-3 w-3 mx-auto mb-1 text-indigo-500" />
              <p className="text-xs font-medium text-[var(--text-primary)]">{lastWeekWellness.sleep}h</p>
              <p className="text-[10px] text-[var(--text-tertiary)]">sommeil</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-[var(--bg-secondary)]">
              <Droplets className="h-3 w-3 mx-auto mb-1 text-cyan-500" />
              <p className="text-xs font-medium text-[var(--text-primary)]">{lastWeekWellness.water}L</p>
              <p className="text-[10px] text-[var(--text-tertiary)]">eau/jour</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-[var(--bg-secondary)]">
              <span className="text-xs">{lastWeekWellness.stress <= 2 ? 'zen' : lastWeekWellness.stress <= 3 ? 'ok' : 'tendu'}</span>
              <p className="text-[10px] text-[var(--text-tertiary)]">stress</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-[var(--border-light)]">
          <span className="text-xs text-[var(--text-secondary)]">
            Précision calorique : <span className="font-semibold text-[var(--text-primary)]">{calorieAccuracy}%</span>
          </span>
          <span className="text-xs text-[var(--text-secondary)]">
            Régularité : <span className="font-semibold text-[var(--text-primary)]">{adherence}%</span>
          </span>
        </div>
      </Card>
    </motion.div>
  )
}
