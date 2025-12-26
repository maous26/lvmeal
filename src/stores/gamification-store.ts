import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

// Helper to get today's date string
function getTodayString(): string {
  return new Date().toISOString().split('T')[0]
}

// XP rewards for different actions
export const XP_REWARDS = {
  // Daily actions
  LOG_MEAL: 10,
  LOG_BREAKFAST: 15, // Bonus for logging breakfast
  LOG_ALL_MEALS: 50, // Bonus for logging all 4 meals
  REACH_CALORIE_TARGET: 30, // Within 10% of target
  REACH_PROTEIN_TARGET: 20,
  LOG_HYDRATION: 5,
  REACH_HYDRATION_TARGET: 25,

  // Weekly actions
  COMPLETE_WEEKLY_PLAN: 100,
  FOLLOW_PLAN_DAY: 25, // Following the meal plan
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
  WEIGHT_MILESTONE: 200, // Every kg lost/gained toward goal

  // Social/Engagement
  RATE_RECIPE: 10,
  ADD_RECIPE_TO_FAVORITES: 5,
  SHARE_PROGRESS: 25,
} as const

// Level thresholds (XP needed to reach each level)
export const LEVEL_THRESHOLDS = [
  0,      // Level 1 (start)
  100,    // Level 2
  250,    // Level 3
  500,    // Level 4
  850,    // Level 5
  1300,   // Level 6
  1900,   // Level 7
  2700,   // Level 8
  3700,   // Level 9
  5000,   // Level 10
  6500,   // Level 11
  8500,   // Level 12
  11000,  // Level 13
  14000,  // Level 14
  18000,  // Level 15
  23000,  // Level 16
  29000,  // Level 17
  36000,  // Level 18
  45000,  // Level 19
  55000,  // Level 20
]

// Level titles in French - Nutrition/wellness vocabulary
export const LEVEL_TITLES: Record<number, string> = {
  1: 'Curieux',
  2: 'Motivé',
  3: 'Engagé',
  4: 'Régulier',
  5: 'Assidu',
  6: 'Équilibré',
  7: 'Consciencieux',
  8: 'Épanoui',
  9: 'Inspiré',
  10: 'Coach',
  11: 'Mentor',
  12: 'Guide',
  13: 'Ambassadeur',
  14: 'Expert Bien-être',
  15: 'Maître Équilibre',
  16: 'Gourou Nutrition',
  17: 'Sage',
  18: 'Éclairé',
  19: 'Zen Master',
  20: 'Légende Vivante',
}

// Badge categories
export type BadgeCategory = 'streak' | 'nutrition' | 'planning' | 'milestone' | 'special'

// Badge definition
export interface BadgeDefinition {
  id: string
  name: string
  description: string
  icon: string
  category: BadgeCategory
  xpReward: number
  condition: {
    type: 'streak' | 'count' | 'milestone' | 'special'
    target: number
    metric?: string
  }
}

