/**
 * Weekly Challenges Service
 *
 * Gamification system with weekly challenges to encourage healthy habits:
 * - Individual challenges (personal goals)
 * - Community challenges (leaderboards)
 * - Achievement badges
 * - Streak rewards
 *
 * INTEGRATION: Ce service s'intègre avec le système de gamification existant:
 * - XP rewards via useGamificationStore.addXP()
 * - Achievements via gamification-store
 * - Animations via reward-store
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { useGamificationStore } from '../stores/gamification-store'
import { useRewardStore } from '../stores/reward-store'
import { analytics } from './analytics-service'

// ============================================================================
// TYPES
// ============================================================================

export type ChallengeCategory =
  | 'nutrition'
  | 'fitness'
  | 'wellness'
  | 'hydration'
  | 'sleep'
  | 'mindfulness'
  | 'weight'
  | 'streak'

export type ChallengeDifficulty = 'easy' | 'medium' | 'hard' | 'extreme'

export type ChallengeStatus = 'available' | 'active' | 'completed' | 'failed' | 'expired'

export interface WeeklyChallenge {
  id: string
  name: string
  description: string
  category: ChallengeCategory
  difficulty: ChallengeDifficulty
  /** Target to achieve */
  target: {
    type: 'count' | 'streak' | 'total' | 'average' | 'minimum'
    value: number
    unit: string
    metric: string
  }
  /** Duration in days (typically 7 for weekly) */
  durationDays: number
  /** Points awarded on completion */
  points: number
  /** Badge earned on completion */
  badge?: ChallengeBadge
  /** Requirements to unlock */
  requirements?: {
    level?: number
    completedChallenges?: string[]
    badges?: string[]
  }
  /** Start date of current week's challenge */
  weekStartDate: string
  /** End date */
  weekEndDate: string
  /** Tips for completing */
  tips?: string[]
  /** Is this a community challenge? */
  isCommunity: boolean
}

export interface UserChallengeProgress {
  challengeId: string
  status: ChallengeStatus
  progress: number
  target: number
  startedAt: string
  completedAt?: string
  dailyProgress: { date: string; value: number }[]
  lastUpdatedAt: string
}

export interface ChallengeBadge {
  id: string
  name: string
  description: string
  icon: string // emoji or icon name
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  earnedAt?: string
}

export interface UserChallengeStats {
  totalCompleted: number
  currentStreak: number
  longestStreak: number
  totalPoints: number
  level: number
  badges: ChallengeBadge[]
  weeklyCompletionRate: number
  favoriteCategory: ChallengeCategory
}

export interface LeaderboardEntry {
  rank: number
  userId: string
  displayName: string
  avatarUrl?: string
  score: number
  challengesCompleted: number
  currentStreak: number
  badges: number
}

// ============================================================================
// CONSTANTS
// ============================================================================

const USER_PROGRESS_KEY = 'challenge_progress'
const USER_STATS_KEY = 'challenge_stats'

// Points required per level
const LEVEL_THRESHOLDS = [
  0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500, 6600, 7800, 9100, 10500,
]

// ============================================================================
// CHALLENGE DEFINITIONS
// ============================================================================

