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
  CoachInsights,
  HydrationTracker,
  RecipeSuggestions,
  WeightTrackerCompact,
  GamificationPanel,
  RewardsManager,
} from '@/components/dashboard'
import { useRecipeSuggestions } from '@/hooks/use-recipe-suggestions'
import { useCaloricBankStore } from '@/stores/caloric-bank-store'
import { useGamificationStore } from '@/stores/gamification-store'
import { useMealsStore } from '@/stores/meals-store'
import { getGreeting, formatDate } from '@/lib/utils'
import type { UserProfile } from '@/types'

// Mock data for Solde Plaisir (7 days) - will be replaced by caloric-bank-store data
// TODO: Replace with real data from useCaloricBankStore
const mockDailyBalances = [
  { day: 'Jeu', date: '25/12', consumed: 0, target: 2100, balance: 0 },
  { day: 'Ven', date: '26/12', consumed: 0, target: 2100, balance: 0 },
  { day: 'Sam', date: '27/12', consumed: 0, target: 2100, balance: 0 },
  { day: 'Dim', date: '28/12', consumed: 0, target: 2100, balance: 0 },
  { day: 'Lun', date: '29/12', consumed: 0, target: 2100, balance: 0 },
  { day: 'Mar', date: '30/12', consumed: 0, target: 2100, balance: 0 },
  { day: 'Mer', date: '31/12', consumed: 0, target: 2100, balance: 0 },
]

const mockInsights = [
  {
    id: '1',
    type: 'success' as const,
    title: 'Objectif protéines atteint !',
    message: 'Vous avez consommé suffisamment de protéines aujourd\'hui. Continuez ainsi !',
    dismissible: true,
  },
  {
    id: '2',
    type: 'tip' as const,
    title: 'Conseil hydratation',
    message: 'N\'oubliez pas de boire régulièrement. Vous êtes à 1.2L sur 2.5L recommandés.',
    action: { label: 'Ajouter de l\'eau' },
    dismissible: true,
  },
]

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
  const [profile, setProfile] = React.useState<Partial<UserProfile> | null>(null)
  const [dismissedInsights, setDismissedInsights] = React.useState<string[]>([])
  const [mounted, setMounted] = React.useState(false)
  const [isHydrated, setIsHydrated] = React.useState(false)

  // Caloric bank store (7-day rolling period with automatic reset after 7 days)
  const {
    weekStartDate,
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
    // Check if user has completed onboarding
    const storedProfile = localStorage.getItem('userProfile')
    if (storedProfile) {
      setProfile(JSON.parse(storedProfile))
    } else {
      router.push('/onboarding')
    }
  }, [router, initializeWeek, checkAndUpdateStreak])

  if (!mounted || !profile) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="animate-pulse text-[var(--text-tertiary)]">Chargement...</div>
      </div>
    )
  }

  const greeting = getGreeting()
  const today = formatDate(new Date())
  const visibleInsights = mockInsights.filter(i => !dismissedInsights.includes(i.id))

  // Get real nutrition data from meals store
  const todayNutrition = getDailyNutrition(todayString)
  const todayMeals = getMealsForDate(todayString)
  const currentHydration = getHydration(todayString)

  // Build nutrition data from real store values with profile targets
  const nutritionData = {
    calories: {
      current: todayNutrition.calories,
      target: profile.dailyCaloriesTarget || 2100
    },
    proteins: {
      current: todayNutrition.proteins,
      target: profile.proteinTarget || 130
    },
    carbs: {
      current: todayNutrition.carbs,
      target: profile.carbsTarget || 250
    },
    fats: {
      current: todayNutrition.fats,
      target: profile.fatTarget || 70
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
            target={2500}
            onAdd={(amount) => addHydration(amount, todayString)}
            onRemove={(amount) => addHydration(-amount, todayString)}
          />
        </Section>

        {/* Today's Meals */}
        <Section>
          <MealsToday meals={mealsData} />
        </Section>

        {/* Coach Insights */}
        {visibleInsights.length > 0 && (
          <Section>
            <CoachInsights
              insights={visibleInsights}
              onDismiss={(id) => setDismissedInsights(prev => [...prev, id])}
            />
          </Section>
        )}

        {/* Weight Tracker */}
        <Section>
          <WeightTrackerCompact
            currentWeight={profile.weight || 70}
            targetWeight={profile.targetWeight || 65}
            trend={-0.3}
            onAddEntry={() => router.push('/weight')}
          />
        </Section>

        {/* Caloric Balance (Banque calorique) */}
        <Section>
          <CaloricBalance
            dailyBalances={mockDailyBalances}
            currentDay={currentDayIndex}
            daysUntilNewWeek={daysUntilNewWeek}
            weekStartDate={weekStartDate ?? undefined}
            dailyTarget={profile.dailyCaloriesTarget || 2100}
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