// All available badges
export const BADGES: BadgeDefinition[] = [
  // Streak badges
  {
    id: 'streak_3',
    name: 'Premier Pas',
    description: 'Maintenir une série de 3 jours',
    icon: '🔥',
    category: 'streak',
    xpReward: 50,
    condition: { type: 'streak', target: 3 },
  },
  {
    id: 'streak_7',
    name: 'Semaine Parfaite',
    description: 'Maintenir une série de 7 jours',
    icon: '⚡',
    category: 'streak',
    xpReward: 150,
    condition: { type: 'streak', target: 7 },
  },
  {
    id: 'streak_14',
    name: 'Force de l\'Habitude',
    description: 'Maintenir une série de 14 jours',
    icon: '💪',
    category: 'streak',
    xpReward: 300,
    condition: { type: 'streak', target: 14 },
  },
  {
    id: 'streak_30',
    name: 'Champion du Mois',
    description: 'Maintenir une série de 30 jours',
    icon: '🏆',
    category: 'streak',
    xpReward: 750,
    condition: { type: 'streak', target: 30 },
  },
  {
    id: 'streak_60',
    name: 'Maître de la Discipline',
    description: 'Maintenir une série de 60 jours',
    icon: '👑',
    category: 'streak',
    xpReward: 1500,
    condition: { type: 'streak', target: 60 },
  },
  {
    id: 'streak_100',
    name: 'Légende Vivante',
    description: 'Maintenir une série de 100 jours',
    icon: '🌟',
    category: 'streak',
    xpReward: 3000,
    condition: { type: 'streak', target: 100 },
  },

  // Nutrition badges
  {
    id: 'first_meal',
    name: 'Premier Repas',
    description: 'Enregistrer votre premier repas',
    icon: '🍽️',
    category: 'nutrition',
    xpReward: 25,
    condition: { type: 'count', target: 1, metric: 'meals_logged' },
  },
  {
    id: 'meals_10',
    name: 'Gourmet Débutant',
    description: 'Enregistrer 10 repas',
    icon: '🥗',
    category: 'nutrition',
    xpReward: 50,
    condition: { type: 'count', target: 10, metric: 'meals_logged' },
  },
  {
    id: 'meals_50',
    name: 'Gourmet Confirmé',
    description: 'Enregistrer 50 repas',
    icon: '🍳',
    category: 'nutrition',
    xpReward: 150,
    condition: { type: 'count', target: 50, metric: 'meals_logged' },
  },
  {
    id: 'meals_100',
    name: 'Chef Étoilé',
    description: 'Enregistrer 100 repas',
    icon: '👨‍🍳',
    category: 'nutrition',
    xpReward: 300,
    condition: { type: 'count', target: 100, metric: 'meals_logged' },
  },
  {
    id: 'meals_500',
    name: 'Maître Cuisinier',
    description: 'Enregistrer 500 repas',
    icon: '🎖️',
    category: 'nutrition',
    xpReward: 1000,
    condition: { type: 'count', target: 500, metric: 'meals_logged' },
  },
  {
    id: 'protein_master',
    name: 'Protéine Power',
    description: 'Atteindre l\'objectif protéines 7 jours de suite',
    icon: '💪',
    category: 'nutrition',
    xpReward: 200,
    condition: { type: 'count', target: 7, metric: 'protein_streak' },
  },
  {
    id: 'hydration_pro',
    name: 'Hydratation Pro',
    description: 'Atteindre l\'objectif hydratation 7 jours de suite',
    icon: '💧',
    category: 'nutrition',
    xpReward: 150,
    condition: { type: 'count', target: 7, metric: 'hydration_streak' },
  },
  {
    id: 'balanced_week',
    name: 'Équilibre Parfait',
    description: 'Respecter les macros 7 jours de suite',
    icon: '⚖️',
    category: 'nutrition',
    xpReward: 300,
    condition: { type: 'count', target: 7, metric: 'balanced_days' },
  },

  // Planning badges
  {
    id: 'first_plan',
    name: 'Planificateur',
    description: 'Créer votre premier plan de 7 jours',
    icon: '📅',
    category: 'planning',
    xpReward: 100,
    condition: { type: 'count', target: 1, metric: 'plans_created' },
  },
  {
    id: 'plans_5',
    name: 'Organisé',
    description: 'Créer 5 plans de repas',
    icon: '📋',
    category: 'planning',
    xpReward: 250,
    condition: { type: 'count', target: 5, metric: 'plans_created' },
  },
  {
    id: 'plans_10',
    name: 'Stratège Culinaire',
    description: 'Créer 10 plans de repas',
    icon: '🗓️',
    category: 'planning',
    xpReward: 500,
    condition: { type: 'count', target: 10, metric: 'plans_created' },
  },
  {
    id: 'shopping_saver',
    name: 'Économe',
    description: 'Télécharger 5 listes de courses',
    icon: '🛒',
    category: 'planning',
    xpReward: 100,
    condition: { type: 'count', target: 5, metric: 'shopping_lists_saved' },
  },
  {
    id: 'plan_follower',
    name: 'Fidèle au Plan',
    description: 'Suivre le plan pendant 7 jours consécutifs',
    icon: '✅',
    category: 'planning',
    xpReward: 300,
    condition: { type: 'count', target: 7, metric: 'plan_follow_streak' },
  },

  // Milestone badges
  {
    id: 'weight_1kg',
    name: 'Premier Kilo',
    description: 'Perdre ou prendre 1kg vers votre objectif',
    icon: '🎯',
    category: 'milestone',
    xpReward: 200,
    condition: { type: 'milestone', target: 1, metric: 'weight_progress' },
  },
  {
    id: 'weight_5kg',
    name: 'Transformation',
    description: 'Perdre ou prendre 5kg vers votre objectif',
    icon: '🏅',
    category: 'milestone',
    xpReward: 500,
    condition: { type: 'milestone', target: 5, metric: 'weight_progress' },
  },
  {
    id: 'weight_10kg',
    name: 'Métamorphose',
    description: 'Perdre ou prendre 10kg vers votre objectif',
    icon: '🦋',
    category: 'milestone',
    xpReward: 1000,
    condition: { type: 'milestone', target: 10, metric: 'weight_progress' },
  },
  {
    id: 'goal_reached',
    name: 'Objectif Atteint',
    description: 'Atteindre votre poids cible',
    icon: '🏆',
    category: 'milestone',
    xpReward: 2000,
    condition: { type: 'milestone', target: 0, metric: 'goal_reached' },
  },

  // Special badges
  {
    id: 'early_bird',
    name: 'Lève-tôt',
    description: 'Enregistrer un petit-déjeuner avant 8h',
    icon: '🌅',
    category: 'special',
    xpReward: 30,
    condition: { type: 'special', target: 1, metric: 'early_breakfast' },
  },
  {
    id: 'weekend_warrior',
    name: 'Guerrier du Weekend',
    description: 'Maintenir le suivi pendant 4 weekends',
    icon: '🦸',
    category: 'special',
    xpReward: 200,
    condition: { type: 'count', target: 4, metric: 'weekend_tracking' },
  },
  {
    id: 'repas_plaisir',
    name: 'Plaisir Mérité',
    description: 'Débloquer un repas plaisir grâce à la banque calorique',
    icon: '🍰',
    category: 'special',
    xpReward: 100,
    condition: { type: 'count', target: 1, metric: 'repas_plaisir_earned' },
  },
  {
    id: 'recipe_collector',
    name: 'Collectionneur',
    description: 'Ajouter 20 recettes aux favoris',
    icon: '📚',
    category: 'special',
    xpReward: 150,
    condition: { type: 'count', target: 20, metric: 'favorite_recipes' },
  },
]

