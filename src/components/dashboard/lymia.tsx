'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Heart, TrendingUp, Moon, Droplets, Activity, ChevronRight, Scale, Utensils, Target, Flame, Award } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useUserStore } from '@/stores/user-store'
import { useWellnessStore } from '@/stores/wellness-store'
import { useMealsStore } from '@/stores/meals-store'
import { useGamificationStore } from '@/stores/gamification-store'
import { useSportProgramStore } from '@/stores/sport-program-store'
import { useCaloricBankStore } from '@/stores/caloric-bank-store'
import { cn } from '@/lib/utils'

interface LymiaProps {
  className?: string
}

interface CoachMessage {
  id: string
  type: 'encouragement' | 'tip' | 'warning' | 'celebration' | 'adaptive' | 'nutrition' | 'sport'
  icon: React.ReactNode
  title: string
  message: string
  action?: {
    label: string
    onClick: () => void
  }
  priority: number // Higher = more important
}

// Messages specifiques pour le metabolisme adaptatif (bienveillants)
const ADAPTIVE_MESSAGES = {
  welcome: {
    title: 'Bienvenue dans ton espace bienveillant',
    message: 'On va prendre soin de toi en douceur. Ton corps est intelligent, on va l\'accompagner pas a pas.',
  },
  patience: {
    title: 'La patience est ta meilleure alliee',
    message: 'Les changements durables prennent du temps. Chaque petit pas compte, meme les plus petits.',
  },
  maintenance: {
    title: 'Phase de stabilisation',
    message: 'On consolide tes acquis avant d\'aller plus loin. C\'est la cle pour des resultats durables.',
  },
  protein: {
    title: 'Priorite aux proteines',
    message: 'Les proteines t\'aident a maintenir ta masse musculaire et a relancer ton metabolisme.',
  },
  sleep: {
    title: 'Le sommeil, ton allie secret',
    message: 'Un bon sommeil aide a reguler tes hormones de faim. Prends soin de tes nuits !',
  },
  stress: {
    title: 'Gere ton stress',
    message: 'Le stress impacte ton metabolisme. Accorde-toi des moments de detente.',
  },
  movement: {
    title: 'Bouge au quotidien',
    message: 'Les mouvements quotidiens sont aussi importants que les seances sport. Chaque pas compte !',
  },
  celebration: {
    title: 'Tu es sur la bonne voie !',
    message: 'Chaque jour ou tu prends soin de toi est une victoire. Continue comme ca !',
  },
}