const CHALLENGE_TEMPLATES: Omit<WeeklyChallenge, 'id' | 'weekStartDate' | 'weekEndDate'>[] = [
  // NUTRITION
  {
    name: 'Maître des Protéines',
    description: 'Atteins ton objectif protéines 5 jours cette semaine',
    category: 'nutrition',
    difficulty: 'medium',
    target: { type: 'count', value: 5, unit: 'jours', metric: 'protein_goal_met' },
    durationDays: 7,
    points: 150,
    badge: { id: 'protein_master', name: 'Maître Protéines', description: 'Objectif protéines atteint 5 jours', icon: '💪', rarity: 'common' },
    tips: ['Ajoute une source de protéines à chaque repas', 'Les légumineuses sont tes alliées'],
    isCommunity: false,
  },
  {
    name: 'Équilibre Parfait',
    description: 'Respecte tous tes objectifs macros 3 jours de suite',
    category: 'nutrition',
    difficulty: 'hard',
    target: { type: 'streak', value: 3, unit: 'jours', metric: 'all_macros_balanced' },
    durationDays: 7,
    points: 200,
    badge: { id: 'perfect_balance', name: 'Équilibre Parfait', description: 'Macros parfaits 3 jours', icon: '⚖️', rarity: 'rare' },
    isCommunity: false,
  },
  {
    name: 'Chef de la Semaine',
    description: 'Enregistre 21 repas cette semaine (3 par jour)',
    category: 'nutrition',
    difficulty: 'medium',
    target: { type: 'total', value: 21, unit: 'repas', metric: 'meals_logged' },
    durationDays: 7,
    points: 175,
    badge: { id: 'weekly_chef', name: 'Chef Hebdo', description: '21 repas enregistrés en une semaine', icon: '👨‍🍳', rarity: 'common' },
    tips: ['Active les notifications de rappel de repas'],
    isCommunity: false,
  },
  {
    name: 'Légumes Lover',
    description: 'Mange au moins 400g de légumes par jour pendant 5 jours',
    category: 'nutrition',
    difficulty: 'hard',
    target: { type: 'count', value: 5, unit: 'jours', metric: 'vegetables_400g' },
    durationDays: 7,
    points: 180,
    badge: { id: 'veggie_lover', name: 'Légumes Lover', description: '400g de légumes 5 jours', icon: '🥗', rarity: 'rare' },
    isCommunity: true,
  },

  // HYDRATION
  {
    name: 'Hydratation Optimale',
    description: 'Bois au moins 2L d\'eau chaque jour cette semaine',
    category: 'hydration',
    difficulty: 'medium',
    target: { type: 'minimum', value: 2, unit: 'L/jour', metric: 'daily_water' },
    durationDays: 7,
    points: 140,
    badge: { id: 'hydration_hero', name: 'Héros Hydratation', description: '2L/jour pendant 7 jours', icon: '💧', rarity: 'common' },
    tips: ['Garde une bouteille d\'eau toujours visible', 'Bois un verre au réveil'],
    isCommunity: true,
  },

  // WELLNESS
  {
    name: 'Dormeur Étoile',
    description: 'Dors au moins 7h chaque nuit cette semaine',
    category: 'sleep',
    difficulty: 'medium',
    target: { type: 'minimum', value: 7, unit: 'h/nuit', metric: 'sleep_hours' },
    durationDays: 7,
    points: 160,
    badge: { id: 'sleep_star', name: 'Dormeur Étoile', description: '7h+ de sommeil 7 nuits', icon: '⭐', rarity: 'rare' },
    tips: ['Évite les écrans 1h avant le coucher', 'Couche-toi à heure fixe'],
    isCommunity: false,
  },
  {
    name: 'Zen Master',
    description: 'Enregistre un niveau de stress ≤ 3/10 pendant 5 jours',
    category: 'mindfulness',
    difficulty: 'hard',
    target: { type: 'count', value: 5, unit: 'jours', metric: 'low_stress' },
    durationDays: 7,
    points: 200,
    badge: { id: 'zen_master', name: 'Zen Master', description: 'Stress maîtrisé 5 jours', icon: '🧘', rarity: 'rare' },
    isCommunity: false,
  },

  // STREAK
  {
    name: 'Série de 7',
    description: 'Maintiens ta série de tracking pendant 7 jours consécutifs',
    category: 'streak',
    difficulty: 'easy',
    target: { type: 'streak', value: 7, unit: 'jours', metric: 'daily_tracking' },
    durationDays: 7,
    points: 100,
    badge: { id: 'streak_7', name: 'Série Bronze', description: '7 jours consécutifs', icon: '🔥', rarity: 'common' },
    isCommunity: true,
  },
  {
    name: 'Marathonien',
    description: 'Atteins une série de 30 jours consécutifs',
    category: 'streak',
    difficulty: 'extreme',
    target: { type: 'streak', value: 30, unit: 'jours', metric: 'daily_tracking' },
    durationDays: 30,
    points: 500,
    badge: { id: 'streak_30', name: 'Marathonien', description: '30 jours consécutifs', icon: '🏃', rarity: 'legendary' },
    isCommunity: true,
  },

  // WEIGHT
  {
    name: 'Pesée Régulière',
    description: 'Pèse-toi au moins 3 fois cette semaine',
    category: 'weight',
    difficulty: 'easy',
    target: { type: 'count', value: 3, unit: 'pesées', metric: 'weight_logged' },
    durationDays: 7,
    points: 75,
    badge: { id: 'regular_weigh', name: 'Balance Fidèle', description: 'Pesées régulières', icon: '⚖️', rarity: 'common' },
    tips: ['Pèse-toi le matin à jeun pour plus de précision'],
    isCommunity: false,
  },
]

