/**
 * Reward Store - Gestion de la queue d'animations de recompenses
 *
 * Ce store gere l'affichage sequentiel des animations de:
 * - Gain d'XP
 * - Deblocage de badges/achievements
 * - Montee de tier
 * - Streaks
 */

import { create } from 'zustand'
import { Reward, XPReward, AchievementReward, TierReward, StreakReward } from '../components/RewardAnimation'
import { Achievement, TierInfo } from './gamification-store'

interface RewardState {
  // Queue de recompenses a afficher
  rewardQueue: Reward[]

  // Recompense actuellement affichee
  currentReward: Reward | null

  // Animation en cours
  isAnimating: boolean

  // Actions
  queueXPReward: (amount: number, reason?: string, bonusXP?: number) => void
  queueAchievementReward: (achievement: Achievement) => void
  queueTierReward: (newTier: TierInfo, previousTier: TierInfo) => void
  queueStreakReward: (days: number, bonusXP: number) => void

  // Gestion de la queue
  processNextReward: () => void
  completeCurrentReward: () => void
  clearQueue: () => void

  // Pour l'integration avec l'UI
  getCurrentReward: () => Reward | null
  hasRewards: () => boolean
}

export const useRewardStore = create<RewardState>((set, get) => ({
  rewardQueue: [],
  currentReward: null,
  isAnimating: false,

  queueXPReward: (amount, reason, bonusXP) => {
    // Seuil minimum pour afficher l'animation (eviter le spam)
    if (amount < 5) return

    const reward: XPReward = {
      type: 'xp',
      amount,
      reason,
      bonusXP,
    }

    set((state) => ({
      rewardQueue: [...state.rewardQueue, reward],
    }))

    // Demarrer le traitement si pas d'animation en cours
    if (!get().isAnimating) {
      get().processNextReward()
    }
  },

  queueAchievementReward: (achievement) => {
    const reward: AchievementReward = {
      type: 'achievement',
      achievement,
    }

    set((state) => ({
      // Les achievements passent en priorite
      rewardQueue: [reward, ...state.rewardQueue],
    }))

    if (!get().isAnimating) {
      get().processNextReward()
    }
  },

  queueTierReward: (newTier, previousTier) => {
    const reward: TierReward = {
      type: 'tier',
      newTier,
      previousTier,
    }

    set((state) => ({
      // Les tier ups passent en priorite absolue
      rewardQueue: [reward, ...state.rewardQueue],
    }))

    if (!get().isAnimating) {
      get().processNextReward()
    }
  },

  queueStreakReward: (days, bonusXP) => {
    // Seulement pour les milestones de streak
    if (![3, 7, 14, 30, 60, 100].includes(days)) return

    const reward: StreakReward = {
      type: 'streak',
      days,
      bonusXP,
    }

    set((state) => ({
      rewardQueue: [...state.rewardQueue, reward],
    }))

    if (!get().isAnimating) {
      get().processNextReward()
    }
  },

  processNextReward: () => {
    const { rewardQueue } = get()

    if (rewardQueue.length === 0) {
      set({ isAnimating: false, currentReward: null })
      return
    }

    const [nextReward, ...remainingQueue] = rewardQueue

    set({
      currentReward: nextReward,
      rewardQueue: remainingQueue,
      isAnimating: true,
    })
  },

  completeCurrentReward: () => {
    set({ currentReward: null, isAnimating: false })

    // Petit delai avant la prochaine animation
    setTimeout(() => {
      get().processNextReward()
    }, 300)
  },

  clearQueue: () => {
    set({
      rewardQueue: [],
      currentReward: null,
      isAnimating: false,
    })
  },

  getCurrentReward: () => get().currentReward,

  hasRewards: () => get().rewardQueue.length > 0 || get().currentReward !== null,
}))

// Hook helper pour utiliser les animations
export function useRewardAnimations() {
  const { queueXPReward, queueAchievementReward, queueTierReward, queueStreakReward } = useRewardStore()

  return {
    showXPGain: queueXPReward,
    showAchievement: queueAchievementReward,
    showTierUp: queueTierReward,
    showStreakMilestone: queueStreakReward,
  }
}