// ============================================================================
// STATE INTERFACE
// ============================================================================

interface EarnedBadge {
  badgeId: string
  earnedAt: string
  notified: boolean
}

interface DailyProgress {
  date: string
  mealsLogged: number
  caloriesReached: boolean
  proteinReached: boolean
  hydrationReached: boolean
  allMealsLogged: boolean
}

interface PendingReward {
  id: string
  type: 'xp' | 'badge' | 'level_up'
  amount?: number
  badgeId?: string
  newLevel?: number
  timestamp: string
}

interface GamificationState {
  // Core stats
  totalXP: number
  currentLevel: number
  currentStreak: number
  longestStreak: number
  lastActiveDate: string | null

  // Metrics for badge conditions
  metricsCount: Record<string, number>

  // Earned badges
  earnedBadges: EarnedBadge[]

  // Daily progress
  dailyProgress: DailyProgress[]

  // Pending rewards (for notifications)
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

  // Computed getters
  getLevel: () => number
  getLevelTitle: () => string
  getXPForCurrentLevel: () => number
  getXPForNextLevel: () => number
  getXPProgress: () => { current: number; needed: number; percentage: number }
  getBadgesByCategory: (category: BadgeCategory) => { badge: BadgeDefinition; earned: boolean; earnedAt?: string }[]
  getUnlockedBadges: () => BadgeDefinition[]
  getNextBadges: () => BadgeDefinition[]
  getStreakInfo: () => { current: number; longest: number; isActive: boolean }
}

// ============================================================================
// STORE
// ============================================================================

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

      addXP: (amount, reason) => {
        set((state) => {
          const newTotalXP = state.totalXP + amount

          // Calculate new level
          let newLevel = 1
          for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
            if (newTotalXP >= LEVEL_THRESHOLDS[i]) {
              newLevel = i + 1
              break
            }
          }

          // Check for level up
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
            // First time user
            return {
              currentStreak: 1,
              longestStreak: Math.max(1, s.longestStreak),
              lastActiveDate: today,
            }
          }

          if (lastActive === today) {
            // Already logged today
            return s
          }

          const lastDate = new Date(lastActive)
          const todayDate = new Date(today)
          const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

          if (diffDays === 1) {
            // Consecutive day - extend streak
            const newStreak = s.currentStreak + 1
            return {
              currentStreak: newStreak,
              longestStreak: Math.max(newStreak, s.longestStreak),
              lastActiveDate: today,
            }
          } else if (diffDays > 1) {
            // Streak broken
            return {
              currentStreak: 1,
              lastActiveDate: today,
            }
          }

          return s
        })

        // Check for streak badges
        get().checkBadges()
      },

      incrementMetric: (metric, amount = 1) => {
        set((state) => ({
          metricsCount: {
            ...state.metricsCount,
            [metric]: (state.metricsCount[metric] || 0) + amount,
          },
        }))

        // Check for new badges
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
          // Skip if already earned
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
              if (condition.metric) {
                earned = (state.metricsCount[condition.metric] || 0) >= condition.target
              }
              break
            case 'milestone':
              if (condition.metric) {
                earned = (state.metricsCount[condition.metric] || 0) >= condition.target
              }
              break
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

          // Award XP for each new badge
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
            return { dailyProgress: [...state.dailyProgress.slice(-30), updatedProgress] } // Keep last 30 days
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

      getXPForCurrentLevel: () => {
        const level = get().currentLevel
        return LEVEL_THRESHOLDS[level - 1] || 0
      },

      getXPForNextLevel: () => {
        const level = get().currentLevel
        return LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]
      },

      getXPProgress: () => {
        const state = get()
        const currentLevelXP = state.getXPForCurrentLevel()
        const nextLevelXP = state.getXPForNextLevel()
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
          .slice(0, 3) // Show next 3 badges to earn
      },

      getStreakInfo: () => {
        const state = get()
        const today = getTodayString()
        const isActive = state.lastActiveDate === today ||
          (state.lastActiveDate &&
           Math.floor((new Date(today).getTime() - new Date(state.lastActiveDate).getTime()) / (1000 * 60 * 60 * 24)) <= 1)

        return {
          current: state.currentStreak,
          longest: state.longestStreak,
          isActive: isActive ?? false,
        }
      },
    }),
    {
      name: 'presence-gamification',
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