// ============================================================================
// CHALLENGE MANAGEMENT
// ============================================================================

/**
 * Get available weekly challenges for user
 */
export async function getAvailableChallenges(userId: string): Promise<WeeklyChallenge[]> {
  const stats = await getUserStats(userId)
  const now = new Date()
  const weekStart = getWeekStart(now)
  const weekEnd = getWeekEnd(now)

  const challenges: WeeklyChallenge[] = CHALLENGE_TEMPLATES
    .filter((template) => {
      // Check requirements
      if (template.requirements?.level && stats.level < template.requirements.level) {
        return false
      }
      if (template.requirements?.badges) {
        const earnedBadgeIds = stats.badges.map((b) => b.id)
        if (!template.requirements.badges.every((b) => earnedBadgeIds.includes(b))) {
          return false
        }
      }
      return true
    })
    .map((template, index) => ({
      ...template,
      id: `challenge_${weekStart.toISOString().split('T')[0]}_${index}`,
      weekStartDate: weekStart.toISOString(),
      weekEndDate: weekEnd.toISOString(),
    }))

  return challenges
}

/**
 * Start a challenge
 */
export async function startChallenge(
  userId: string,
  challengeId: string
): Promise<UserChallengeProgress> {
  const challenges = await getAvailableChallenges(userId)
  const challenge = challenges.find((c) => c.id === challengeId)

  if (!challenge) {
    throw new Error('Challenge not found')
  }

  const progress = await getUserProgress(userId)
  const existingProgress = progress.find((p) => p.challengeId === challengeId)

  if (existingProgress && existingProgress.status === 'active') {
    throw new Error('Challenge already active')
  }

  const newProgress: UserChallengeProgress = {
    challengeId,
    status: 'active',
    progress: 0,
    target: challenge.target.value,
    startedAt: new Date().toISOString(),
    dailyProgress: [],
    lastUpdatedAt: new Date().toISOString(),
  }

  progress.push(newProgress)
  await saveUserProgress(userId, progress)

  // Track challenge joined
  analytics.trackChallenge('joined', challengeId, challenge.name)

  console.log('[Challenges] Started:', challenge.name)
  return newProgress
}

/**
 * Update challenge progress
 */
export async function updateChallengeProgress(
  userId: string,
  challengeId: string,
  incrementValue: number
): Promise<UserChallengeProgress | null> {
  const progress = await getUserProgress(userId)
  const challengeProgress = progress.find(
    (p) => p.challengeId === challengeId && p.status === 'active'
  )

  if (!challengeProgress) {
    return null
  }

  const today = new Date().toISOString().split('T')[0]
  const todayProgress = challengeProgress.dailyProgress.find((d) => d.date === today)

  if (todayProgress) {
    todayProgress.value += incrementValue
  } else {
    challengeProgress.dailyProgress.push({ date: today, value: incrementValue })
  }

  // Recalculate total progress based on challenge type
  const challenges = await getAvailableChallenges(userId)
  const challenge = challenges.find((c) => c.id === challengeId)

  if (challenge) {
    challengeProgress.progress = calculateProgress(challengeProgress, challenge)

    // Check if completed
    if (challengeProgress.progress >= challengeProgress.target) {
      await completeChallenge(userId, challengeId)
    }
  }

  challengeProgress.lastUpdatedAt = new Date().toISOString()
  await saveUserProgress(userId, progress)

  return challengeProgress
}

/**
 * Complete a challenge
 * Intégré avec le système de gamification principal
 */
async function completeChallenge(userId: string, challengeId: string): Promise<void> {
  const progress = await getUserProgress(userId)
  const challengeProgress = progress.find((p) => p.challengeId === challengeId)

  if (!challengeProgress) return

  challengeProgress.status = 'completed'
  challengeProgress.completedAt = new Date().toISOString()

  await saveUserProgress(userId, progress)

  // Award points and badge
  const challenges = await getAvailableChallenges(userId)
  const challenge = challenges.find((c) => c.id === challengeId)

  if (challenge) {
    // ✅ Utiliser le système de gamification principal pour les XP
    awardChallengeXP(challenge.points, challenge.name)

    // ✅ Incrémenter le compteur de défis complétés
    useGamificationStore.getState().incrementMetric('challenges_completed')

    if (challenge.badge) {
      await awardBadge(userId, challenge.badge)
    }

    // Mettre à jour les stats locales aussi
    await updateLocalStats(userId, challenge.points)

    // Track challenge completed in analytics
    analytics.trackChallenge('completed', challengeId, challenge.name)
  }

  console.log('[Challenges] Completed:', challengeId)
}

