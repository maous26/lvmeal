'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageContainer, Section } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import {
  NutritionOverview,
  MealsToday,
  WeeklyChart,
  CaloricBalance,
  CoachInsights,
  HydrationTracker,
  StreakBadge,
  RecipeSuggestions,
  WeightTrackerCompact,
} from '@/components/dashboard'
import { useRecipeSuggestions } from '@/hooks/use-recipe-suggestions'
import { useCaloricBankStore } from '@/stores/caloric-bank-store'
import { getGreeting, formatDate } from '@/lib/utils'
import type { UserProfile } from '@/types'

// Mock data for demo
const mockNutritionData = {
  calories: { current: 1450, target: 2100 },
  proteins: { current: 85, target: 130 },
  carbs: { current: 165, target: 250 },
  fats: { current: 45, target: 70 },
}

const mockMeals = [
  { type: 'breakfast' as const, logged: true, calories: 420, items: ['Yaourt grec', 'Granola', 'Fruits rouges'] },
  { type: 'lunch' as const, logged: true, calories: 680, items: ['Salade César', 'Poulet grillé'] },
  { type: 'snack' as const, logged: false },
  { type: 'dinner' as const, logged: false },
]

const mockWeeklyData = [
  { day: 'Lundi', shortDay: 'L', calories: 2050, target: 2100, isToday: false },
  { day: 'Mardi', shortDay: 'M', calories: 2180, target: 2100, isToday: false },
  { day: 'Mercredi', shortDay: 'M', calories: 1950, target: 2100, isToday: false },
  { day: 'Jeudi', shortDay: 'J', calories: 2100, target: 2100, isToday: false },
  { day: 'Vendredi', shortDay: 'V', calories: 2250, target: 2100, isToday: false },
  { day: 'Samedi', shortDay: 'S', calories: 1800, target: 2100, isToday: false },
  { day: 'Dimanche', shortDay: 'D', calories: 1450, target: 2100, isToday: true },
]

// Mock data for caloric bank (7 days)
const mockDailyBalances = [
  { day: 'Lun', date: '23/12', consumed: 1850, target: 2100, balance: 250 }, // saved 250
  { day: 'Mar', date: '24/12', consumed: 2200, target: 2100, balance: -100 }, // overspent 100
  { day: 'Mer', date: '25/12', consumed: 1700, target: 2100, balance: 400 }, // saved 400
  { day: 'Jeu', date: '26/12', consumed: 1900, target: 2100, balance: 200 }, // saved 200
  { day: 'Ven', date: '27/12', consumed: 2000, target: 2100, balance: 100 }, // saved 100
  { day: 'Sam', date: '28/12', consumed: 1800, target: 2100, balance: 300 }, // saved 300
  { day: 'Dim', date: '29/12', consumed: 0, target: 2100, balance: 2100 }, // today - not yet consumed
]

// Calculate total caloric balance (sum of all daily balances except today)
// This represents the "banque calorique" - calories user can "spend" on treats
const calculateTotalCaloricBalance = () => {
  // Exclude today's balance since it's not yet "earned"
  const pastBalances = mockDailyBalances.slice(0, -1)
  return pastBalances.reduce((total, day) => total + day.balance, 0)
}

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
  const [hydration, setHydration] = React.useState(1200) // ml
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

  // Get values after hydration
  const currentDayIndex = isHydrated ? getCurrentDayIndex() : 0
  const totalCaloricBalance = isHydrated ? getTotalBalance() : calculateTotalCaloricBalance()
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

  React.useEffect(() => {
    setMounted(true)
    setIsHydrated(true)
    // Initialize caloric bank week if not already done
    initializeWeek()
    // Check if user has completed onboarding
    const storedProfile = localStorage.getItem('userProfile')
    if (storedProfile) {
      setProfile(JSON.parse(storedProfile))
    } else {
      router.push('/onboarding')
    }
  }, [router, initializeWeek])

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
        {/* Streak & Date */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div>
            <p className="text-sm text-[var(--text-tertiary)] capitalize">{today}</p>
          </div>
          <StreakBadge days={7} />
        </motion.div>

        {/* Main Nutrition Overview */}
        <Section>
          <NutritionOverview data={mockNutritionData} />
        </Section>

        {/* Quick Actions */}
        <Section>
          <Button
            variant="default"
            size="lg"
            className="h-14 w-full"
            onClick={() => router.push('/meals/add')}
          >
            <Plus className="h-5 w-5 mr-2" />
            Ajouter un repas
          </Button>
        </Section>

        {/* Hydration Tracker */}
        <Section>
          <HydrationTracker
            current={hydration}
            target={2500}
            onAdd={(amount) => setHydration(h => h + amount)}
            onRemove={(amount) => setHydration(h => Math.max(0, h - amount))}
          />
        </Section>

        {/* Today's Meals */}
        <Section>
          <MealsToday meals={mockMeals} />
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

        {/* Weekly Overview */}
        <Section>
          <WeeklyChart data={mockWeeklyData} />
        </Section>

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
            dailyTarget={profile.dailyCaloriesTarget || mockNutritionData.calories.target}
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
    </>
  )
}
