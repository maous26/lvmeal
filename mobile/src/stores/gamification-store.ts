import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { BadgeCategory, BadgeDefinition, EarnedBadge, PendingReward } from '../types'

// Helper to get today's date string
function getTodayString(): string {
  return new Date().toISOString().split('T')[0]
}

// XP rewards for different actions
export const XP_REWARDS = {
  // Daily actions
  LOG_MEAL: 10,
  LOG_BREAKFAST: 15,
  LOG_ALL_MEALS: 50,
  REACH_CALORIE_TARGET: 30,
  REACH_PROTEIN_TARGET: 20,
  LOG_HYDRATION: 5,
  REACH_HYDRATION_TARGET: 25,

  // Weekly actions
  COMPLETE_WEEKLY_PLAN: 100,
  FOLLOW_PLAN_DAY: 25,
  SAVE_SHOPPING_LIST: 15,

  // Streaks
  STREAK_3_DAYS: 50,
  STREAK_7_DAYS: 150,
  STREAK_14_DAYS: 300,
  STREAK_30_DAYS: 750,
  STREAK_60_DAYS: 1500,
  STREAK_100_DAYS: 3000,

  // Achievements
  FIRST_MEAL_LOGGED: 25,
  FIRST_RECIPE_SAVED: 20,
  FIRST_WEEKLY_PLAN: 100,
  WEIGHT_MILESTONE: 200,
  ADD_RECIPE_TO_FAVORITES: 10,

  // Wellness actions
  LOG_SLEEP: 10,
  GOOD_SLEEP_7H: 20,
  LOG_WELLNESS_CHECKIN: 15,
  LOW_STRESS_DAY: 15,
  HIGH_ENERGY_DAY: 10,
  REACH_STEPS_TARGET: 25,
  REACH_FIBER_TARGET: 15,
  WELLNESS_SCORE_80: 30,

  // Sport actions
  COMPLETE_SESSION: 30,
  COMPLETE_PHASE: 150,
  SPORT_STREAK_DAY: 15,
  GIVE_SESSION_FEEDBACK: 10,
  CONNECT_WEARABLE: 50,
  SYNC_WEARABLE: 5,
  WEEKLY_PROGRAM_COMPLETED: 100,
} as const

// Level thresholds
export const LEVEL_THRESHOLDS = [
  0, 100, 250, 500, 850, 1300, 1900, 2700, 3700, 5000,
  6500, 8500, 11000, 14000, 18000, 23000, 29000, 36000, 45000, 55000,
]

// Level titles
export const LEVEL_TITLES: Record<number, string> = {
  1: 'Curieux',
  2: 'Motive',
  3: 'Engage',
  4: 'Regulier',
  5: 'Assidu',
  6: 'Equilibre',
  7: 'Consciencieux',
  8: 'Epanoui',
  9: 'Inspire',
  10: 'Coach',
  11: 'Mentor',
  12: 'Guide',
  13: 'Ambassadeur',
  14: 'Expert Bien-etre',
  15: 'Maitre Equilibre',
  16: 'Gourou Nutrition',
  17: 'Sage',
  18: 'Eclaire',
  19: 'Zen Master',
  20: 'Legende Vivante',
}