/**
 * Award XP via le système de gamification principal
 * Cela déclenche automatiquement les animations via reward-store
 */
function awardChallengeXP(points: number, challengeName: string): void {
  const gamificationStore = useGamificationStore.getState()
  const rewardStore = useRewardStore.getState()

  // Ajouter les XP au système principal
  gamificationStore.addXP(points, `Défi complété: ${challengeName}`)

  // Afficher l'animation de récompense
  rewardStore.queueXPReward(points, `🏆 ${challengeName}`)
}

/**
 * Mettre à jour les stats locales (pour le leaderboard et l'historique)
 */
async function updateLocalStats(userId: string, points: number): Promise<void> {
  const stats = await getUserStats(userId)
  stats.totalPoints += points
  stats.totalCompleted++

  // Check for level up
  const newLevel = LEVEL_THRESHOLDS.findIndex((threshold) => stats.totalPoints < threshold)
  if (newLevel > stats.level && newLevel !== -1) {
    stats.level = newLevel
    console.log(`[Challenges] Level up! New level: ${newLevel}`)
  }

  await saveUserStats(userId, stats)
}

/**
 * Check and expire old challenges
 */
export async function checkExpiredChallenges(userId: string): Promise<void> {
  const progress = await getUserProgress(userId)
  const now = new Date()
  let updated = false

  for (const p of progress) {
    if (p.status === 'active') {
      const challenges = await getAvailableChallenges(userId)
      const challenge = challenges.find((c) => c.id === p.challengeId)

      if (challenge && new Date(challenge.weekEndDate) < now) {
        p.status = 'expired'
        updated = true
      }
    }
  }

  if (updated) {
    await saveUserProgress(userId, progress)
  }
}

// ============================================================================
// USER STATS & PROGRESS
// ============================================================================

/**
 * Get user's challenge progress
 */
