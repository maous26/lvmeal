'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Flame, Zap, Award, ChevronRight, Star, Target, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGamificationStore, BADGES, LEVEL_TITLES, type BadgeCategory } from '@/stores/gamification-store'
import { StreakBadge, XPDisplay, AchievementBadge } from './streak-badge'

// ============================================================================
// GAMIFICATION PANEL - Main dashboard widget
// ============================================================================

interface GamificationPanelProps {
  compact?: boolean
  className?: string
  onViewAll?: () => void
}

export function GamificationPanel({ compact = false, className, onViewAll }: GamificationPanelProps) {
  const {
    currentLevel,
    totalXP,
    currentStreak,
    getXPProgress,
    getLevelTitle,
    getStreakInfo,
    getUnlockedBadges,
    getNextBadges,
  } = useGamificationStore()

  const xpProgress = getXPProgress()
  const streakInfo = getStreakInfo()
  const unlockedBadges = getUnlockedBadges()
  const nextBadges = getNextBadges()

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'bg-[var(--bg-secondary)] rounded-2xl p-4 shadow-sm',
          className
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StreakBadge days={streakInfo.current} isActive={streakInfo.isActive} size="sm" />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--info)] text-white">
              <Zap className="h-4 w-4" />
              <span className="text-sm font-bold">Nv.{currentLevel}</span>
            </div>
          </div>
          <button
            onClick={onViewAll}
            className="flex items-center gap-1 text-sm text-[var(--accent-primary)] hover:underline"
          >
            Voir tout
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-[var(--bg-secondary)] rounded-2xl p-5 shadow-sm',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
          Progression
        </h3>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="flex items-center gap-1 text-sm text-[var(--accent-primary)] hover:underline"
          >
            Tout voir
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Main Stats Row */}
      <div className="flex items-center gap-4 mb-5">
        <StreakBadge days={streakInfo.current} isActive={streakInfo.isActive} />
        <div className="flex-1">
          <XPDisplay
            current={totalXP}
            level={currentLevel}
            toNextLevel={xpProgress.needed - xpProgress.current}
          />
        </div>
      </div>

      {/* Level Title */}
      <div className="flex items-center justify-between mb-4 p-3 rounded-xl bg-gradient-to-r from-[var(--accent-light)]/20 to-transparent">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-[var(--accent-primary)]" />
          <span className="font-medium text-[var(--text-primary)]">
            {getLevelTitle()}
          </span>
        </div>
        <span className="text-sm text-[var(--text-tertiary)]">
          {totalXP.toLocaleString()} XP total
        </span>
      </div>

      {/* Badges Section */}
      {unlockedBadges.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
            Badges débloqués ({unlockedBadges.length})
          </h4>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {unlockedBadges.slice(0, 5).map((badge) => (
              <motion.div
                key={badge.id}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-full bg-gradient-to-r from-yellow-400/20 to-orange-400/20 border border-yellow-400/30"
              >
                <span className="text-lg">{badge.icon}</span>
                <span className="text-xs font-medium text-[var(--text-primary)] whitespace-nowrap">
                  {badge.name}
                </span>
              </motion.div>
            ))}
            {unlockedBadges.length > 5 && (
              <div className="flex-shrink-0 flex items-center px-3 py-2 rounded-full bg-[var(--bg-tertiary)]">
                <span className="text-xs text-[var(--text-tertiary)]">
                  +{unlockedBadges.length - 5}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Next Badges to Earn */}
      {nextBadges.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
            Prochains objectifs
          </h4>
          <div className="space-y-2">
            {nextBadges.map((badge) => (
              <div
                key={badge.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-tertiary)]/50"
              >
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-[var(--bg-tertiary)]">
                  <span className="text-lg opacity-50">{badge.icon}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {badge.name}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {badge.description}
                  </p>
                </div>
                <div className="text-xs font-medium text-[var(--accent-primary)]">
                  +{badge.xpReward} XP
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ============================================================================
// BADGES GRID - Full badges display
// ============================================================================

interface BadgesGridProps {
  category?: BadgeCategory
  className?: string
}

export function BadgesGrid({ category, className }: BadgesGridProps) {
  const { getBadgesByCategory, earnedBadges } = useGamificationStore()

  const categories: BadgeCategory[] = category
    ? [category]
    : ['streak', 'nutrition', 'planning', 'milestone', 'special']

  const categoryLabels: Record<BadgeCategory, string> = {
    streak: 'Séries',
    nutrition: 'Nutrition',
    planning: 'Planification',
    milestone: 'Jalons',
    special: 'Spéciaux',
  }

  return (
    <div className={cn('space-y-6', className)}>
      {categories.map((cat) => {
        const badges = getBadgesByCategory(cat)
        const earnedCount = badges.filter((b) => b.earned).length

        return (
          <div key={cat}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                {categoryLabels[cat]}
              </h4>
              <span className="text-xs text-[var(--text-tertiary)]">
                {earnedCount}/{badges.length}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {badges.map(({ badge, earned, earnedAt }) => (
                <AchievementBadge
                  key={badge.id}
                  name={badge.name}
                  icon={<span className="text-2xl">{badge.icon}</span>}
                  earned={earned}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ============================================================================
// LEVEL PROGRESS - Detailed level display
// ============================================================================

interface LevelProgressProps {
  className?: string
}

export function LevelProgress({ className }: LevelProgressProps) {
  const { currentLevel, totalXP, getXPProgress, getLevelTitle } = useGamificationStore()
  const xpProgress = getXPProgress()

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'bg-gradient-to-br from-[var(--accent-primary)] to-[var(--info)] rounded-2xl p-6 text-white',
        className
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm opacity-80">Niveau actuel</p>
          <h2 className="text-3xl font-bold">{getLevelTitle()}</h2>
        </div>
        <div className="flex items-center justify-center h-16 w-16 rounded-full bg-white/20 backdrop-blur-sm">
          <span className="text-2xl font-bold">{currentLevel}</span>
        </div>
      </div>

      <div className="mb-2">
        <div className="flex justify-between text-sm mb-1">
          <span>Progression</span>
          <span>{Math.round(xpProgress.percentage)}%</span>
        </div>
        <div className="h-3 bg-white/20 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-white rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${xpProgress.percentage}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
      </div>

      <p className="text-sm opacity-80">
        {xpProgress.current.toLocaleString()} / {xpProgress.needed.toLocaleString()} XP pour le niveau {currentLevel + 1}
      </p>
    </motion.div>
  )
}

// ============================================================================
// STREAK CARD - Detailed streak display
// ============================================================================

interface StreakCardProps {
  className?: string
}

export function StreakCard({ className }: StreakCardProps) {
  const { getStreakInfo } = useGamificationStore()
  const streakInfo = getStreakInfo()

  const milestones = [3, 7, 14, 30, 60, 100]
  const nextMilestone = milestones.find((m) => m > streakInfo.current) || milestones[milestones.length - 1]
  const progressToNext = Math.min(100, (streakInfo.current / nextMilestone) * 100)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-6 text-white',
        className
      )}
    >
      <div className="flex items-center gap-4 mb-4">
        <motion.div
          animate={{ rotate: [0, -10, 10, -10, 0] }}
          transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
        >
          <Flame className="h-12 w-12" />
        </motion.div>
        <div>
          <p className="text-sm opacity-80">Série actuelle</p>
          <h2 className="text-4xl font-bold">{streakInfo.current} jours</h2>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span>Prochain palier: {nextMilestone} jours</span>
          <span>{streakInfo.current}/{nextMilestone}</span>
        </div>
        <div className="h-2 bg-white/20 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-white rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressToNext}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between p-3 bg-white/10 rounded-xl">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          <span className="text-sm">Record personnel</span>
        </div>
        <span className="font-bold">{streakInfo.longest} jours</span>
      </div>
    </motion.div>
  )
}

// ============================================================================
// DAILY CHALLENGES - Mini challenges widget
// ============================================================================

interface DailyChallenge {
  id: string
  title: string
  description: string
  xpReward: number
  completed: boolean
  progress: number
  target: number
}

interface DailyChallengesProps {
  challenges?: DailyChallenge[]
  className?: string
}

export function DailyChallenges({ challenges, className }: DailyChallengesProps) {
  // Default challenges if none provided
  const defaultChallenges: DailyChallenge[] = [
    {
      id: '1',
      title: 'Petit-déjeuner sain',
      description: 'Enregistrer un petit-déjeuner',
      xpReward: 15,
      completed: false,
      progress: 0,
      target: 1,
    },
    {
      id: '2',
      title: 'Hydratation',
      description: 'Boire 2L d\'eau',
      xpReward: 25,
      completed: false,
      progress: 1.2,
      target: 2,
    },
    {
      id: '3',
      title: 'Protéines',
      description: 'Atteindre 100% des protéines',
      xpReward: 20,
      completed: false,
      progress: 75,
      target: 100,
    },
  ]

  const items = challenges || defaultChallenges

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-[var(--bg-secondary)] rounded-2xl p-5 shadow-sm',
        className
      )}
    >
      <div className="flex items-center gap-2 mb-4">
        <Target className="h-5 w-5 text-[var(--accent-primary)]" />
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
          Défis du jour
        </h3>
      </div>

      <div className="space-y-3">
        {items.map((challenge) => {
          const progressPercent = Math.min(100, (challenge.progress / challenge.target) * 100)

          return (
            <motion.div
              key={challenge.id}
              className={cn(
                'p-3 rounded-xl transition-colors',
                challenge.completed
                  ? 'bg-green-500/10 border border-green-500/20'
                  : 'bg-[var(--bg-tertiary)]'
              )}
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {challenge.completed ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center"
                    >
                      <span className="text-white text-xs">✓</span>
                    </motion.div>
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-[var(--text-tertiary)]" />
                  )}
                  <span className={cn(
                    'text-sm font-medium',
                    challenge.completed
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-[var(--text-primary)]'
                  )}>
                    {challenge.title}
                  </span>
                </div>
                <span className="text-xs font-medium text-[var(--accent-primary)]">
                  +{challenge.xpReward} XP
                </span>
              </div>

              {!challenge.completed && (
                <div className="ml-7">
                  <div className="h-1.5 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-[var(--accent-primary)] rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}

// ============================================================================
// REWARD TOAST - Notification for rewards
// ============================================================================

interface RewardToastProps {
  type: 'xp' | 'badge' | 'level_up'
  amount?: number
  badgeName?: string
  badgeIcon?: string
  newLevel?: number
  onClose: () => void
}

export function RewardToast({ type, amount, badgeName, badgeIcon, newLevel, onClose }: RewardToastProps) {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      className={cn(
        'fixed bottom-24 left-1/2 -translate-x-1/2 z-50',
        'px-6 py-4 rounded-2xl shadow-2xl',
        'flex items-center gap-4',
        type === 'level_up'
          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
          : type === 'badge'
            ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white'
            : 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--info)] text-white'
      )}
    >
      {type === 'xp' && (
        <>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, ease: 'linear' }}
          >
            <Zap className="h-8 w-8" />
          </motion.div>
          <div>
            <p className="text-sm opacity-80">XP gagné</p>
            <p className="text-2xl font-bold">+{amount}</p>
          </div>
        </>
      )}

      {type === 'badge' && (
        <>
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.5, repeat: 2 }}
            className="text-4xl"
          >
            {badgeIcon || '🏆'}
          </motion.div>
          <div>
            <p className="text-sm opacity-80">Badge débloqué !</p>
            <p className="text-xl font-bold">{badgeName}</p>
          </div>
        </>
      )}

      {type === 'level_up' && (
        <>
          <motion.div
            animate={{ scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] }}
            transition={{ duration: 0.6, repeat: 2 }}
          >
            <Star className="h-10 w-10" />
          </motion.div>
          <div>
            <p className="text-sm opacity-80">Niveau supérieur !</p>
            <p className="text-2xl font-bold">Niveau {newLevel}</p>
            <p className="text-sm opacity-80">{LEVEL_TITLES[newLevel || 1]}</p>
          </div>
        </>
      )}
    </motion.div>
  )
}

// ============================================================================
// REWARDS MANAGER - Handles displaying pending rewards
// ============================================================================

export function RewardsManager() {
  const { pendingRewards, consumeReward } = useGamificationStore()
  const [currentReward, setCurrentReward] = React.useState<typeof pendingRewards[0] | null>(null)

  React.useEffect(() => {
    if (!currentReward && pendingRewards.length > 0) {
      setCurrentReward(pendingRewards[0])
    }
  }, [pendingRewards, currentReward])

  const handleClose = React.useCallback(() => {
    if (currentReward) {
      consumeReward(currentReward.id)
      setCurrentReward(null)
    }
  }, [currentReward, consumeReward])

  if (!currentReward) return null

  const badge = currentReward.type === 'badge'
    ? BADGES.find((b) => b.id === currentReward.badgeId)
    : null

  return (
    <AnimatePresence>
      <RewardToast
        type={currentReward.type}
        amount={currentReward.amount}
        badgeName={badge?.name}
        badgeIcon={badge?.icon}
        newLevel={currentReward.newLevel}
        onClose={handleClose}
      />
    </AnimatePresence>
  )
}