// All available badges
export const BADGES: BadgeDefinition[] = [
  // Streak badges
  { id: 'streak_3', name: 'Premier Pas', description: 'Maintenir une serie de 3 jours', icon: '🔥', category: 'streak', xpReward: 50, condition: { type: 'streak', target: 3 } },
  { id: 'streak_7', name: 'Semaine Parfaite', description: 'Maintenir une serie de 7 jours', icon: '⚡', category: 'streak', xpReward: 150, condition: { type: 'streak', target: 7 } },
  { id: 'streak_14', name: "Force de l'Habitude", description: 'Maintenir une serie de 14 jours', icon: '💪', category: 'streak', xpReward: 300, condition: { type: 'streak', target: 14 } },
  { id: 'streak_30', name: 'Champion du Mois', description: 'Maintenir une serie de 30 jours', icon: '🏆', category: 'streak', xpReward: 750, condition: { type: 'streak', target: 30 } },
  { id: 'streak_60', name: 'Maitre de la Discipline', description: 'Maintenir une serie de 60 jours', icon: '👑', category: 'streak', xpReward: 1500, condition: { type: 'streak', target: 60 } },
  { id: 'streak_100', name: 'Legende Vivante', description: 'Maintenir une serie de 100 jours', icon: '🌟', category: 'streak', xpReward: 3000, condition: { type: 'streak', target: 100 } },

  // Nutrition badges
  { id: 'first_meal', name: 'Premier Repas', description: 'Enregistrer votre premier repas', icon: '🍽️', category: 'nutrition', xpReward: 25, condition: { type: 'count', target: 1, metric: 'meals_logged' } },
  { id: 'meals_10', name: 'Gourmet Debutant', description: 'Enregistrer 10 repas', icon: '🥗', category: 'nutrition', xpReward: 50, condition: { type: 'count', target: 10, metric: 'meals_logged' } },
  { id: 'meals_50', name: 'Gourmet Confirme', description: 'Enregistrer 50 repas', icon: '🍳', category: 'nutrition', xpReward: 150, condition: { type: 'count', target: 50, metric: 'meals_logged' } },
  { id: 'meals_100', name: 'Chef Etoile', description: 'Enregistrer 100 repas', icon: '👨‍🍳', category: 'nutrition', xpReward: 300, condition: { type: 'count', target: 100, metric: 'meals_logged' } },
  { id: 'hydration_pro', name: 'Hydratation Pro', description: "Atteindre l'objectif hydratation 7 jours de suite", icon: '💧', category: 'nutrition', xpReward: 150, condition: { type: 'count', target: 7, metric: 'hydration_streak' } },

  // Planning badges
  { id: 'first_plan', name: 'Planificateur', description: 'Creer votre premier plan de 7 jours', icon: '📅', category: 'planning', xpReward: 100, condition: { type: 'count', target: 1, metric: 'plans_created' } },
  { id: 'plan_follower', name: 'Fidele au Plan', description: 'Suivre le plan pendant 7 jours consecutifs', icon: '✅', category: 'planning', xpReward: 300, condition: { type: 'count', target: 7, metric: 'plan_follow_streak' } },

  // Milestone badges
  { id: 'weight_1kg', name: 'Premier Kilo', description: 'Perdre ou prendre 1kg vers votre objectif', icon: '🎯', category: 'milestone', xpReward: 200, condition: { type: 'milestone', target: 1, metric: 'weight_progress' } },
  { id: 'weight_5kg', name: 'Transformation', description: 'Perdre ou prendre 5kg vers votre objectif', icon: '🏅', category: 'milestone', xpReward: 500, condition: { type: 'milestone', target: 5, metric: 'weight_progress' } },
  { id: 'goal_reached', name: 'Objectif Atteint', description: 'Atteindre votre poids cible', icon: '🏆', category: 'milestone', xpReward: 2000, condition: { type: 'milestone', target: 0, metric: 'goal_reached' } },

  // Wellness badges
  { id: 'sleep_pro', name: 'Dormeur Pro', description: '7 nuits de 7h+ consecutives', icon: '😴', category: 'wellness', xpReward: 200, condition: { type: 'count', target: 7, metric: 'sleep_7h_streak' } },
  { id: 'zen_master', name: 'Zen Master', description: 'Stress faible pendant 7 jours', icon: '🧘', category: 'wellness', xpReward: 250, condition: { type: 'count', target: 7, metric: 'low_stress_streak' } },
  { id: 'wellness_balance', name: 'Equilibre Total', description: 'Score wellness >=80 pendant 7 jours', icon: '🌈', category: 'wellness', xpReward: 400, condition: { type: 'count', target: 7, metric: 'wellness_80_streak' } },

  // Sport badges
  { id: 'first_session', name: 'Premiere Seance', description: 'Completer ta premiere seance', icon: '🎯', category: 'sport', xpReward: 50, condition: { type: 'count', target: 1, metric: 'sessions_completed' } },
  { id: 'sessions_10', name: 'Regulier', description: 'Completer 10 seances', icon: '💪', category: 'sport', xpReward: 200, condition: { type: 'count', target: 10, metric: 'sessions_completed' } },
  { id: 'sport_streak_7', name: 'Semaine Active', description: "7 jours d'activite consecutifs", icon: '🔥', category: 'sport', xpReward: 200, condition: { type: 'streak', target: 7, metric: 'sport_streak' } },
  { id: 'phase_evolution', name: 'Evolution', description: 'Completer une phase du programme', icon: '📈', category: 'sport', xpReward: 300, condition: { type: 'count', target: 1, metric: 'phases_completed' } },

  // Special badges
  { id: 'early_bird', name: 'Leve-tot', description: 'Enregistrer un petit-dejeuner avant 8h', icon: '🌅', category: 'special', xpReward: 30, condition: { type: 'special', target: 1, metric: 'early_breakfast' } },
  { id: 'repas_plaisir', name: 'Plaisir Merite', description: 'Debloquer un repas plaisir grace a la banque calorique', icon: '🍰', category: 'special', xpReward: 100, condition: { type: 'count', target: 1, metric: 'repas_plaisir_earned' } },
]

