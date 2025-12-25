'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Target, Flame, Calendar } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageContainer, Section } from '@/components/layout/page-container'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PillTabs } from '@/components/ui/tabs'
import { ProgressBar } from '@/components/ui/progress-bar'
import { WeeklyChart } from '@/components/dashboard/weekly-chart'
import { StreakBadge, XPDisplay, AchievementBadge } from '@/components/dashboard/streak-badge'
import { formatNumber } from '@/lib/utils'

const timeRanges = [
  { id: '7d', label: '7 jours' },
  { id: '30d', label: '30 jours' },
  { id: '90d', label: '90 jours' },
]

const mockStats = {
  currentStreak: 7,
  longestStreak: 21,
  totalMealsLogged: 156,
  averageCalories: 1950,
  calorieGoalHitRate: 78,
  proteinGoalHitRate: 85,
}

const mockWeeklyData = [
  { day: 'Lundi', shortDay: 'L', calories: 2050, target: 2100, isToday: false },
  { day: 'Mardi', shortDay: 'M', calories: 2180, target: 2100, isToday: false },
  { day: 'Mercredi', shortDay: 'M', calories: 1950, target: 2100, isToday: false },
  { day: 'Jeudi', shortDay: 'J', calories: 2100, target: 2100, isToday: false },
  { day: 'Vendredi', shortDay: 'V', calories: 2250, target: 2100, isToday: false },
  { day: 'Samedi', shortDay: 'S', calories: 1800, target: 2100, isToday: false },
  { day: 'Dimanche', shortDay: 'D', calories: 1450, target: 2100, isToday: true },
]

const mockBadges = [
  { id: '1', name: 'Première semaine', earned: true },
  { id: '2', name: '7 jours streak', earned: true },
  { id: '3', name: 'Objectif atteint', earned: true },
  { id: '4', name: '30 jours streak', earned: false },
  { id: '5', name: 'Chef cuisinier', earned: false },
  { id: '6', name: 'Explorateur', earned: false },
]

export default function ProgressPage() {
  const [selectedRange, setSelectedRange] = React.useState('7d')

  return (
    <>
      <Header title="Progrès" />

      <PageContainer>
        {/* Time range selector */}
        <Section>
          <PillTabs
            tabs={timeRanges}
            value={selectedRange}
            onChange={setSelectedRange}
          />
        </Section>

        {/* Streak & XP */}
        <Section>
          <Card padding="lg">
            <div className="flex items-center justify-between mb-4">
              <StreakBadge days={mockStats.currentStreak} size="lg" />
              <div className="text-right">
                <p className="text-xs text-[var(--text-tertiary)]">Record</p>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {mockStats.longestStreak} jours
                </p>
              </div>
            </div>
            <XPDisplay current={1250} level={5} toNextLevel={750} />
          </Card>
        </Section>

        {/* Weekly overview */}
        <Section>
          <WeeklyChart data={mockWeeklyData} />
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
                  {formatNumber(mockStats.averageCalories)}
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
                  <span className="text-xs text-[var(--text-tertiary)]">Repas enregistrés</span>
                </div>
                <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">
                  {mockStats.totalMealsLogged}
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
                    {mockStats.calorieGoalHitRate}%
                  </span>
                </div>
                <ProgressBar
                  value={mockStats.calorieGoalHitRate}
                  max={100}
                  color="var(--calories)"
                  size="md"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-[var(--text-secondary)]">Objectif protéines</span>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {mockStats.proteinGoalHitRate}%
                  </span>
                </div>
                <ProgressBar
                  value={mockStats.proteinGoalHitRate}
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
          <div className="grid grid-cols-3 gap-3">
            {mockBadges.map((badge) => (
              <AchievementBadge
                key={badge.id}
                name={badge.name}
                earned={badge.earned}
              />
            ))}
          </div>
        </Section>
      </PageContainer>
    </>
  )
}
