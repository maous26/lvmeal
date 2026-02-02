import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Helper to get today's date string
function getTodayString(): string {
  return new Date().toISOString().split('T')[0]
}

// Helper to get current week key (YYYY-WW)
function getWeekKey(date: Date = new Date()): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const weekNumber = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`
}

// Helper to get current month key (YYYY-MM)
function getMonthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`
}

// =============================================================================
// SIMPLIFIED XP SYSTEM
// =============================================================================

export const XP_REWARDS = {
  // Daily actions - simple and consistent
  LOG_MEAL: 10,
  LOG_BREAKFAST: 15,
  LOG_ALL_MEALS: 30,        // Bonus for logging all 4 meals
  REACH_CALORIE_TARGET: 25, // Within 10% of target
  REACH_PROTEIN_TARGET: 15,
  COMPLETE_HYDRATION: 10,
  LOG_HYDRATION: 5,
  REACH_HYDRATION_TARGET: 10,

  // Weekly actions
  FOLLOW_PLAN_DAY: 20,
  COMPLETE_WEEKLY_PLAN: 100,
  SAVE_SHOPPING_LIST: 15,

  // Streaks - big rewards for consistency
  DAILY_STREAK_BONUS: 5,    // +5 XP per streak day (so 7 days = +35 XP per action)
  STREAK_3_DAYS: 50,
  STREAK_7_DAYS: 150,
  STREAK_14_DAYS: 300,
  STREAK_30_DAYS: 750,
  STREAK_60_DAYS: 1500,
  STREAK_100_DAYS: 3000,

  // Special
  FIRST_MEAL_LOGGED: 50,
  FIRST_RECIPE_SAVED: 20,
  FIRST_WEEKLY_PLAN: 100,
  ADD_RECIPE_TO_FAVORITES: 10,
  SPORT_SESSION: 30,
  WEIGHT_LOGGED: 10,
  WEIGHT_MILESTONE: 200,

  // Wellness
  LOG_SLEEP: 10,
  GOOD_SLEEP_7H: 20,
  LOG_WELLNESS_CHECKIN: 15,
  LOW_STRESS_DAY: 15,
  HIGH_ENERGY_DAY: 10,
  REACH_STEPS_TARGET: 25,
  REACH_FIBER_TARGET: 15,
  WELLNESS_SCORE_80: 30,

  // Sport
  COMPLETE_SESSION: 30,
  COMPLETE_PHASE: 150,
  SPORT_STREAK_DAY: 15,
  GIVE_SESSION_FEEDBACK: 10,
  CONNECT_WEARABLE: 50,
  SYNC_WEARABLE: 5,
  WEEKLY_PROGRAM_COMPLETED: 100,

  // Méditation TTS
  MEDITATION_SESSION_COMPLETED: 40,
  MEDITATION_FIRST_SESSION: 50,
  MEDITATION_PROGRAM_COMPLETED: 200,

  // Social - Partage de recettes
  SHARE_RECIPE: 20,
  FIRST_RECIPE_SHARED: 50,
  SHARE_5_RECIPES: 100,
  SHARE_10_RECIPES: 250,
} as const

// =============================================================================
// TIER SYSTEM - Simple progression
// =============================================================================

export type UserTier = 'bronze' | 'silver' | 'gold' | 'diamond'

export interface TierInfo {
  id: UserTier
  name: string
  nameFr: string
  icon: string
  color: string
  minXP: number
  aiCredits: number      // Monthly AI credits
  features: string[]     // Features unlocked
}

// AI credits are NOT tied to gamification tiers - they come from subscription
// Free users get 3 credits/month after trial, Premium users get unlimited
export const FREE_MONTHLY_AI_CREDITS = 3  // Frustratingly low to push to premium