interface DailyProgress {
  date: string
  mealsLogged: number
  caloriesReached: boolean
  proteinReached: boolean
  hydrationReached: boolean
  allMealsLogged: boolean
}

interface GamificationState {
  totalXP: number
  currentLevel: number
  currentStreak: number
  longestStreak: number
  lastActiveDate: string | null
  metricsCount: Record<string, number>
  earnedBadges: EarnedBadge[]
  dailyProgress: DailyProgress[]
  pendingRewards: PendingReward[]

  // Actions
  addXP: (amount: number, reason?: string) => void
  checkAndUpdateStreak: () => void
  incrementMetric: (metric: string, amount?: number) => void
  setMetric: (metric: string, value: number) => void
  checkBadges: () => EarnedBadge[]
  unlockBadge: (badgeId: string) => boolean
  markBadgeNotified: (badgeId: string) => void
  updateDailyProgress: (progress: Partial<DailyProgress>) => void
  consumeReward: (rewardId: string) => void
  clearPendingRewards: () => void

  // Getters
  getLevel: () => number
  getLevelTitle: () => string
  getXPProgress: () => { current: number; needed: number; percentage: number }
  getBadgesByCategory: (category: BadgeCategory) => { badge: BadgeDefinition; earned: boolean; earnedAt?: string }[]
  getUnlockedBadges: () => BadgeDefinition[]
  getNextBadges: () => BadgeDefinition[]
  getStreakInfo: () => { current: number; longest: number; isActive: boolean }
}

