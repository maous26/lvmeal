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

export const TIERS: Record<UserTier, TierInfo> = {
  bronze: {
    id: 'bronze',
    name: 'Bronze',
    nameFr: 'Bronze',
    icon: '🥉',
    color: '#CD7F32',
    minXP: 0,
    aiCredits: 0,
    features: ['Suivi repas', 'Objectifs nutrition'],
  },
  silver: {
    id: 'silver',
    name: 'Silver',
    nameFr: 'Argent',
    icon: '🥈',
    color: '#C0C0C0',
    minXP: 500,
    aiCredits: 5,
    features: ['5 analyses photo IA/mois', 'Suggestions personnalisees'],
  },
  gold: {
    id: 'gold',
    name: 'Gold',
    nameFr: 'Or',
    icon: '🥇',
    color: '#FFD700',
    minXP: 2000,
    aiCredits: 20,
    features: ['20 analyses photo IA/mois', 'Plans IA illimites', 'Coach vocal'],
  },
  diamond: {
    id: 'diamond',
    name: 'Diamond',
    nameFr: 'Diamant',
    icon: '💎',
    color: '#B9F2FF',
    minXP: 5000,
    aiCredits: -1, // Unlimited
    features: ['IA illimitee', 'Premium gratuit 1 mois', 'Acces beta features'],
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
  { id: 'streak_30', name: 'Mois engage', description: '30 jours consecutifs', icon: '⚡', xpReward: 500, condition: { type: 'streak', target: 30 } },
  { id: 'streak_100', name: 'Centenaire', description: '100 jours consecutifs', icon: '🏆', xpReward: 2000, condition: { type: 'streak', target: 100 } },

  // Meals (3)
  { id: 'meals_10', name: 'Regulier', description: '10 repas enregistres', icon: '🍽️', xpReward: 50, condition: { type: 'count', target: 10, metric: 'meals_logged' } },
  { id: 'meals_100', name: 'Gourmet', description: '100 repas enregistres', icon: '👨‍🍳', xpReward: 300, condition: { type: 'count', target: 100, metric: 'meals_logged' } },
  { id: 'meals_500', name: 'Chef', description: '500 repas enregistres', icon: '⭐', xpReward: 1000, condition: { type: 'count', target: 500, metric: 'meals_logged' } },

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

interface GamificationState {
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

  // Getters
  getTier: () => TierInfo
  getNextTier: () => TierInfo | null
  getTierProgress: () => { current: number; needed: number; percentage: number }
  getWeeklyRank: () => WeeklyRankEntry
  getAICreditsRemaining: () => number
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
  }
}

// =============================================================================
// STORE
// =============================================================================

export const useGamificationStore = create<GamificationState>()(
  persist(
    (set, get) => ({
      totalXP: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
      currentLevel: 1,
      weeklyXP: 0,
      currentWeek: getWeekKey(),
      aiCreditsUsed: 0,
      currentMonth: getMonthKey(),
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
        const tier = state.getTier()
        const remaining = state.getAICreditsRemaining()

        if (remaining === 0) return false

        set((s) => ({ aiCreditsUsed: s.aiCreditsUsed + 1 }))
        return true
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
        const tier = state.getTier()

        // Check if new month
        const thisMonth = getMonthKey()
        const used = state.currentMonth === thisMonth ? state.aiCreditsUsed : 0

        if (tier.aiCredits === -1) return 999 // Unlimited
        return Math.max(0, tier.aiCredits - used)
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
        }
      },
    }),
    {
      name: 'presence-gamification-v2',
      storage: createJSONStorage(() => AsyncStorage),
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
        metricsCount: state.metricsCount,
        unlockedAchievements: state.unlockedAchievements,
      }),
    }
  )
)

// Legacy exports for backward compatibility
export const BADGES = ACHIEVEMENTS
export const LEVEL_THRESHOLDS = [0, 500, 2000, 5000]
export const LEVEL_TITLES: Record<number, string> = {
  1: 'Bronze',
  2: 'Argent',
  3: 'Or',
  4: 'Diamant',
}