export const TIERS: Record<UserTier, TierInfo> = {
  bronze: {
    id: 'bronze',
    name: 'Bronze',
    nameFr: 'Bronze',
    icon: '🥉',
    color: '#CD7F32',
    minXP: 0,
    aiCredits: 0,  // Not used - see FREE_MONTHLY_AI_CREDITS
    features: ['Suivi repas', 'Objectifs nutrition', 'Statistiques de base'],
  },
  silver: {
    id: 'silver',
    name: 'Silver',
    nameFr: 'Argent',
    icon: '🥈',
    color: '#C0C0C0',
    minXP: 500,
    aiCredits: 0,  // Not used
    features: ['Recettes personnalisees', 'Historique complet', 'Export donnees'],
  },
  gold: {
    id: 'gold',
    name: 'Gold',
    nameFr: 'Or',
    icon: '🥇',
    color: '#FFD700',
    minXP: 2000,
    aiCredits: 0,  // Not used
    features: ['Badge exclusif', 'Acces prioritaire nouvelles features', 'Communaute VIP'],
  },
  diamond: {
    id: 'diamond',
    name: 'Diamond',
    nameFr: 'Diamant',
    icon: '💎',
    color: '#B9F2FF',
    minXP: 10000,
    aiCredits: 0,  // Not used - even Diamond needs Premium for unlimited AI
    features: ['Badge legendaire', '1 mois Premium offert', 'Acces beta features'],
  },
}

// =============================================================================
// ACHIEVEMENTS - Simple milestones (reduced from 44 to 12)
// =============================================================================

export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  xpReward: number
  condition: { type: 'streak' | 'count' | 'tier'; target: number; metric?: string }
}

export const ACHIEVEMENTS: Achievement[] = [
  // Streaks (4)
  { id: 'streak_7', name: 'Semaine parfaite', description: '7 jours consecutifs', icon: '🔥', xpReward: 100, condition: { type: 'streak', target: 7 } },
  { id: 'streak_30', name: 'Mois engagé', description: '30 jours consécutifs', icon: '⚡', xpReward: 500, condition: { type: 'streak', target: 30 } },
  { id: 'streak_100', name: 'Centenaire', description: '100 jours consécutifs', icon: '🏆', xpReward: 2000, condition: { type: 'streak', target: 100 } },

  // Meals (3)
  { id: 'meals_10', name: 'Régulier', description: '10 repas enregistrés', icon: '🍽️', xpReward: 50, condition: { type: 'count', target: 10, metric: 'meals_logged' } },
  { id: 'meals_100', name: 'Gourmet', description: '100 repas enregistrés', icon: '👨‍🍳', xpReward: 300, condition: { type: 'count', target: 100, metric: 'meals_logged' } },
  { id: 'meals_500', name: 'Chef', description: '500 repas enregistrés', icon: '⭐', xpReward: 1000, condition: { type: 'count', target: 500, metric: 'meals_logged' } },

  // Goals (3)
  { id: 'goals_7', name: 'Sur la bonne voie', description: '7 objectifs atteints', icon: '🎯', xpReward: 100, condition: { type: 'count', target: 7, metric: 'goals_reached' } },
  { id: 'goals_30', name: 'Discipline', description: '30 objectifs atteints', icon: '💪', xpReward: 400, condition: { type: 'count', target: 30, metric: 'goals_reached' } },
  { id: 'goals_100', name: 'Excellence', description: '100 objectifs atteints', icon: '🌟', xpReward: 1500, condition: { type: 'count', target: 100, metric: 'goals_reached' } },

  // Tiers (3)
  { id: 'tier_silver', name: 'Argent', description: 'Atteindre le tier Argent', icon: '🥈', xpReward: 0, condition: { type: 'tier', target: 500 } },
  { id: 'tier_gold', name: 'Or', description: 'Atteindre le tier Or', icon: '🥇', xpReward: 0, condition: { type: 'tier', target: 2000 } },
  { id: 'tier_diamond', name: 'Diamant', description: 'Atteindre le tier Diamant', icon: '💎', xpReward: 0, condition: { type: 'tier', target: 5000 } },

  // Méditation (3)
  { id: 'meditation_first', name: 'Première méditation', description: 'Compléter ta première méditation guidée', icon: '🧘', xpReward: 50, condition: { type: 'count', target: 1, metric: 'meditation_sessions' } },
  { id: 'meditation_4', name: 'Mi-parcours', description: '4 méditations guidées complétées', icon: '🌙', xpReward: 100, condition: { type: 'count', target: 4, metric: 'meditation_sessions' } },
  { id: 'meditation_8', name: 'Maître Zen', description: 'Programme de 8 méditations complété', icon: '🪷', xpReward: 300, condition: { type: 'count', target: 8, metric: 'meditation_sessions' } },

  // Social - Partage de recettes (3)
  { id: 'share_first', name: 'Partage Culinaire', description: 'Partage ta première recette', icon: '📤', xpReward: 50, condition: { type: 'count', target: 1, metric: 'recipes_shared' } },
  { id: 'share_5', name: 'Influenceur', description: '5 recettes partagées', icon: '📱', xpReward: 100, condition: { type: 'count', target: 5, metric: 'recipes_shared' } },
  { id: 'share_10', name: 'Ambassadeur LYM', description: '10 recettes partagées', icon: '🌟', xpReward: 250, condition: { type: 'count', target: 10, metric: 'recipes_shared' } },

  // Défis Hebdomadaires (4) - Intégration avec weekly-challenges-service
  { id: 'challenge_first', name: 'Premier Défi', description: 'Complète ton premier défi hebdomadaire', icon: '🎯', xpReward: 75, condition: { type: 'count', target: 1, metric: 'challenges_completed' } },
  { id: 'challenge_5', name: 'Challenger', description: '5 défis hebdomadaires complétés', icon: '🏅', xpReward: 200, condition: { type: 'count', target: 5, metric: 'challenges_completed' } },
  { id: 'challenge_10', name: 'Champion des Défis', description: '10 défis hebdomadaires complétés', icon: '🏆', xpReward: 500, condition: { type: 'count', target: 10, metric: 'challenges_completed' } },
  { id: 'challenge_25', name: 'Maître des Défis', description: '25 défis hebdomadaires complétés', icon: '👑', xpReward: 1000, condition: { type: 'count', target: 25, metric: 'challenges_completed' } },
]

