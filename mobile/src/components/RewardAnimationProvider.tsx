/**
 * RewardAnimationProvider - Wrapper global pour les animations de recompense
 *
 * Ce composant doit envelopper l'app pour que les animations soient
 * visibles sur tous les ecrans.
 */

import React, { useEffect, useRef } from 'react'
import { RewardAnimation } from './RewardAnimation'
import { useRewardStore } from '../stores/reward-store'
import {
  useGamificationStore,
  TIERS,
  ACHIEVEMENTS,
  XP_REWARDS,
} from '../stores/gamification-store'

interface RewardAnimationProviderProps {
  children: React.ReactNode
}

export function RewardAnimationProvider({ children }: RewardAnimationProviderProps) {
  const { currentReward, isAnimating, completeCurrentReward } = useRewardStore()

  // Track previous values to detect changes
  const prevXPRef = useRef<number | null>(null)
  const prevTierRef = useRef<string | null>(null)
  const prevAchievementsRef = useRef<string[]>([])
  const prevStreakRef = useRef<number>(0)

  const { totalXP, unlockedAchievements, currentStreak, getTier } = useGamificationStore()
  const {
    queueXPReward,
    queueAchievementReward,
    queueTierReward,
    queueStreakReward,
  } = useRewardStore()

  // Watch for XP changes
  useEffect(() => {
    if (prevXPRef.current === null) {
      prevXPRef.current = totalXP
      return
    }

    const xpGain = totalXP - prevXPRef.current
    if (xpGain > 0) {
      // Calculate streak bonus if applicable
      const streakBonus = currentStreak > 0 ? Math.floor(xpGain * (currentStreak * 0.05)) : 0
      queueXPReward(xpGain, undefined, streakBonus > 0 ? streakBonus : undefined)
    }

    prevXPRef.current = totalXP
  }, [totalXP])

  // Watch for tier changes
  useEffect(() => {
    const currentTier = getTier()

    if (prevTierRef.current === null) {
      prevTierRef.current = currentTier.id
      return
    }

    if (currentTier.id !== prevTierRef.current) {
      const previousTier = TIERS[prevTierRef.current as keyof typeof TIERS]
      if (previousTier) {
        queueTierReward(currentTier, previousTier)
      }
    }

    prevTierRef.current = currentTier.id
  }, [totalXP, getTier])

  // Watch for new achievements
  useEffect(() => {
    if (prevAchievementsRef.current.length === 0 && unlockedAchievements.length > 0) {
      // First load - don't show animations for already unlocked achievements
      prevAchievementsRef.current = [...unlockedAchievements]
      return
    }

    const newAchievements = unlockedAchievements.filter(
      (id) => !prevAchievementsRef.current.includes(id)
    )

    for (const achievementId of newAchievements) {
      const achievement = ACHIEVEMENTS.find((a) => a.id === achievementId)
      if (achievement) {
        queueAchievementReward(achievement)
      }
    }

    prevAchievementsRef.current = [...unlockedAchievements]
  }, [unlockedAchievements])

  // Watch for streak milestones
  useEffect(() => {
    if (prevStreakRef.current === 0) {
      prevStreakRef.current = currentStreak
      return
    }

    // Check if we just hit a milestone
    const milestones = [3, 7, 14, 30, 60, 100]
    const previousStreak = prevStreakRef.current

    for (const milestone of milestones) {
      if (currentStreak >= milestone && previousStreak < milestone) {
        // Calculate bonus XP for this milestone
        const bonusPercent = Math.min(currentStreak, 30) * 5
        queueStreakReward(milestone, bonusPercent)
        break // Only show one milestone at a time
      }
    }

    prevStreakRef.current = currentStreak
  }, [currentStreak])

  return (
    <>
      {children}
      <RewardAnimation
        reward={currentReward}
        visible={isAnimating}
        onComplete={completeCurrentReward}
      />
    </>
  )
}

export default RewardAnimationProvider