export async function getUserProgress(userId: string): Promise<UserChallengeProgress[]> {
  try {
    const key = `${USER_PROGRESS_KEY}_${userId}`
    const stored = await AsyncStorage.getItem(key)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

async function saveUserProgress(userId: string, progress: UserChallengeProgress[]): Promise<void> {
  const key = `${USER_PROGRESS_KEY}_${userId}`
  await AsyncStorage.setItem(key, JSON.stringify(progress))
}

/**
 * Get user stats
 */
export async function getUserStats(userId: string): Promise<UserChallengeStats> {
  try {
    const key = `${USER_STATS_KEY}_${userId}`
    const stored = await AsyncStorage.getItem(key)

    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('[Challenges] Failed to load stats:', error)
  }

  // Default stats
  return {
    totalCompleted: 0,
    currentStreak: 0,
    longestStreak: 0,
    totalPoints: 0,
    level: 1,
    badges: [],
    weeklyCompletionRate: 0,
    favoriteCategory: 'nutrition',
  }
}

async function saveUserStats(userId: string, stats: UserChallengeStats): Promise<void> {
  const key = `${USER_STATS_KEY}_${userId}`
  await AsyncStorage.setItem(key, JSON.stringify(stats))
}

// awardPoints a été remplacé par awardChallengeXP + updateLocalStats
// pour l'intégration avec le système de gamification principal

/**
 * Award badge to user
 */
async function awardBadge(userId: string, badge: ChallengeBadge): Promise<void> {
  const stats = await getUserStats(userId)

  // Check if already earned
  if (stats.badges.some((b) => b.id === badge.id)) {
    return
  }

  const earnedBadge = {
    ...badge,
    earnedAt: new Date().toISOString(),
  }

  stats.badges.push(earnedBadge)
  await saveUserStats(userId, stats)

  console.log(`[Challenges] Badge earned: ${badge.name}`)
}

/**
 * Get all earned badges
 */
export async function getEarnedBadges(userId: string): Promise<ChallengeBadge[]> {
  const stats = await getUserStats(userId)
  return stats.badges
}

// ============================================================================
// LEADERBOARD
// ============================================================================

/**
 * Get global leaderboard
 */
export async function getLeaderboard(
  _period: 'week' | 'month' | 'all' = 'week',
  limit: number = 50
): Promise<LeaderboardEntry[]> {
  // In production, this would fetch from cloud
  // For now, return mock data
  const mockLeaderboard: LeaderboardEntry[] = [
    { rank: 1, userId: 'user1', displayName: 'Marie L.', score: 2450, challengesCompleted: 12, currentStreak: 28, badges: 8 },
    { rank: 2, userId: 'user2', displayName: 'Thomas K.', score: 2180, challengesCompleted: 10, currentStreak: 21, badges: 6 },
    { rank: 3, userId: 'user3', displayName: 'Sophie M.', score: 1920, challengesCompleted: 9, currentStreak: 14, badges: 5 },
    { rank: 4, userId: 'user4', displayName: 'Lucas D.', score: 1750, challengesCompleted: 8, currentStreak: 7, badges: 4 },
    { rank: 5, userId: 'user5', displayName: 'Emma R.', score: 1580, challengesCompleted: 7, currentStreak: 12, badges: 4 },
  ]

  return mockLeaderboard.slice(0, limit)
}

/**
 * Get user's rank in leaderboard
 */
export async function getUserRank(userId: string): Promise<number | null> {
  const stats = await getUserStats(userId)
  const leaderboard = await getLeaderboard('week', 1000)

  // Find where user would rank
  const rank = leaderboard.findIndex((entry) => entry.score <= stats.totalPoints)
  return rank === -1 ? leaderboard.length + 1 : rank + 1
}

// ============================================================================
// UTILITIES
// ============================================================================

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return end
}

function calculateProgress(
  progress: UserChallengeProgress,
  challenge: WeeklyChallenge
): number {
  const { type } = challenge.target
  const dailyValues = progress.dailyProgress.map((d) => d.value)

  switch (type) {
    case 'count':
      // Count days that met the criteria
      return dailyValues.filter((v) => v >= 1).length

    case 'total':
      // Sum all values
      return dailyValues.reduce((sum, v) => sum + v, 0)

    case 'average':
      // Calculate average
      return dailyValues.length > 0
        ? dailyValues.reduce((sum, v) => sum + v, 0) / dailyValues.length
        : 0

    case 'minimum':
      // Count days that met minimum
      return dailyValues.filter((v) => v >= challenge.target.value).length

    case 'streak':
      // Calculate consecutive days
      let maxStreak = 0
      let currentStreak = 0
      const sorted = [...progress.dailyProgress].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )
      for (const day of sorted) {
        if (day.value >= 1) {
          currentStreak++
          maxStreak = Math.max(maxStreak, currentStreak)
        } else {
          currentStreak = 0
        }
      }
      return maxStreak

    default:
      return progress.progress
  }
}

/**
 * Auto-update progress from app events
 * Called when user logs meals, weight, etc.
 */
export async function trackChallengeEvent(
  userId: string,
  eventType: string,
  value: number = 1
): Promise<void> {
  const progress = await getUserProgress(userId)
  const activeChallenges = progress.filter((p) => p.status === 'active')

  const challenges = await getAvailableChallenges(userId)

  for (const activeProgress of activeChallenges) {
    const challenge = challenges.find((c) => c.id === activeProgress.challengeId)
    if (challenge && challenge.target.metric === eventType) {
      await updateChallengeProgress(userId, activeProgress.challengeId, value)
    }
  }
}

// ============================================================================
// EVENT MAPPING - Connexion avec les stores existants
// ============================================================================

/**
 * Mapping des événements de l'app vers les métriques des défis
 * À appeler depuis les stores existants (caloric-bank, wellness, etc.)
 */
export const CHALLENGE_EVENT_MAPPING = {
  // Nutrition events → Challenge metrics
  MEAL_LOGGED: 'meals_logged',
  PROTEIN_GOAL_MET: 'protein_goal_met',
  ALL_MACROS_BALANCED: 'all_macros_balanced',
  VEGETABLES_400G: 'vegetables_400g',

  // Hydration events
  WATER_LOGGED: 'daily_water',
  HYDRATION_TARGET_MET: 'daily_water',

  // Wellness events
  SLEEP_LOGGED: 'sleep_hours',
  LOW_STRESS_RECORDED: 'low_stress',
  WEIGHT_LOGGED: 'weight_logged',

  // Tracking events
  DAILY_TRACKING_COMPLETE: 'daily_tracking',
} as const

