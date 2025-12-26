'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Target, Flame, Calendar, Activity, Heart } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageContainer, Section } from '@/components/layout/page-container'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PillTabs } from '@/components/ui/tabs'
import { ProgressBar } from '@/components/ui/progress-bar'
import { WeeklyChart } from '@/components/dashboard/weekly-chart'
import { StreakBadge, XPDisplay, AchievementBadge } from '@/components/dashboard/streak-badge'
import { BadgesGrid } from '@/components/dashboard/gamification-panel'
import { WellnessSummary } from '@/components/wellness/wellness-summary'
import { SportSummary } from '@/components/sport/sport-summary'
import { useGamificationStore } from '@/stores/gamification-store'
import { useMealsStore } from '@/stores/meals-store'
import { useUserStore } from '@/stores/user-store'
import { formatNumber, cn } from '@/lib/utils'

const viewTabs = [
  { id: 'overview', label: 'Apercu' },
  { id: 'wellness', label: 'Bien-etre' },
  { id: 'sport', label: 'Sport' },
]

const timeRanges = [
  { id: '7d', label: '7 jours' },
  { id: '30d', label: '30 jours' },
  { id: '90d', label: '90 jours' },
]

export default function ProgressPage() {
  const [selectedView, setSelectedView] = React.useState('overview')
  const [selectedRange, setSelectedRange] = React.useState('7d')
  const [mounted, setMounted] = React.useState(false)

  // Gamification store
  const {
    totalXP,
    currentLevel,
    getXPForNextLevel,
    getStreakInfo,
    checkAndUpdateStreak,
    getUnlockedBadges,
    metricsCount,
  } = useGamificationStore()

  // Meals store for statistics
  const { meals, getDailyNutrition } = useMealsStore()

  // User store for profile
  const { profile } = useUserStore()

  // Check if sport is enabled
  const isSportEnabled = profile?.sportTrackingEnabled || profile?.metabolismProfile === 'adaptive'

  React.useEffect(() => {
    setMounted(true)
    checkAndUpdateStreak()
  }, [checkAndUpdateStreak])

  // Get real data after hydration
  const streakInfo = mounted ? getStreakInfo() : { current: 0, longest: 0, isActive: false }
  const xpForNextLevel = mounted ? getXPForNextLevel() : 100
  const unlockedBadges = mounted ? getUnlockedBadges() : []

  // Calculate real statistics from metricsCount
  const totalMealsLogged = mounted ? (metricsCount['meals_logged'] || 0) : 0

  // Calculate weekly data from real meals
  const getWeeklyData = () => {
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
    const shortDays = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
    const today = new Date()
    const data = []

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      const dayIndex = date.getDay()
      const nutrition = getDailyNutrition(dateStr)

      data.push({
        day: days[dayIndex],
        shortDay: shortDays[dayIndex],
        calories: nutrition.calories,
        target: 2100, // TODO: Get from profile
        isToday: i === 0,
      })
    }

    return data
  }

  const weeklyData = mounted ? getWeeklyData() : []

  // Calculate average calories and goal hit rates
  const calculateStats = () => {
    if (!mounted || weeklyData.length === 0) {
      return { averageCalories: 0, calorieGoalHitRate: 0, proteinGoalHitRate: 0 }
    }

    const daysWithData = weeklyData.filter(d => d.calories > 0)
    const averageCalories = daysWithData.length > 0
      ? Math.round(daysWithData.reduce((sum, d) => sum + d.calories, 0) / daysWithData.length)
      : 0

    const calorieGoalHitRate = daysWithData.length > 0
      ? Math.round((daysWithData.filter(d => d.calories >= d.target * 0.9 && d.calories <= d.target * 1.1).length / daysWithData.length) * 100)
      : 0

    // Protein goal hit rate based on metricsCount
    const daysProteinGoalMet = metricsCount['protein_goal_met'] || 0
    const mealsLogged = metricsCount['meals_logged'] || 0
    const proteinGoalHitRate = daysProteinGoalMet > 0
      ? Math.round((daysProteinGoalMet / Math.max(1, mealsLogged / 4)) * 100)
      : 0

    return { averageCalories, calorieGoalHitRate, proteinGoalHitRate }
  }

  const stats = calculateStats()

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="animate-pulse text-[var(--text-tertiary)]">Chargement...</div>
      </div>
    )
  }

  return (
    <>
      <Header title="Progres" />

      <PageContainer>
        {/* View selector */}
        <Section>
          <PillTabs
            tabs={viewTabs}
            value={selectedView}
            onChange={setSelectedView}
          />
        </Section>

        {/* OVERVIEW VIEW */}
        {selectedView === 'overview' && (
          <>
            {/* Time range selector */}
            <Section>
              <div className="flex justify-center">
                <PillTabs
                  tabs={timeRanges}
                  value={selectedRange}
                  onChange={setSelectedRange}
                />
              </div>
            </Section>

            {/* Streak & XP */}
            <Section>
              <Card padding="lg">
                <div className="flex items-center justify-between mb-4">
                  <StreakBadge days={streakInfo.current} isActive={streakInfo.isActive} size="lg" />
                  <div className="text-right">
                    <p className="text-xs text-[var(--text-tertiary)]">Record</p>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {streakInfo.longest} jours
                    </p>
                  </div>
                </div>
                <XPDisplay current={totalXP} level={currentLevel} toNextLevel={xpForNextLevel} />
              </Card>
            </Section>

            {/* Weekly overview */}
            <Section>
              <WeeklyChart data={weeklyData} />
            </Section>

            {/* Stats grid */}
            <Section title="Statistiques">
              <div className="grid grid-cols-2 gap-3">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <Card padding="default">
                    <div className="flex items-center gap-2 mb-2">
                      <Flame className="h-4 w-4 text-[var(--calories)]" />
                      <span className="text-xs text-[var(--text-tertiary)]">Moy. calories</span>
                    </div>
                    <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">
                      {stats.averageCalories > 0 ? formatNumber(stats.averageCalories) : '--'}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">kcal/jour</p>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <Card padding="default">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-[var(--accent-primary)]" />
                      <span className="text-xs text-[var(--text-tertiary)]">Repas enregistres</span>
                    </div>
                    <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">
                      {totalMealsLogged}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">au total</p>
                  </Card>
                </motion.div>
              </div>
            </Section>

            {/* Goal completion */}
            <Section title="Objectifs atteints">
              <Card padding="default">
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-[var(--text-secondary)]">Objectif calories</span>
                      <span className="text-sm font-semibold text-[var(--text-primary)]">
                        {stats.calorieGoalHitRate}%
                      </span>
                    </div>
                    <ProgressBar
                      value={stats.calorieGoalHitRate}
                      max={100}
                      color="var(--calories)"
                      size="md"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-[var(--text-secondary)]">Objectif proteines</span>
                      <span className="text-sm font-semibold text-[var(--text-primary)]">
                        {stats.proteinGoalHitRate}%
                      </span>
                    </div>
                    <ProgressBar
                      value={stats.proteinGoalHitRate}
                      max={100}
                      color="var(--proteins)"
                      size="md"
                    />
                  </div>
                </div>
              </Card>
            </Section>

            {/* Badges */}
            <Section title="Badges">
              <Card padding="default">
                <BadgesGrid />
              </Card>
            </Section>

            {/* Metabolism profile info (if adaptive) */}
            {profile?.metabolismProfile === 'adaptive' && (
              <Section>
                <Card padding="default" className="border-2 border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 to-transparent">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-emerald-500/20">
                      <Heart className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-emerald-700 dark:text-emerald-400">
                        Approche bienveillante active
                      </h4>
                      <p className="text-sm text-[var(--text-secondary)] mt-1">
                        On accompagne ton metabolisme en douceur avec une approche progressive.
                        Patience et constance sont tes meilleurs allies !
                      </p>
                    </div>
                  </div>
                </Card>
              </Section>
            )}
          </>
        )}

        {/* WELLNESS VIEW */}
        {selectedView === 'wellness' && (
          <Section>
            <WellnessSummary />
          </Section>
        )}

        {/* SPORT VIEW */}
        {selectedView === 'sport' && (
          <Section>
            {isSportEnabled ? (
              <SportSummary />
            ) : (
              <Card padding="lg">
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center">
                    <Activity className="h-8 w-8 text-[var(--text-tertiary)]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                    Module Sport
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] mb-4">
                    Active le suivi d&apos;activite pour beneficier d&apos;un programme sportif personalise.
                  </p>
                  <button
                    onClick={() => {
                      // TODO: Activate sport tracking in user profile
                    }}
                    className="px-6 py-2 rounded-lg bg-[var(--accent-primary)] text-white font-medium"
                  >
                    Activer
                  </button>
                </div>
              </Card>
            )}
          </Section>
        )}
      </PageContainer>
    </>
  )
}