export const useGamificationStore = create<GamificationState>()(
  persist(
    (set, get) => ({
      totalXP: 0,
      currentLevel: 1,
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
      metricsCount: {},
      earnedBadges: [],
      dailyProgress: [],
      pendingRewards: [],

      addXP: (amount, _reason) => {
        set((state) => {
          const newTotalXP = state.totalXP + amount

          let newLevel = 1
          for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
            if (newTotalXP >= LEVEL_THRESHOLDS[i]) {
              newLevel = i + 1
              break
            }
          }

          const leveledUp = newLevel > state.currentLevel
          const rewards: PendingReward[] = [
            {
              id: `xp-${Date.now()}`,
              type: 'xp',
              amount,
              timestamp: new Date().toISOString(),
            },
          ]

          if (leveledUp) {
            rewards.push({
              id: `level-${Date.now()}`,
              type: 'level_up',
              newLevel,
              timestamp: new Date().toISOString(),
            })
          }

          return {
            totalXP: newTotalXP,
            currentLevel: newLevel,
            pendingRewards: [...state.pendingRewards, ...rewards],
          }
        })
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

        get().checkBadges()
      },

      incrementMetric: (metric, amount = 1) => {
        set((state) => ({
          metricsCount: {
            ...state.metricsCount,
            [metric]: (state.metricsCount[metric] || 0) + amount,
          },
        }))

        get().checkBadges()
      },

      setMetric: (metric, value) => {
        set((state) => ({
          metricsCount: {
            ...state.metricsCount,
            [metric]: value,
          },
        }))

        get().checkBadges()
      },

      checkBadges: () => {
        const state = get()
        const newlyEarned: EarnedBadge[] = []

        BADGES.forEach((badge) => {
          if (state.earnedBadges.some((eb) => eb.badgeId === badge.id)) {
            return
          }

          let earned = false
          const { condition } = badge

          switch (condition.type) {
            case 'streak':
              earned = state.currentStreak >= condition.target
              break
            case 'count':
            case 'milestone':
            case 'special':
              if (condition.metric) {
                earned = (state.metricsCount[condition.metric] || 0) >= condition.target
              }
              break
          }

          if (earned) {
            const earnedBadge: EarnedBadge = {
              badgeId: badge.id,
              earnedAt: new Date().toISOString(),
              notified: false,
            }
            newlyEarned.push(earnedBadge)
          }
        })

        if (newlyEarned.length > 0) {
          set((s) => ({
            earnedBadges: [...s.earnedBadges, ...newlyEarned],
            pendingRewards: [
              ...s.pendingRewards,
              ...newlyEarned.map((eb) => ({
                id: `badge-${eb.badgeId}-${Date.now()}`,
                type: 'badge' as const,
                badgeId: eb.badgeId,
                timestamp: eb.earnedAt,
              })),
            ],
          }))

          newlyEarned.forEach((eb) => {
            const badge = BADGES.find((b) => b.id === eb.badgeId)
            if (badge) {
              get().addXP(badge.xpReward, `Badge: ${badge.name}`)
            }
          })
        }

        return newlyEarned
      },

      unlockBadge: (badgeId) => {
        const state = get()
        if (state.earnedBadges.some((eb) => eb.badgeId === badgeId)) {
          return false
        }

        const badge = BADGES.find((b) => b.id === badgeId)
        if (!badge) return false

        const earnedBadge: EarnedBadge = {
          badgeId,
          earnedAt: new Date().toISOString(),
          notified: false,
        }

        set((s) => ({
          earnedBadges: [...s.earnedBadges, earnedBadge],
          pendingRewards: [
            ...s.pendingRewards,
            {
              id: `badge-${badgeId}-${Date.now()}`,
              type: 'badge',
              badgeId,
              timestamp: earnedBadge.earnedAt,
            },
          ],
        }))

        get().addXP(badge.xpReward, `Badge: ${badge.name}`)
        return true
      },

      markBadgeNotified: (badgeId) => {
        set((state) => ({
          earnedBadges: state.earnedBadges.map((eb) =>
            eb.badgeId === badgeId ? { ...eb, notified: true } : eb
          ),
        }))
      },

      updateDailyProgress: (progress) => {
        const today = getTodayString()

        set((state) => {
          const existingIndex = state.dailyProgress.findIndex((p) => p.date === today)
          const existingProgress = existingIndex >= 0
            ? state.dailyProgress[existingIndex]
            : { date: today, mealsLogged: 0, caloriesReached: false, proteinReached: false, hydrationReached: false, allMealsLogged: false }

          const updatedProgress = { ...existingProgress, ...progress }

          if (existingIndex >= 0) {
            const newDailyProgress = [...state.dailyProgress]
            newDailyProgress[existingIndex] = updatedProgress
            return { dailyProgress: newDailyProgress }
          } else {
            return { dailyProgress: [...state.dailyProgress.slice(-30), updatedProgress] }
          }
        })
      },

      consumeReward: (rewardId) => {
        set((state) => ({
          pendingRewards: state.pendingRewards.filter((r) => r.id !== rewardId),
        }))
      },

      clearPendingRewards: () => {
        set({ pendingRewards: [] })
      },

      getLevel: () => get().currentLevel,

      getLevelTitle: () => LEVEL_TITLES[get().currentLevel] || 'Inconnu',

      getXPProgress: () => {
        const state = get()
        const currentLevelXP = LEVEL_THRESHOLDS[state.currentLevel - 1] || 0
        const nextLevelXP = LEVEL_THRESHOLDS[state.currentLevel] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]
        const current = state.totalXP - currentLevelXP
        const needed = nextLevelXP - currentLevelXP
        const percentage = needed > 0 ? Math.min(100, (current / needed) * 100) : 100

        return { current, needed, percentage }
      },

      getBadgesByCategory: (category) => {
        const state = get()
        return BADGES
          .filter((b) => b.category === category)
          .map((badge) => {
            const earned = state.earnedBadges.find((eb) => eb.badgeId === badge.id)
            return {
              badge,
              earned: !!earned,
              earnedAt: earned?.earnedAt,
            }
          })
      },

      getUnlockedBadges: () => {
        const state = get()
        return BADGES.filter((b) => state.earnedBadges.some((eb) => eb.badgeId === b.id))
      },

      getNextBadges: () => {
        const state = get()
        return BADGES
          .filter((b) => !state.earnedBadges.some((eb) => eb.badgeId === b.id))
          .slice(0, 3)
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

        return {
          current: state.currentStreak,
          longest: state.longestStreak,
          isActive,
        }
      },
    }),
    {
      name: 'presence-gamification',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        totalXP: state.totalXP,
        currentLevel: state.currentLevel,
        currentStreak: state.currentStreak,
        longestStreak: state.longestStreak,
        lastActiveDate: state.lastActiveDate,
        metricsCount: state.metricsCount,
        earnedBadges: state.earnedBadges,
        dailyProgress: state.dailyProgress,
      }),
    }
  )
)