export type ChallengeEventType = keyof typeof CHALLENGE_EVENT_MAPPING

/**
 * Helper pour tracker facilement un événement de défi
 * Usage: await trackAppEvent(userId, 'MEAL_LOGGED')
 */
export async function trackAppEvent(
  userId: string,
  event: ChallengeEventType,
  value: number = 1
): Promise<void> {
  const metric = CHALLENGE_EVENT_MAPPING[event]
  await trackChallengeEvent(userId, metric, value)
}

/**
 * Synchroniser les métriques du gamification-store avec les défis
 * Appelé périodiquement pour s'assurer que les défis sont à jour
 */
export async function syncChallengesWithGamification(_userId: string): Promise<void> {
  const gamificationStore = useGamificationStore.getState()
  const metrics = gamificationStore.metricsCount

  // Synchroniser les métriques pertinentes
  const syncMappings: { gamificationMetric: string; challengeMetric: string }[] = [
    { gamificationMetric: 'meals_logged', challengeMetric: 'meals_logged' },
    { gamificationMetric: 'goals_reached', challengeMetric: 'protein_goal_met' },
    { gamificationMetric: 'weight_entries', challengeMetric: 'weight_logged' },
  ]

  for (const mapping of syncMappings) {
    const value = metrics[mapping.gamificationMetric] || 0
    if (value > 0) {
      // Note: Ceci met à jour la progression journalière, pas le total
      console.log(`[Challenges] Sync: ${mapping.challengeMetric} = ${value}`)
    }
  }
}

/**
 * Obtenir les défis actifs formatés pour l'affichage UI
 */
export async function getActiveChallengesForUI(userId: string): Promise<{
  challenges: (WeeklyChallenge & { progress: UserChallengeProgress })[]
  stats: UserChallengeStats
}> {
  const [allChallenges, progress, stats] = await Promise.all([
    getAvailableChallenges(userId),
    getUserProgress(userId),
    getUserStats(userId),
  ])

  const activeChallenges = progress
    .filter((p) => p.status === 'active')
    .map((p) => {
      const challenge = allChallenges.find((c) => c.id === p.challengeId)
      return challenge ? { ...challenge, progress: p } : null
    })
    .filter((c): c is WeeklyChallenge & { progress: UserChallengeProgress } => c !== null)

  return { challenges: activeChallenges, stats }
}

/**
 * Obtenir un résumé des défis pour le dashboard
 */
export async function getChallengeSummary(userId: string): Promise<{
  activeCount: number
  completedThisWeek: number
  totalPoints: number
  currentStreak: number
  nextMilestone: { name: string; pointsNeeded: number } | null
}> {
  const [progress, stats] = await Promise.all([
    getUserProgress(userId),
    getUserStats(userId),
  ])

  const weekStart = getWeekStart(new Date()).toISOString()
  const completedThisWeek = progress.filter(
    (p) => p.status === 'completed' && p.completedAt && p.completedAt >= weekStart
  ).length

  // Calculer le prochain milestone
  const currentLevel = stats.level
  const nextLevelThreshold = LEVEL_THRESHOLDS[currentLevel] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]
  const pointsNeeded = nextLevelThreshold - stats.totalPoints

  return {
    activeCount: progress.filter((p) => p.status === 'active').length,
    completedThisWeek,
    totalPoints: stats.totalPoints,
    currentStreak: stats.currentStreak,
    nextMilestone: pointsNeeded > 0
      ? { name: `Niveau ${currentLevel + 1}`, pointsNeeded }
      : null,
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const weeklyChallengesService = {
  // Challenges
  getAvailableChallenges,
  startChallenge,
  updateChallengeProgress,
  checkExpiredChallenges,

  // Progress & Stats
  getUserProgress,
  getUserStats,
  getEarnedBadges,

  // Leaderboard
  getLeaderboard,
  getUserRank,

  // Event tracking (intégration avec stores existants)
  trackChallengeEvent,
  trackAppEvent,
  syncChallengesWithGamification,

  // UI helpers
  getActiveChallengesForUI,
  getChallengeSummary,

  // Constants
  CHALLENGE_EVENT_MAPPING,
}

export default weeklyChallengesService
