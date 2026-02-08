'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Plus, CalendarRange, Sparkles } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageContainer, Section } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import {
  NutritionOverview,
  MealsToday,
  CaloricBalance,
  HydrationTracker,
  RecipeSuggestions,
  WeightTrackerCompact,
  GamificationPanel,
  RewardsManager,
  WellnessWidget,
  SportWidget,
  Lymia,
  ConnectedDevices,
} from '@/components/dashboard'
import { useRecipeSuggestions } from '@/hooks/use-recipe-suggestions'
import { useCaloricBankStore } from '@/stores/caloric-bank-store'
import { useGamificationStore } from '@/stores/gamification-store'
import { useMealsStore } from '@/stores/meals-store'
import { useUserStore } from '@/stores/user-store'
import { getGreeting, formatDate } from '@/lib/utils'
import type { UserProfile } from '@/types'

// Short day labels for the caloric bank display
const SHORT_DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

// Build real daily balances from caloric bank store and meals data
function buildRealDailyBalances(
  weekStartDate: string | null,
  dailyBalances: Array<{ date: string; consumed: number; target: number; balance: number }>,
  dailyTarget: number
) {
  if (!weekStartDate) return []

  const start = new Date(weekStartDate)
  const result = []

  for (let i = 0; i < 7; i++) {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    const dateStr = date.toISOString().split('T')[0]
    const dayOfWeek = date.getDay()
    const dayLabel = SHORT_DAY_LABELS[dayOfWeek]
    const dateLabel = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`

    const existing = dailyBalances.find(b => b.date === dateStr)

    result.push({
      day: dayLabel,
      date: dateLabel,
      consumed: existing?.consumed ?? 0,
      target: existing?.target ?? dailyTarget,
      balance: existing?.balance ?? 0,
    })
  }

  return result
}


// Fallback recipes when API suggestions are not available
const fallbackRecipes = [
  {
    id: '1',
    title: 'Buddha Bowl Quinoa',
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
    calories: 450,
    prepTime: 25,
    difficulty: 'easy' as const,
    rating: 4.8,
    tags: ['Healthy', 'Végétarien'],
  },
  {
    id: '2',
    title: 'Saumon Teriyaki',
    imageUrl: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400',
    calories: 520,
    prepTime: 30,
    difficulty: 'medium' as const,
    rating: 4.6,
    tags: ['Protéiné'],
  },
  {
    id: '3',
    title: 'Salade Méditerranéenne',
    imageUrl: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400',
    calories: 320,
    prepTime: 15,
    difficulty: 'easy' as const,
    rating: 4.5,
    tags: ['Express'],
  },
]

export default function HomePage() {
  const router = useRouter()
  const [mounted, setMounted] = React.useState(false)
  const [isHydrated, setIsHydrated] = React.useState(false)

  // User store (primary source of profile data)
  const { profile: storeProfile, isOnboarded, migrateFromLocalStorage, weightHistory } = useUserStore()
  const [profile, setProfile] = React.useState<Partial<UserProfile> | null>(null)

  // Caloric bank store (7-day rolling period with automatic reset after 7 days)
  const {
    weekStartDate,
    dailyBalances: storeDailyBalances,
    initializeWeek,
    getCurrentDayIndex,
    getTotalBalance,
    canHavePlaisir: checkCanHavePlaisir,
    getDaysUntilNewWeek,
    isFirstTimeSetup: checkIsFirstTimeSetup,
    confirmStartDay,
    resetToToday,
  } = useCaloricBankStore()

  // Gamification store
  const {
    checkAndUpdateStreak,
    getStreakInfo,
  } = useGamificationStore()

  // Meals store - real data
  const {
    getDailyNutrition,
    getMealsForDate,
    getHydration,
    addHydration,
  } = useMealsStore()

  // Get today's date string for store queries
  const todayString = new Date().toISOString().split('T')[0]

  // Get values after hydration
  const currentDayIndex = isHydrated ? getCurrentDayIndex() : 0
  const totalCaloricBalance = isHydrated ? getTotalBalance() : 0
  const canHavePlaisirFromStore = isHydrated ? checkCanHavePlaisir() : false
  const daysUntilNewWeek = isHydrated ? getDaysUntilNewWeek() : 7
  const isFirstTimeSetup = isHydrated ? checkIsFirstTimeSetup() : false

  // Fetch personalized recipe suggestions (with plats plaisir on days 5-7 if positive balance)
  const { recipes: suggestedRecipes, suggestedMealType, isLoading: recipesLoading, canHavePlaisir } = useRecipeSuggestions({
    limit: 6,
    caloricBalance: totalCaloricBalance,
    currentDay: currentDayIndex,
    goal: profile?.goal as string || '',
    dietType: profile?.dietType as string || '',
  })

  // Use store value for canHavePlaisir if hydrated, otherwise use API value
  const showPlaisirMessage = isHydrated ? canHavePlaisirFromStore : canHavePlaisir

  // Get streak info from gamification store
  const streakInfo = isHydrated ? getStreakInfo() : { current: 0, longest: 0, isActive: false }

  React.useEffect(() => {
    setMounted(true)
    setIsHydrated(true)
    // Initialize caloric bank week if not already done
    initializeWeek()
    // Update streak on page load
    checkAndUpdateStreak()
    // Migrate legacy localStorage to store if needed
    migrateFromLocalStorage()
  }, [initializeWeek, checkAndUpdateStreak, migrateFromLocalStorage])

  // Separate effect to handle profile and redirect
  React.useEffect(() => {
    if (!mounted) return

    if (storeProfile) {
      setProfile(storeProfile)
    } else {
      // No profile in store, redirect to onboarding
      router.push('/onboarding')
    }
  }, [mounted, storeProfile, router])

  if (!mounted || !profile) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="animate-pulse text-[var(--text-tertiary)]">Chargement...</div>
      </div>
    )
  }

  const greeting = getGreeting()
  const today = formatDate(new Date())

  // Get real nutrition data from meals store
  const todayNutrition = getDailyNutrition(todayString)
  const todayMeals = getMealsForDate(todayString)
  const currentHydration = getHydration(todayString)

  // Unified nutrition targets: prefer nutritionalNeeds (calculated), fallback to direct targets
  const calorieTarget = profile.nutritionalNeeds?.calories || profile.dailyCaloriesTarget || 2100
  const proteinTarget = profile.nutritionalNeeds?.proteins || profile.proteinTarget || 130
  const carbsTarget = profile.nutritionalNeeds?.carbs || profile.carbsTarget || 250
  const fatTarget = profile.nutritionalNeeds?.fats || profile.fatTarget || 70
  const waterTarget = Math.round((profile.nutritionalNeeds?.water || 2.5) * 1000) // L to ml

  // Build nutrition data from real store values with profile targets
  const nutritionData = {
    calories: {
      current: todayNutrition.calories,
      target: calorieTarget
    },
    proteins: {
      current: todayNutrition.proteins,
      target: proteinTarget
    },
    carbs: {
      current: todayNutrition.carbs,
      target: carbsTarget
    },
    fats: {
      current: todayNutrition.fats,
      target: fatTarget
    },
  }

  // Build meals data from real store
  const mealTypes = ['breakfast', 'lunch', 'snack', 'dinner'] as const
  const mealsData = mealTypes.map(type => {
    const mealsOfType = todayMeals.filter(m => m.type === type)
    const isLogged = mealsOfType.length > 0
    const totalCalories = mealsOfType.reduce((sum, m) => sum + m.totalNutrition.calories, 0)
    const items = mealsOfType.flatMap(m => m.items.map(item => item.food.name))

    return {
      type,
      logged: isLogged,
      calories: isLogged ? totalCalories : undefined,
      items: isLogged ? items : undefined,
    }
  })

  return (
    <>
      <Header
        subtitle={greeting}
        title={profile.firstName || 'Utilisateur'}
        showProfile
        showNotifications
        user={{ name: profile.firstName, image: profile.avatarUrl }}
      />

      <PageContainer className="pt-2">
        {/* Gamification Panel (compact) */}
        <Section>
          <GamificationPanel
            compact
            onViewAll={() => router.push('/profile/achievements')}
          />
        </Section>

        {/* LymIA - Coach proactif */}
        <Section>
          <Lymia />
        </Section>

        {/* Main Nutrition Overview */}
        <Section>
          <NutritionOverview data={nutritionData} />
        </Section>

        {/* Quick Actions */}
        <Section>
          <div className="flex gap-3">
            <Button
              variant="default"
              size="lg"
              className="h-14 flex-1"
              onClick={() => router.push('/meals/add')}
            >
              <Plus className="h-5 w-5 mr-2" />
              Ajouter un repas
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-14 flex-1 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 border-emerald-300 dark:border-emerald-700 hover:from-emerald-500/20 hover:via-teal-500/20 hover:to-cyan-500/20 group"
              onClick={() => router.push('/plan')}
            >
              <div className="relative">
                <CalendarRange className="h-5 w-5 mr-2 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                <Sparkles className="h-3 w-3 absolute -top-1 -right-0 text-amber-500 animate-pulse" />
              </div>
              <span className="text-emerald-700 dark:text-emerald-300 font-semibold">Plan 7 jours</span>
            </Button>
          </div>
        </Section>

        {/* Hydration Tracker */}
        <Section>
          <HydrationTracker
            current={currentHydration}
            target={waterTarget}
            onAdd={(amount) => addHydration(amount, todayString)}
            onRemove={(amount) => addHydration(-amount, todayString)}
          />
        </Section>

        {/* Today's Meals */}
        <Section>
          <MealsToday meals={mealsData} />
        </Section>

        {/* Wellness & Sport Widgets */}
        <Section>
          <div className="grid grid-cols-1 gap-3">
            <WellnessWidget />
            <SportWidget />
          </div>
        </Section>

        {/* Connected Devices (Apple Watch, etc.) */}
        <Section>
          <ConnectedDevices />
        </Section>

        {/* Weight Tracker */}
        <Section>
          <WeightTrackerCompact
            currentWeight={profile.weight || 70}
            targetWeight={profile.targetWeight || 65}
            trend={(() => {
              if (weightHistory.length < 2) return 0
              const sorted = [...weightHistory].sort((a, b) => a.date.localeCompare(b.date))
              const latest = sorted[sorted.length - 1].weight
              const previous = sorted[sorted.length - 2].weight
              return Math.round((latest - previous) * 10) / 10
            })()}
            onAddEntry={() => router.push('/weight')}
          />
        </Section>

        {/* Caloric Balance (Banque calorique) */}
        <Section>
          <CaloricBalance
            dailyBalances={buildRealDailyBalances(weekStartDate, storeDailyBalances, calorieTarget)}
            currentDay={currentDayIndex}
            daysUntilNewWeek={daysUntilNewWeek}
            weekStartDate={weekStartDate ?? undefined}
            dailyTarget={calorieTarget}
            isFirstTimeSetup={isFirstTimeSetup}
            onConfirmStart={confirmStartDay}
            onResetDay={resetToToday}
          />
        </Section>

        {/* Recipe Suggestions */}
        <Section>
          <RecipeSuggestions
            recipes={
              suggestedRecipes.length > 0
                ? suggestedRecipes.map((r) => ({
                    id: r.id,
                    title: r.title,
                    imageUrl: r.imageUrl || undefined,
                    calories: r.nutrition.calories,
                    prepTime: r.prepTime,
                    difficulty: r.difficulty,
                    rating: r.rating,
                    tags: r.tags.slice(0, 2),
                  }))
                : fallbackRecipes
            }
            title={
              showPlaisirMessage
                ? `Vous avez ${totalCaloricBalance} kcal en banque ! 🎉`
                : suggestedMealType === 'breakfast'
                  ? 'Idées pour le petit-déjeuner'
                  : suggestedMealType === 'lunch'
                    ? 'Idées pour le déjeuner'
                    : suggestedMealType === 'snack'
                      ? 'Idées pour le goûter'
                      : 'Idées pour ce soir'
            }
            subtitle={showPlaisirMessage ? 'Faites-vous plaisir avec un petit extra !' : undefined}
            onSeeAll={() => router.push('/recipes')}
            onAddToMeal={(id) => router.push(`/recipes?add=${id}`)}
          />
        </Section>

        {/* Spacer for bottom nav */}
        <div className="h-4" />
      </PageContainer>

      {/* Rewards notification manager */}
      <RewardsManager />
    </>
  )
}