// =============================================================================
// WEEKLY RANKING
// =============================================================================

export interface WeeklyRankEntry {
  rank: number
  xpThisWeek: number
  percentile: number // Top X%
}

// Simulated ranking thresholds (would be server-side in production)
const RANKING_THRESHOLDS = {
  top1: 1000,   // Top 1% - Diamond rewards
  top5: 500,    // Top 5% - Gold rewards
  top10: 300,   // Top 10% - Silver rewards
  top25: 150,   // Top 25%
  top50: 75,    // Top 50%
}

// =============================================================================
// STATE INTERFACE
// =============================================================================

// Trial duration in days
export const TRIAL_DURATION_DAYS = 7
// Trial credits: enough to taste AI features, not enough to stay free
export const TRIAL_AI_CREDITS = 15  // ~2/jour, pousse vers abonnement

interface GamificationState {
  // Hydration state
  _hasHydrated: boolean

  // Core stats
  totalXP: number
  currentStreak: number
  longestStreak: number
  lastActiveDate: string | null
  currentLevel: number // Legacy compatibility

  // Weekly tracking
  weeklyXP: number
  currentWeek: string

  // Monthly AI credits
  aiCreditsUsed: number
  currentMonth: string

  // Trial period tracking
  trialStartDate: string | null  // Date when user started (ISO string)

  // Premium subscription (source of AI credits, not gamification)
  isPremium: boolean  // True if user has active Premium subscription

  // Metrics
  metricsCount: Record<string, number>

  // Achievements
  unlockedAchievements: string[]

  // Actions
  addXP: (amount: number, reason?: string) => void
  checkAndUpdateStreak: () => void
  incrementMetric: (metric: string, amount?: number) => void
  setMetric: (metric: string, value: number) => void
  useAICredit: () => boolean
  checkAchievements: () => void
  startTrial: () => void  // Initialize trial period
  setTrialStartDate: (date: string) => void  // Set trial start date from cloud (for anti-abuse)
  setPremium: (isPremium: boolean) => void  // Set premium status (from payment system)

