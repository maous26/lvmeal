'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Trophy, Flame, Star, Target } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageContainer, Section } from '@/components/layout/page-container'
import {
  LevelProgress,
  StreakCard,
  BadgesGrid,
  DailyChallenges,
} from '@/components/dashboard'
import { useGamificationStore } from '@/stores/gamification-store'

export default function AchievementsPage() {
  const router = useRouter()
  const [mounted, setMounted] = React.useState(false)

  const {
    totalXP,
    currentLevel,
    getLevelTitle,
    getUnlockedBadges,
    earnedBadges,
    checkAndUpdateStreak,
  } = useGamificationStore()

  React.useEffect(() => {
    setMounted(true)
    checkAndUpdateStreak()
  }, [checkAndUpdateStreak])

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="animate-pulse text-[var(--text-tertiary)]">Chargement...</div>
      </div>
    )
  }

  const unlockedBadges = getUnlockedBadges()

  return (
    <>
      <Header
        title="Mes Succès"
        showBack
        onBack={() => router.back()}
      />

      <PageContainer className="pt-4">
        {/* Stats Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-3 gap-3 mb-6"
        >
          <div className="flex flex-col items-center p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-200 dark:border-purple-800">
            <Trophy className="h-6 w-6 text-purple-500 mb-2" />
            <span className="text-2xl font-bold text-[var(--text-primary)]">
              {earnedBadges.length}
            </span>
            <span className="text-xs text-[var(--text-tertiary)]">Badges</span>
          </div>
          <div className="flex flex-col items-center p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-200 dark:border-blue-800">
            <Star className="h-6 w-6 text-blue-500 mb-2" />
            <span className="text-2xl font-bold text-[var(--text-primary)]">
              {currentLevel}
            </span>
            <span className="text-xs text-[var(--text-tertiary)]">Niveau</span>
          </div>
          <div className="flex flex-col items-center p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-200 dark:border-amber-800">
            <Target className="h-6 w-6 text-amber-500 mb-2" />
            <span className="text-2xl font-bold text-[var(--text-primary)]">
              {totalXP.toLocaleString()}
            </span>
            <span className="text-xs text-[var(--text-tertiary)]">XP</span>
          </div>
        </motion.div>

        {/* Level Progress Card */}
        <Section>
          <LevelProgress />
        </Section>

        {/* Streak Card */}
        <Section>
          <StreakCard />
        </Section>

        {/* Daily Challenges */}
        <Section>
          <DailyChallenges />
        </Section>

        {/* All Badges */}
        <Section>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-[var(--bg-secondary)] rounded-2xl p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="h-5 w-5 text-[var(--accent-primary)]" />
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                Tous les badges
              </h3>
              <span className="ml-auto text-sm text-[var(--text-tertiary)]">
                {unlockedBadges.length} débloqués
              </span>
            </div>

            <BadgesGrid />
          </motion.div>
        </Section>

        {/* Spacer */}
        <div className="h-8" />
      </PageContainer>
    </>
  )
}