export function Lymia({ className }: LymiaProps) {
  const { profile, weightHistory } = useUserStore()
  const { todayScore, getEntryForDate, targets, streaks: wellnessStreaks } = useWellnessStore()
  const { getDailyNutrition, getMealsForDate, getHydration } = useMealsStore()
  const { getStreakInfo, level, xp, badges } = useGamificationStore()
  const { currentProgram, currentStreak: sportStreak, getPhaseProgress, totalSessionsCompleted } = useSportProgramStore()
  const { getTotalBalance, getCurrentDayIndex, canHavePlaisir } = useCaloricBankStore()

  const [dismissedMessages, setDismissedMessages] = React.useState<string[]>([])
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
    // Load dismissed messages from localStorage
    const saved = localStorage.getItem('coach-dismissed')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Reset if it's a new day
        const today = new Date().toISOString().split('T')[0]
        if (parsed.date !== today) {
          localStorage.setItem('coach-dismissed', JSON.stringify({ date: today, ids: [] }))
        } else {
          setDismissedMessages(parsed.ids || [])
        }
      } catch {
        // Invalid JSON
      }
    }
  }, [])

  const dismissMessage = (id: string) => {
    const newDismissed = [...dismissedMessages, id]
    setDismissedMessages(newDismissed)
    const today = new Date().toISOString().split('T')[0]
    localStorage.setItem('coach-dismissed', JSON.stringify({ date: today, ids: newDismissed }))
  }

  if (!mounted || !profile) {
    return null
  }

  const isAdaptive = profile.metabolismProfile === 'adaptive'
  const today = new Date().toISOString().split('T')[0]
  const todayEntry = getEntryForDate(today)
  const todayNutrition = getDailyNutrition(today)
  const todayMeals = getMealsForDate(today)
  const todayHydration = getHydration(today)
  const streakInfo = getStreakInfo()
  const currentHour = new Date().getHours()

  // Caloric bank data
  const caloricBalance = getTotalBalance()
  const currentDayIndex = getCurrentDayIndex()
  const canHavePlaisirToday = canHavePlaisir()

  // Sport data
  const sportPhase = getPhaseProgress()
  const isSportEnabled = profile?.sportTrackingEnabled || isAdaptive

  // Weight data
  const latestWeight = weightHistory.length > 0 ? weightHistory[weightHistory.length - 1] : null
  const previousWeight = weightHistory.length > 1 ? weightHistory[weightHistory.length - 2] : null
  const weightTrend = latestWeight && previousWeight ? latestWeight.weight - previousWeight.weight : 0

  // Nutrition targets from profile
  const caloriesTarget = profile.dailyCaloriesTarget || profile.nutritionalNeeds?.calories || 2100
  const proteinTarget = profile.proteinTarget || profile.nutritionalNeeds?.proteins || 120
  const carbsTarget = profile.carbsTarget || profile.nutritionalNeeds?.carbs || 250
  const fatTarget = profile.fatTarget || profile.nutritionalNeeds?.fats || 70

  // Generate contextual messages based on ALL user data
  const generateMessages = (): CoachMessage[] => {
    const messages: CoachMessage[] = []

    // ADAPTIVE METABOLISM SPECIFIC MESSAGES
    if (isAdaptive) {
      // Welcome message for adaptive users (first time)
      if (!localStorage.getItem('coach-adaptive-welcome')) {
        messages.push({
          id: 'adaptive-welcome',
          type: 'adaptive',
          icon: <Heart className="h-5 w-5 text-emerald-500" />,
          title: ADAPTIVE_MESSAGES.welcome.title,
          message: ADAPTIVE_MESSAGES.welcome.message,
          priority: 100,
          action: {
            label: 'Compris !',
            onClick: () => {
              localStorage.setItem('coach-adaptive-welcome', 'true')
              dismissMessage('adaptive-welcome')
            },
          },
        })
      }

      // Phase reminder
      if (profile.nutritionalStrategy?.currentPhase === 'maintenance') {
        messages.push({
          id: 'adaptive-maintenance',
          type: 'adaptive',
          icon: <TrendingUp className="h-5 w-5 text-emerald-500" />,
          title: ADAPTIVE_MESSAGES.maintenance.title,
          message: `Semaine ${profile.nutritionalStrategy.weekInPhase} de stabilisation. ${ADAPTIVE_MESSAGES.maintenance.message}`,
          priority: 80,
        })
      }

      // Protein priority reminder
      const proteinTarget = profile.nutritionalNeeds?.proteins || 120
      const proteinPercent = (todayNutrition.proteins / proteinTarget) * 100
      if (proteinPercent < 50 && new Date().getHours() >= 14) {
        messages.push({
          id: 'adaptive-protein',
          type: 'tip',
          icon: <Sparkles className="h-5 w-5 text-amber-500" />,
          title: ADAPTIVE_MESSAGES.protein.title,
          message: `Tu es a ${Math.round(proteinPercent)}% de ton objectif proteines. Pense a en ajouter a ton prochain repas.`,
          priority: 70,
        })
      }
    }

    // GENERAL MESSAGES (for all users, but especially important for adaptive)

    // Sleep check (if wellness data available)
    if (todayEntry?.sleepHours) {
      if (todayEntry.sleepHours < 6) {
        messages.push({
          id: 'sleep-warning',
          type: 'warning',
          icon: <Moon className="h-5 w-5 text-indigo-500" />,
          title: 'Sommeil insuffisant',
          message: isAdaptive
            ? `${todayEntry.sleepHours}h de sommeil seulement. Pour ton metabolisme, vise 7-8h. ${ADAPTIVE_MESSAGES.sleep.message}`
            : `Tu n'as dormi que ${todayEntry.sleepHours}h. Le manque de sommeil peut affecter tes objectifs.`,
          priority: 75,
        })
      } else if (todayEntry.sleepHours >= 7) {
        messages.push({
          id: 'sleep-good',
          type: 'celebration',
          icon: <Moon className="h-5 w-5 text-indigo-500" />,
          title: 'Belle nuit de sommeil !',
          message: `${todayEntry.sleepHours}h de repos. Ton corps te remercie !`,
          priority: 30,
        })
      }
    }

    // Stress check (especially for adaptive)
    if (todayEntry?.stressLevel && todayEntry.stressLevel >= 4) {
      messages.push({
        id: 'stress-high',
        type: 'tip',
        icon: <Heart className="h-5 w-5 text-rose-500" />,
        title: isAdaptive ? ADAPTIVE_MESSAGES.stress.title : 'Niveau de stress eleve',
        message: isAdaptive
          ? ADAPTIVE_MESSAGES.stress.message
          : 'Le stress peut impacter ta faim et ta digestion. Prends un moment pour toi.',
        priority: 65,
      })
    }

    // Hydration reminder
    const waterPercent = todayEntry?.waterLiters
      ? (todayEntry.waterLiters / targets.waterLiters) * 100
      : 0
    const currentHour = new Date().getHours()
    if (waterPercent < 40 && currentHour >= 12) {
      messages.push({
        id: 'hydration-reminder',
        type: 'tip',
        icon: <Droplets className="h-5 w-5 text-cyan-500" />,
        title: 'Pense a t\'hydrater',
        message: `Tu es a ${Math.round(waterPercent)}% de ton objectif d'eau. L'hydratation aide ton metabolisme !`,
        priority: 50,
      })
    }

    // Streak celebration
    if (streakInfo.current >= 7 && streakInfo.current % 7 === 0) {
      messages.push({
        id: `streak-${streakInfo.current}`,
        type: 'celebration',
        icon: <Sparkles className="h-5 w-5 text-amber-500" />,
        title: `${streakInfo.current} jours de suite !`,
        message: isAdaptive
          ? ADAPTIVE_MESSAGES.celebration.message
          : 'Ta regularite paie ! Continue sur cette lancee.',
        priority: 85,
      })
    }

    // Movement reminder for adaptive users
    if (isAdaptive && currentHour >= 15 && (!todayEntry?.steps || todayEntry.steps < 3000)) {
      messages.push({
        id: 'movement-reminder',
        type: 'tip',
        icon: <Activity className="h-5 w-5 text-teal-500" />,
        title: ADAPTIVE_MESSAGES.movement.title,
        message: ADAPTIVE_MESSAGES.movement.message,
        priority: 55,
      })
    }

    // ===== NUTRITION MESSAGES (based on real meal data) =====

    // Calorie tracking message
    const caloriePercent = (todayNutrition.calories / caloriesTarget) * 100
    if (caloriePercent >= 90 && caloriePercent <= 110 && todayMeals.length >= 3) {
      messages.push({
        id: 'calories-on-target',
        type: 'celebration',
        icon: <Target className="h-5 w-5 text-emerald-500" />,
        title: 'Objectif calories atteint !',
        message: `Tu es a ${Math.round(caloriePercent)}% de ton objectif. Parfait equilibre aujourd'hui !`,
        priority: 60,
      })
    } else if (caloriePercent > 120 && currentHour >= 18) {
      messages.push({
        id: 'calories-over',
        type: 'tip',
        icon: <Utensils className="h-5 w-5 text-amber-500" />,
        title: 'Calories depassees',
        message: isAdaptive
          ? 'Tu as depasse tes calories. Pas de stress, demain est une nouvelle journee !'
          : `Tu as consomme ${Math.round(todayNutrition.calories - caloriesTarget)} kcal de plus. Allegez le diner.`,
        priority: 68,
      })
    } else if (todayMeals.length === 0 && currentHour >= 10) {
      messages.push({
        id: 'no-meals-logged',
        type: 'tip',
        icon: <Utensils className="h-5 w-5 text-blue-500" />,
        title: 'N\'oublie pas ton suivi',
        message: 'Tu n\'as pas encore enregistre de repas aujourd\'hui. Le suivi t\'aide a atteindre tes objectifs !',
        priority: 45,
      })
    }

    // Protein tracking (especially important for adaptive)
    const proteinPercent = (todayNutrition.proteins / proteinTarget) * 100
    if (proteinPercent < 50 && currentHour >= 14) {
      messages.push({
        id: 'protein-low',
        type: 'tip',
        icon: <Flame className="h-5 w-5 text-orange-500" />,
        title: isAdaptive ? ADAPTIVE_MESSAGES.protein.title : 'Proteines insuffisantes',
        message: isAdaptive
          ? `${Math.round(proteinPercent)}% de ton objectif. Les proteines preservent ta masse musculaire.`
          : `Tu es a ${Math.round(proteinPercent)}% de ton objectif proteines. Ajoute une source de proteines a ton prochain repas.`,
        priority: isAdaptive ? 72 : 55,
      })
    } else if (proteinPercent >= 100) {
      messages.push({
        id: 'protein-goal',
        type: 'celebration',
        icon: <Flame className="h-5 w-5 text-orange-500" />,
        title: 'Objectif proteines atteint !',
        message: 'Excellent pour tes muscles et ta satiete !',
        priority: 40,
      })
    }

    // Sugar warning if too high (nutrition app - avoid sugary products)
    const sugarAmount = todayNutrition.sugar || 0
    if (sugarAmount > 50) {
      messages.push({
        id: 'sugar-high',
        type: 'warning',
        icon: <Utensils className="h-5 w-5 text-red-500" />,
        title: 'Attention au sucre',
        message: `Tu as consomme ${Math.round(sugarAmount)}g de sucre aujourd'hui. Privilegie les aliments complets.`,
        priority: 65,
      })
    }

    // ===== CALORIC BANK MESSAGES =====

    // Plaisir message when available
    if (canHavePlaisirToday && caloricBalance > 200) {
      messages.push({
        id: 'plaisir-available',
        type: 'celebration',
        icon: <Sparkles className="h-5 w-5 text-fuchsia-500" />,
        title: 'Solde Plaisir disponible !',
        message: `Tu as ${caloricBalance} kcal en banque. Accorde-toi un petit extra si tu le souhaites !`,
        priority: 75,
      })
    }

    // Week progress message
    if (currentDayIndex >= 5 && caloricBalance > 0) {
      messages.push({
        id: 'week-almost-done',
        type: 'encouragement',
        icon: <TrendingUp className="h-5 w-5 text-emerald-500" />,
        title: 'Fin de semaine approche',
        message: `Jour ${currentDayIndex + 1}/7 - Tu as accumule ${caloricBalance} kcal. Belle gestion !`,
        priority: 50,
      })
    }

    // ===== SPORT MESSAGES =====

    if (isSportEnabled) {
      // Sessions completed milestone
      if (totalSessionsCompleted > 0 && totalSessionsCompleted % 5 === 0) {
        messages.push({
          id: `sessions-${totalSessionsCompleted}`,
          type: 'celebration',
          icon: <Activity className="h-5 w-5 text-violet-500" />,
          title: `${totalSessionsCompleted} seances completees !`,
          message: 'Ta regularite paie ! Continue a progresser avec LymIA Sport.',
          priority: 55,
        })
      }

      // Sport streak
      if (sportStreak >= 3) {
        messages.push({
          id: 'sport-streak',
          type: 'celebration',
          icon: <Award className="h-5 w-5 text-amber-500" />,
          title: `${sportStreak} seances de suite !`,
          message: 'Ta regularite sportive est impressionnante. Continue !',
          priority: 55,
        })
      }

      // Phase progress
      if (sportPhase.progress >= 80 && sportPhase.phase !== 'full_program') {
        messages.push({
          id: 'phase-almost-complete',
          type: 'encouragement',
          icon: <TrendingUp className="h-5 w-5 text-violet-500" />,
          title: 'Progression phase',
          message: `Tu es a ${Math.round(sportPhase.progress)}% de ta phase actuelle. Bientot la prochaine etape !`,
          priority: 48,
        })
      }
    }

    // ===== WEIGHT MESSAGES =====

    if (latestWeight) {
      // Weight trend message
      if (weightTrend < -0.5 && profile.goal === 'weight_loss') {
        messages.push({
          id: 'weight-loss-progress',
          type: 'celebration',
          icon: <Scale className="h-5 w-5 text-emerald-500" />,
          title: 'Belle progression !',
          message: `Tu as perdu ${Math.abs(weightTrend).toFixed(1)} kg recemment. Continue comme ca !`,
          priority: 70,
        })
      } else if (weightTrend > 0.5 && profile.goal === 'weight_loss' && isAdaptive) {
        messages.push({
          id: 'weight-patience',
          type: 'adaptive',
          icon: <Heart className="h-5 w-5 text-emerald-500" />,
          title: ADAPTIVE_MESSAGES.patience.title,
          message: 'Les fluctuations sont normales. Ton corps s\'adapte, fais-lui confiance.',
          priority: 65,
        })
      } else if (weightTrend > 0.3 && profile.goal === 'muscle_gain') {
        messages.push({
          id: 'muscle-gain-progress',
          type: 'celebration',
          icon: <Scale className="h-5 w-5 text-emerald-500" />,
          title: 'Prise de masse en cours',
          message: `+${weightTrend.toFixed(1)} kg. Assure-toi d'atteindre ton objectif proteines !`,
          priority: 60,
        })
      }
    }

    // ===== GAMIFICATION MESSAGES =====

    // Level up celebration
    if (level >= 5 && xp % 100 < 20) {
      messages.push({
        id: 'level-progress',
        type: 'celebration',
        icon: <Award className="h-5 w-5 text-amber-500" />,
        title: `Niveau ${level} atteint !`,
        message: 'Ta constance paie ! Continue a accumuler de l\'XP.',
        priority: 45,
      })
    }

    // Recent badge celebration
    if (badges && badges.length > 0) {
      const recentBadge = badges[badges.length - 1]
      if (recentBadge?.unlockedAt) {
        const badgeDate = new Date(recentBadge.unlockedAt).toISOString().split('T')[0]
        if (badgeDate === today) {
          messages.push({
            id: `badge-${recentBadge.id}`,
            type: 'celebration',
            icon: <Award className="h-5 w-5 text-amber-500" />,
            title: 'Nouveau badge debloque !',
            message: `${recentBadge.emoji} ${recentBadge.name} - ${recentBadge.description}`,
            priority: 80,
          })
        }
      }
    }

    return messages
  }

  const allMessages = generateMessages()
  const visibleMessages = allMessages
    .filter(m => !dismissedMessages.includes(m.id))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 2) // Show max 2 messages at a time

  if (visibleMessages.length === 0) {
    return null
  }

  const getMessageStyle = (type: CoachMessage['type']) => {
    switch (type) {
      case 'adaptive':
        return 'bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border-emerald-500/30'
      case 'celebration':
        return 'bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent border-amber-500/30'
      case 'warning':
        return 'bg-gradient-to-r from-red-500/10 via-rose-500/5 to-transparent border-red-500/30'
      case 'tip':
        return 'bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent border-blue-500/30'
      case 'nutrition':
        return 'bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent border-orange-500/30'
      case 'sport':
        return 'bg-gradient-to-r from-teal-500/10 via-cyan-500/5 to-transparent border-teal-500/30'
      default:
        return 'bg-gradient-to-r from-violet-500/10 via-purple-500/5 to-transparent border-violet-500/30'
    }
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1 rounded-full bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20">
          <Sparkles className="h-4 w-4 text-violet-500" />
        </div>
        <span className="text-sm font-semibold bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
          LymIA
        </span>
        {isAdaptive && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            Bienveillant
          </span>
        )}
      </div>

      <AnimatePresence mode="popLayout">
        {visibleMessages.map((msg, index) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card
              padding="default"
              className={cn(
                'relative border transition-all hover:shadow-md',
                getMessageStyle(msg.type)
              )}
            >
              <button
                onClick={() => dismissMessage(msg.id)}
                className="absolute top-2 right-2 p-1 rounded-full hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <X className="h-4 w-4 text-[var(--text-tertiary)]" />
              </button>

              <div className="flex items-start gap-3 pr-6">
                <div className="p-2 rounded-lg bg-[var(--bg-secondary)]">
                  {msg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm text-[var(--text-primary)]">
                    {msg.title}
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                    {msg.message}
                  </p>
                  {msg.action && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-7 px-2 text-xs"
                      onClick={msg.action.onClick}
                    >
                      {msg.action.label}
                      <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