  // Getters
  getTier: () => TierInfo
  getNextTier: () => TierInfo | null
  getTierProgress: () => { current: number; needed: number; percentage: number }
  getWeeklyRank: () => WeeklyRankEntry
  getAICreditsRemaining: () => number
  isInTrialPeriod: () => boolean  // Check if user is in trial
  getTrialDaysRemaining: () => number  // Days left in trial
  getStreakInfo: () => { current: number; longest: number; isActive: boolean; bonus: number }
  getAchievements: () => { achievement: Achievement; unlocked: boolean }[]
  getLevel: () => number
  getLevelTitle: () => string
  getXPProgress: () => { current: number; needed: number; percentage: number }
  getStats: () => {
    totalXP: number
    tier: TierInfo
    streak: number
    weeklyXP: number
    rank: WeeklyRankEntry
    aiCredits: number
    achievementsUnlocked: number
    achievementsTotal: number
    isInTrial: boolean
    trialDaysRemaining: number
    isPremium: boolean
  }
}

// =============================================================================
// STORE
// =============================================================================

export const useGamificationStore = create<GamificationState>()(
  persist(
    (set, get) => ({
      _hasHydrated: false,
      totalXP: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
      currentLevel: 1,
      weeklyXP: 0,
      currentWeek: getWeekKey(),
      aiCreditsUsed: 0,
      currentMonth: getMonthKey(),
      trialStartDate: null,  // Will be set on first use
      isPremium: false,  // Set by payment system
      metricsCount: {},
      unlockedAchievements: [],

      addXP: (amount, _reason) => {
        const state = get()
        const thisWeek = getWeekKey()
        const thisMonth = getMonthKey()

        // Apply streak bonus
        const streakBonus = Math.min(state.currentStreak, 30) * XP_REWARDS.DAILY_STREAK_BONUS
        const totalAmount = amount + (amount > 0 ? Math.floor(streakBonus / 10) : 0)

        const newTotalXP = state.totalXP + totalAmount
        // Calculate level based on XP
        let newLevel = 1
        if (newTotalXP >= TIERS.diamond.minXP) newLevel = 4
        else if (newTotalXP >= TIERS.gold.minXP) newLevel = 3
        else if (newTotalXP >= TIERS.silver.minXP) newLevel = 2

        set((s) => ({
          totalXP: newTotalXP,
          currentLevel: newLevel,
          weeklyXP: s.currentWeek === thisWeek ? s.weeklyXP + totalAmount : totalAmount,
          currentWeek: thisWeek,
          // Reset AI credits if new month
          aiCreditsUsed: s.currentMonth === thisMonth ? s.aiCreditsUsed : 0,
          currentMonth: thisMonth,
        }))

        // Check for new achievements
        get().checkAchievements()
      },

      checkAndUpdateStreak: () => {
        const today = getTodayString()
        const state = get()
        const lastActive = state.lastActiveDate

        set((s) => {
          if (!lastActive) {
            return {
              currentStreak: 1,
              longestStreak: Math.max(1, s.longestStreak),
              lastActiveDate: today,
            }
          }

          if (lastActive === today) {
            return s
          }

          const lastDate = new Date(lastActive)
          const todayDate = new Date(today)
          const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

          if (diffDays === 1) {
            const newStreak = s.currentStreak + 1
            return {
              currentStreak: newStreak,
              longestStreak: Math.max(newStreak, s.longestStreak),
              lastActiveDate: today,
            }
          } else if (diffDays > 1) {
            return {
              currentStreak: 1,
              lastActiveDate: today,
            }
          }

          return s
        })
      },

      incrementMetric: (metric, amount = 1) => {
        set((state) => ({
          metricsCount: {
            ...state.metricsCount,
            [metric]: (state.metricsCount[metric] || 0) + amount,
          },
        }))
        get().checkAchievements()
      },

      setMetric: (metric, value) => {
        set((state) => ({
          metricsCount: {
            ...state.metricsCount,
            [metric]: value,
          },
        }))
        get().checkAchievements()
      },

      useAICredit: () => {
        const state = get()
        const remaining = state.getAICreditsRemaining()

        // No credits remaining (trial or regular)
        if (remaining === 0) return false

        // Consume credit
        set((s) => ({ aiCreditsUsed: s.aiCreditsUsed + 1 }))
        return true
      },

      startTrial: () => {
        const state = get()
        // Only start trial if not already started
        if (!state.trialStartDate) {
          set({ trialStartDate: new Date().toISOString() })
        }
      },

      // Set trial start date from cloud (used for anti-abuse when user re-registers)
      setTrialStartDate: (date: string) => {
        console.log('[GamificationStore] Setting trial start date from cloud:', date)
        set({ trialStartDate: date })
      },

      setPremium: (isPremium: boolean) => {
        set({ isPremium })
        // Reset credits when upgrading to premium
        if (isPremium) {
          set({ aiCreditsUsed: 0 })
        }
      },

      checkAchievements: () => {
        const state = get()
        const newlyUnlocked: string[] = []

        ACHIEVEMENTS.forEach((achievement) => {
          if (state.unlockedAchievements.includes(achievement.id)) return

          let earned = false
          const { condition } = achievement

          switch (condition.type) {
            case 'streak':
              earned = state.currentStreak >= condition.target
              break
            case 'count':
              if (condition.metric) {
                earned = (state.metricsCount[condition.metric] || 0) >= condition.target
              }
              break
            case 'tier':
              earned = state.totalXP >= condition.target
              break
          }

          if (earned) {
            newlyUnlocked.push(achievement.id)
          }
        })

        if (newlyUnlocked.length > 0) {
          set((s) => ({
            unlockedAchievements: [...s.unlockedAchievements, ...newlyUnlocked],
          }))

          // Add XP for achievements (without recursion)
          const xpToAdd = newlyUnlocked.reduce((sum, id) => {
            const a = ACHIEVEMENTS.find((x) => x.id === id)
            return sum + (a?.xpReward || 0)
          }, 0)

          if (xpToAdd > 0) {
            set((s) => ({ totalXP: s.totalXP + xpToAdd }))
          }
        }
      },

      // Getters
      getTier: () => {
        const xp = get().totalXP
        if (xp >= TIERS.diamond.minXP) return TIERS.diamond
        if (xp >= TIERS.gold.minXP) return TIERS.gold
        if (xp >= TIERS.silver.minXP) return TIERS.silver
        return TIERS.bronze
      },

      getNextTier: () => {
        const tier = get().getTier()
        if (tier.id === 'bronze') return TIERS.silver
        if (tier.id === 'silver') return TIERS.gold
        if (tier.id === 'gold') return TIERS.diamond
        return null
      },

      getTierProgress: () => {
        const state = get()
        const tier = state.getTier()
        const nextTier = state.getNextTier()

        if (!nextTier) {
          return { current: state.totalXP, needed: state.totalXP, percentage: 100 }
        }

        const current = state.totalXP - tier.minXP
        const needed = nextTier.minXP - tier.minXP
        const percentage = Math.min(100, (current / needed) * 100)

        return { current, needed, percentage }
      },

      getWeeklyRank: () => {
        const weeklyXP = get().weeklyXP

        let percentile = 100
        if (weeklyXP >= RANKING_THRESHOLDS.top1) percentile = 1
        else if (weeklyXP >= RANKING_THRESHOLDS.top5) percentile = 5
        else if (weeklyXP >= RANKING_THRESHOLDS.top10) percentile = 10
        else if (weeklyXP >= RANKING_THRESHOLDS.top25) percentile = 25
        else if (weeklyXP >= RANKING_THRESHOLDS.top50) percentile = 50

        // Simulated rank (would be server-side)
        const rank = percentile === 1 ? Math.floor(Math.random() * 100) + 1
                   : percentile === 5 ? Math.floor(Math.random() * 400) + 100
                   : Math.floor(Math.random() * 1000) + 500

        return { rank, xpThisWeek: weeklyXP, percentile }
      },

      getAICreditsRemaining: () => {
        const state = get()

        // Premium users = unlimited AI
        if (state.isPremium) {
          return 999
        }

        // During trial period: UNLIMITED credits for full testing experience
        // Les testeurs doivent pouvoir tout tester pendant les 7 jours
        if (state.isInTrialPeriod()) {
          return 999
        }

        // Check if new month (reset credits)
        const thisMonth = getMonthKey()
        const used = state.currentMonth === thisMonth ? state.aiCreditsUsed : 0

        // Free users after trial: only 3 credits/month (frustrating, push to premium)
        return Math.max(0, FREE_MONTHLY_AI_CREDITS - used)
      },

      isInTrialPeriod: () => {
        const { trialStartDate } = get()
        if (!trialStartDate) return false

        const startDate = new Date(trialStartDate)
        const now = new Date()
        const daysPassed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

        return daysPassed < TRIAL_DURATION_DAYS
      },

      getTrialDaysRemaining: () => {
        const { trialStartDate } = get()
        if (!trialStartDate) return TRIAL_DURATION_DAYS  // Not started yet

        const startDate = new Date(trialStartDate)
        const now = new Date()
        const daysPassed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        const remaining = TRIAL_DURATION_DAYS - daysPassed

        return Math.max(0, remaining)
      },

      getStreakInfo: () => {
        const state = get()
        const today = getTodayString()
        let isActive = false

        if (state.lastActiveDate === today) {
          isActive = true
        } else if (state.lastActiveDate) {
          const daysDiff = Math.floor(
            (new Date(today).getTime() - new Date(state.lastActiveDate).getTime()) / (1000 * 60 * 60 * 24)
          )
          isActive = daysDiff <= 1
        }

        // Streak bonus: +5% XP per streak day (max +150% at 30 days)
        const bonus = Math.min(state.currentStreak, 30) * 5

        return {
          current: state.currentStreak,
          longest: state.longestStreak,
          isActive,
          bonus,
        }
      },

      getAchievements: () => {
        const state = get()
        return ACHIEVEMENTS.map((achievement) => ({
          achievement,
          unlocked: state.unlockedAchievements.includes(achievement.id),
        }))
      },

      // Legacy compatibility methods
      getLevel: () => {
        const xp = get().totalXP
        if (xp >= TIERS.diamond.minXP) return 4
        if (xp >= TIERS.gold.minXP) return 3
        if (xp >= TIERS.silver.minXP) return 2
        return 1
      },

      getLevelTitle: () => {
        return get().getTier().nameFr
      },

      getXPProgress: () => {
        return get().getTierProgress()
      },

      getStats: () => {
        const state = get()
        const tier = state.getTier()
        const rank = state.getWeeklyRank()
        const achievements = state.getAchievements()

        return {
          totalXP: state.totalXP,
          tier,
          streak: state.currentStreak,
          weeklyXP: state.weeklyXP,
          rank,
          aiCredits: state.getAICreditsRemaining(),
          achievementsUnlocked: achievements.filter((a) => a.unlocked).length,
          achievementsTotal: achievements.length,
          isInTrial: state.isInTrialPeriod(),
          trialDaysRemaining: state.getTrialDaysRemaining(),
          isPremium: state.isPremium,
        }
      },
    }),
    {
      name: 'presence-gamification-v4',  // Bump version for premium field
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => () => {
        console.log('[GamificationStore] Hydrated')
        useGamificationStore.setState({ _hasHydrated: true })
      },
      partialize: (state) => ({
        totalXP: state.totalXP,
        currentStreak: state.currentStreak,
        longestStreak: state.longestStreak,
        lastActiveDate: state.lastActiveDate,
        currentLevel: state.currentLevel,
        weeklyXP: state.weeklyXP,
        currentWeek: state.currentWeek,
        aiCreditsUsed: state.aiCreditsUsed,
        currentMonth: state.currentMonth,
        trialStartDate: state.trialStartDate,
        isPremium: state.isPremium,  // Persist premium status
        metricsCount: state.metricsCount,
        unlockedAchievements: state.unlockedAchievements,
      }),
    }
  )
)

// Hydration hook - must be defined AFTER useGamificationStore
export const useGamificationStoreHydration = () => useGamificationStore((s) => s._hasHydrated)

// Legacy exports for backward compatibility
export const BADGES = ACHIEVEMENTS
export const LEVEL_THRESHOLDS = [0, 500, 2000, 5000]
export const LEVEL_TITLES: Record<number, string> = {
  1: 'Bronze',
  2: 'Argent',
  3: 'Or',
  4: 'Diamant',
}
