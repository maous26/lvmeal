'use client'

import { useState } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  Calendar,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Check,
  Clock,
  ShoppingCart,
  AlertCircle,
  Utensils,
  Cookie,
  Trash2,
  GripVertical,
  X,
  ChefHat,
  Flame,
  Beef,
  Wheat,
  Droplets,
  CheckCircle2,
  Circle,
  Info,
  Euro,
  TrendingDown,
  ArrowRight,
  ArrowRightLeft,
} from 'lucide-react'
import { generateWeeklyPlanWithDetails, regenerateDayPlan, generateShoppingList, generateRecipeDetails } from '@/app/actions/weekly-planner'
import type { WeeklyPlanPreferences, WeeklyPlan, MealPlanDay, MealPlanMeal } from '@/app/actions/weekly-planner'
import { useUserStore } from '@/stores/user-store'

interface WeeklyPlanGeneratorProps {
  onPlanGenerated?: (plan: WeeklyPlan) => void
  className?: string
}

const mealTypeLabels: Record<string, string> = {
  breakfast: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  snack: 'Collation',
  dinner: 'Dîner',
}

const mealTypeEmojis: Record<string, string> = {
  breakfast: '🥐',
  lunch: '🍽️',
  snack: '🍎',
  dinner: '🌙',
}

interface RecipeDetails {
  ingredients: { name: string; quantity: string; unit: string }[]
  instructions: string[]
  tips?: string[]
}

export function WeeklyPlanGenerator({ onPlanGenerated, className }: WeeklyPlanGeneratorProps) {
  const { profile } = useUserStore()
  const nutritionalNeeds = profile?.nutritionalNeeds

  const [isGenerating, setIsGenerating] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState<number | null>(null)
  const [isGeneratingShoppingList, setIsGeneratingShoppingList] = useState(false)
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null)
  const [shoppingList, setShoppingList] = useState<{ categories?: { name: string; items?: { name: string; quantity: string; priceEstimate?: number }[]; subtotal?: number }[]; totalEstimate?: number; savingsTips?: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedDay, setExpandedDay] = useState<number | null>(null)
  const [showShoppingList, setShowShoppingList] = useState(false)
  const [validatedMeals, setValidatedMeals] = useState<Set<string>>(new Set())

  // Modal states
  const [selectedMeal, setSelectedMeal] = useState<{ meal: MealPlanMeal; dayIndex: number; mealIndex: number } | null>(null)
  const [showRecipeModal, setShowRecipeModal] = useState(false)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [mealToMove, setMealToMove] = useState<{ meal: MealPlanMeal; fromDayIndex: number; mealIndex: number } | null>(null)
  const [isLoadingRecipe, setIsLoadingRecipe] = useState(false)
  const [recipeDetails, setRecipeDetails] = useState<RecipeDetails | null>(null)

  // Preferences
  const [includeCheatMeal, setIncludeCheatMeal] = useState(true)

  // Days labels for move modal
  const dayLabels = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

  // Recipe cache
  const [recipeCache, setRecipeCache] = useState<Record<string, RecipeDetails>>({})

  const getPreferences = (): WeeklyPlanPreferences => {
    return {
      dailyCalories: nutritionalNeeds?.calories || 2000,
      proteins: nutritionalNeeds?.proteins || 75,
      carbs: nutritionalNeeds?.carbs || 250,
      fats: nutritionalNeeds?.fats || 65,
      dietType: profile?.dietType,
      allergies: profile?.allergies,
      goals: profile?.goal,
      includeCheatMeal,
      cookingSkillLevel: profile?.cookingSkillLevel,
      cookingTimeWeekday: profile?.cookingTimeWeekday,
      cookingTimeWeekend: profile?.cookingTimeWeekend,
      fastingSchedule: profile?.fastingSchedule,
      weeklyBudget: profile?.weeklyBudget,
      pricePreference: profile?.pricePreference,
    }
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError(null)
    setWeeklyPlan(null)
    setShoppingList(null)
    setValidatedMeals(new Set())

    try {
      const preferences = getPreferences()
      const result = await generateWeeklyPlanWithDetails(preferences, profile || undefined)

      if (result.success && result.plan) {
        setWeeklyPlan(result.plan)
        onPlanGenerated?.(result.plan)
      } else {
        setError(result.error || 'Erreur lors de la génération')
      }
    } catch {
      setError('Une erreur est survenue. Réessayez.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleRegenerateDay = async (dayIndex: number) => {
    if (!weeklyPlan) return

    setIsRegenerating(dayIndex)
    try {
      const preferences = getPreferences()
      const result = await regenerateDayPlan(dayIndex, preferences, weeklyPlan, profile || undefined)

      if (result.success && result.dayPlan) {
        const newPlan = {
          ...weeklyPlan,
          days: weeklyPlan.days.map((d, i) => (i === dayIndex ? result.dayPlan! : d)),
        }
        setWeeklyPlan(newPlan)
        // Clear validations for this day
        const newValidated = new Set(validatedMeals)
        result.dayPlan.meals.forEach((_, idx) => {
          newValidated.delete(`${dayIndex}-${idx}`)
        })
        setValidatedMeals(newValidated)
        onPlanGenerated?.(newPlan)
      }
    } catch {
      console.error('Regeneration error')
    } finally {
      setIsRegenerating(null)
    }
  }

  const handleGenerateShoppingList = async () => {
    if (!weeklyPlan) return

    setIsGeneratingShoppingList(true)
    try {
      const result = await generateShoppingList(weeklyPlan, profile?.weeklyBudget)
      if (result.success && result.shoppingList) {
        setShoppingList(result.shoppingList)
        setShowShoppingList(true)
      }
    } catch {
      console.error('Shopping list error')
    } finally {
      setIsGeneratingShoppingList(false)
    }
  }

  const toggleMealValidation = (dayIndex: number, mealIndex: number) => {
    const key = `${dayIndex}-${mealIndex}`
    const newValidated = new Set(validatedMeals)
    if (newValidated.has(key)) {
      newValidated.delete(key)
    } else {
      newValidated.add(key)
    }
    setValidatedMeals(newValidated)
  }

  const validateAllMealsForDay = (dayIndex: number) => {
    if (!weeklyPlan) return
    const day = weeklyPlan.days[dayIndex]
    const newValidated = new Set(validatedMeals)

    const nonFastingMeals = day.meals.filter(m => !m.isFasting)
    const allValidated = nonFastingMeals.every((_, idx) => {
      const actualIndex = day.meals.findIndex((m, i) => !m.isFasting && day.meals.slice(0, i + 1).filter(x => !x.isFasting).length === idx + 1)
      return validatedMeals.has(`${dayIndex}-${actualIndex}`)
    })

    day.meals.forEach((meal, mealIndex) => {
      if (!meal.isFasting) {
        const key = `${dayIndex}-${mealIndex}`
        if (allValidated) {
          newValidated.delete(key)
        } else {
          newValidated.add(key)
        }
      }
    })

    setValidatedMeals(newValidated)
  }

  const handleDeleteMeal = (dayIndex: number, mealIndex: number) => {
    if (!weeklyPlan) return

    const newPlan = {
      ...weeklyPlan,
      days: weeklyPlan.days.map((day, dIdx) => {
        if (dIdx !== dayIndex) return day
        const newMeals = day.meals.filter((_, mIdx) => mIdx !== mealIndex)
        return {
          ...day,
          meals: newMeals,
          totalCalories: newMeals.reduce((sum, m) => sum + m.calories, 0),
        }
      }),
    }
    setWeeklyPlan(newPlan)
    onPlanGenerated?.(newPlan)
  }

  const handleViewRecipe = async (meal: MealPlanMeal, dayIndex: number, mealIndex: number) => {
    setSelectedMeal({ meal, dayIndex, mealIndex })
    setShowRecipeModal(true)
    setRecipeDetails(null)

    const cacheKey = `${dayIndex}-${mealIndex}-${meal.name}`
    if (recipeCache[cacheKey]) {
      setRecipeDetails(recipeCache[cacheKey])
      return
    }

    setIsLoadingRecipe(true)

    try {
      const result = await generateRecipeDetails({
        name: meal.name,
        description: meal.description,
        calories: meal.calories,
        proteins: meal.proteins,
        carbs: meal.carbs,
        fats: meal.fats,
        prepTime: meal.prepTime,
        type: meal.type,
      }, profile || undefined)

      if (result.success && result.recipe) {
        const recipeData: RecipeDetails = {
          ingredients: result.recipe.ingredients || [],
          instructions: result.recipe.instructions || [],
          tips: result.recipe.tips || [],
        }
        setRecipeDetails(recipeData)
        setRecipeCache(prev => ({ ...prev, [cacheKey]: recipeData }))
      } else {
        setRecipeDetails({
          ingredients: [{ name: meal.name.split(' ')[0], quantity: '200', unit: 'g' }],
          instructions: ['Préparer les ingrédients', 'Cuisiner selon les étapes habituelles', 'Servir chaud'],
          tips: ['Recette générée automatiquement'],
        })
      }
    } catch {
      setRecipeDetails({
        ingredients: [{ name: meal.name.split(' ')[0], quantity: '200', unit: 'g' }],
        instructions: ['Erreur lors de la génération de la recette'],
        tips: [],
      })
    } finally {
      setIsLoadingRecipe(false)
    }
  }

  const handleReorderMeals = (dayIndex: number, newOrder: MealPlanMeal[]) => {
    if (!weeklyPlan) return

    const newPlan = {
      ...weeklyPlan,
      days: weeklyPlan.days.map((day, dIdx) => {
        if (dIdx !== dayIndex) return day
        return { ...day, meals: newOrder }
      }),
    }
    setWeeklyPlan(newPlan)
    onPlanGenerated?.(newPlan)
  }

  const handleOpenMoveModal = (meal: MealPlanMeal, fromDayIndex: number, mealIndex: number) => {
    setMealToMove({ meal, fromDayIndex, mealIndex })
    setShowMoveModal(true)
  }

  const handleMoveMeal = (toDayIndex: number) => {
    if (!weeklyPlan || !mealToMove) return

    const { meal, fromDayIndex, mealIndex } = mealToMove

    if (fromDayIndex === toDayIndex) {
      setShowMoveModal(false)
      setMealToMove(null)
      return
    }

    const newPlan = {
      ...weeklyPlan,
      days: weeklyPlan.days.map((day, dIdx) => {
        if (dIdx === fromDayIndex) {
          const newMeals = day.meals.filter((_, mIdx) => mIdx !== mealIndex)
          return {
            ...day,
            meals: newMeals,
            totalCalories: newMeals.reduce((sum, m) => sum + m.calories, 0),
          }
        }
        if (dIdx === toDayIndex) {
          const order: Record<string, number> = { breakfast: 0, lunch: 1, snack: 2, dinner: 3 }
          const newMeals = [...day.meals, meal].sort((a, b) => order[a.type] - order[b.type])
          return {
            ...day,
            meals: newMeals,
            totalCalories: newMeals.reduce((sum, m) => sum + m.calories, 0),
          }
        }
        return day
      }),
    }

    setWeeklyPlan(newPlan)
    onPlanGenerated?.(newPlan)
    setShowMoveModal(false)
    setMealToMove(null)
  }

  const toggleDay = (index: number) => {
    setExpandedDay(expandedDay === index ? null : index)
  }

  const validatedCount = validatedMeals.size
  const totalMeals = weeklyPlan?.days.reduce((sum, day) => sum + day.meals.filter(m => !m.isFasting).length, 0) || 0

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
          <Calendar className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Plan Repas 7 Jours</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Génération automatique adaptée à votre profil
        </p>
      </div>

      {/* Options */}
      {!weeklyPlan && !isGenerating && (
        <div className="bg-[var(--bg-primary)] rounded-2xl p-4 border border-[var(--border-default)] space-y-4">
          <h3 className="font-semibold text-[var(--text-primary)]">Options</h3>

          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🍔</span>
              <div>
                <p className="font-medium text-[var(--text-primary)]">Cheat Meal</p>
                <p className="text-xs text-[var(--text-secondary)]">Un repas plaisir dans la semaine</p>
              </div>
            </div>
            <div
              onClick={() => setIncludeCheatMeal(!includeCheatMeal)}
              className={cn(
                'w-12 h-6 rounded-full transition-colors relative cursor-pointer',
                includeCheatMeal ? 'bg-purple-500' : 'bg-[var(--bg-tertiary)]'
              )}
            >
              <motion.div
                animate={{ x: includeCheatMeal ? 24 : 2 }}
                className="absolute top-1 w-4 h-4 rounded-full bg-white shadow"
              />
            </div>
          </label>

          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 space-y-2">
            <p className="text-xs font-medium text-purple-700 dark:text-purple-300">Basé sur votre profil :</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-purple-600 dark:text-purple-400">
              <span>Calories : {nutritionalNeeds?.calories || 2000} kcal</span>
              <span>Régime : {profile?.dietType || 'Équilibré'}</span>
              <span>Niveau : {profile?.cookingSkillLevel || 'Intermédiaire'}</span>
              {profile?.weeklyBudget && (
                <span>Budget : {profile.weeklyBudget}€/sem</span>
              )}
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold flex items-center justify-center gap-2 shadow-lg"
          >
            <Sparkles className="w-5 h-5" />
            Générer mon plan
          </motion.button>
        </div>
      )}

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 p-4 rounded-xl bg-red-50 text-red-700"
          >
            <AlertCircle className="w-5 h-5" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading state */}
      {isGenerating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-[var(--bg-primary)] rounded-2xl p-8 border border-[var(--border-default)] text-center space-y-4"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto"
          >
            <Utensils className="w-10 h-10 text-white" />
          </motion.div>
          <div>
            <p className="font-semibold text-[var(--text-primary)]">Préparation de vos repas...</p>
            <p className="text-sm text-[var(--text-secondary)]">28 repas pour 7 jours</p>
          </div>
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                className="w-2 h-2 rounded-full bg-purple-500"
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Weekly plan */}
      {weeklyPlan && !isGenerating && (
        <div className="space-y-4">
          {/* Progress bar */}
          <div className="bg-[var(--bg-primary)] rounded-xl p-4 border border-[var(--border-default)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[var(--text-primary)]">Repas validés</span>
              <span className="text-sm text-purple-600 font-semibold">{validatedCount}/{totalMeals}</span>
            </div>
            <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(validatedCount / totalMeals) * 100}%` }}
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setWeeklyPlan(null)
                setShoppingList(null)
                setValidatedMeals(new Set())
              }}
              className="flex-1 py-2.5 rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)] font-medium text-sm flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Nouveau plan
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGenerateShoppingList}
              disabled={isGeneratingShoppingList}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-md"
            >
              {isGeneratingShoppingList ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShoppingCart className="w-4 h-4" />
              )}
              Liste courses
            </motion.button>
          </div>

          {/* Days */}
          <div className="space-y-3">
            {weeklyPlan.days.map((day, dayIndex) => (
              <motion.div
                key={day.day}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: dayIndex * 0.1 }}
                className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-default)] overflow-hidden"
              >
                {/* Day header */}
                <button
                  onClick={() => toggleDay(dayIndex)}
                  className="w-full p-4 flex items-center justify-between hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm',
                        dayIndex >= 5
                          ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white'
                          : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                      )}
                    >
                      {day.day.slice(0, 2)}
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-[var(--text-primary)]">{day.day}</p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {day.totalCalories} kcal - {day.meals.length} repas
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {day.meals.filter((_, mIdx) => validatedMeals.has(`${dayIndex}-${mIdx}`)).length > 0 && (
                      <span className="px-2 py-1 rounded-lg bg-green-100 text-green-600 text-xs font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {day.meals.filter((_, mIdx) => validatedMeals.has(`${dayIndex}-${mIdx}`)).length}
                      </span>
                    )}
                    {day.meals.some((m) => m.isCheatMeal) && (
                      <span className="px-2 py-1 rounded-lg bg-orange-100 text-orange-600 text-xs font-medium">
                        🍔 Cheat
                      </span>
                    )}
                    {expandedDay === dayIndex ? (
                      <ChevronUp className="w-5 h-5 text-[var(--text-tertiary)]" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-[var(--text-tertiary)]" />
                    )}
                  </div>
                </button>

                {/* Day meals */}
                <AnimatePresence>
                  {expandedDay === dayIndex && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-[var(--border-light)] overflow-hidden"
                    >
                      <div className="p-4 space-y-3">
                        <Reorder.Group
                          axis="y"
                          values={day.meals}
                          onReorder={(newOrder) => handleReorderMeals(dayIndex, newOrder)}
                          className="space-y-3"
                        >
                          {day.meals.map((meal, mealIndex) => (
                            <MealCard
                              key={`${meal.type}-${mealIndex}`}
                              meal={meal}
                              isValidated={validatedMeals.has(`${dayIndex}-${mealIndex}`)}
                              onToggleValidation={() => toggleMealValidation(dayIndex, mealIndex)}
                              onDelete={() => handleDeleteMeal(dayIndex, mealIndex)}
                              onViewRecipe={() => handleViewRecipe(meal, dayIndex, mealIndex)}
                              onMove={() => handleOpenMoveModal(meal, dayIndex, mealIndex)}
                            />
                          ))}
                        </Reorder.Group>

                        {day.meals.filter(m => !m.isFasting).length > 0 && (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => validateAllMealsForDay(dayIndex)}
                            className={cn(
                              "w-full py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors",
                              day.meals.filter((_, mIdx) => validatedMeals.has(`${dayIndex}-${mIdx}`) && !day.meals[mIdx].isFasting).length === day.meals.filter(m => !m.isFasting).length
                                ? "bg-green-500 text-white"
                                : "bg-green-50 text-green-600 border border-green-200 hover:bg-green-100"
                            )}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            {day.meals.filter((_, mIdx) => validatedMeals.has(`${dayIndex}-${mIdx}`) && !day.meals[mIdx].isFasting).length === day.meals.filter(m => !m.isFasting).length
                              ? "Tous les repas validés"
                              : `Valider tous les repas (${day.meals.filter(m => !m.isFasting).length})`
                            }
                          </motion.button>
                        )}

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleRegenerateDay(dayIndex)}
                          disabled={isRegenerating === dayIndex}
                          className="w-full py-2 rounded-xl border border-dashed border-purple-200 text-purple-600 font-medium text-sm flex items-center justify-center gap-2 hover:bg-purple-50 transition-colors"
                        >
                          {isRegenerating === dayIndex ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                          Régénérer ce jour
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Recipe Modal */}
      <AnimatePresence>
        {showRecipeModal && selectedMeal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowRecipeModal(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-stone-900 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 border-b border-stone-100 dark:border-stone-800 bg-gradient-to-r from-purple-500 to-pink-500">
                <div className="flex items-start justify-between">
                  <div className="text-white">
                    <div className="flex items-center gap-2 mb-1">
                      <ChefHat className="w-5 h-5" />
                      <span className="text-sm opacity-80">{mealTypeLabels[selectedMeal.meal.type]}</span>
                    </div>
                    <h3 className="font-bold text-lg">{selectedMeal.meal.name}</h3>
                    {selectedMeal.meal.description && (
                      <p className="text-sm opacity-80 mt-1">{selectedMeal.meal.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setShowRecipeModal(false)}
                    className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex gap-2 mt-3 flex-wrap">
                  <span className="px-2 py-1 rounded-lg bg-white/20 text-white text-xs flex items-center gap-1">
                    <Flame className="w-3 h-3" />
                    {selectedMeal.meal.calories} kcal
                  </span>
                  <span className="px-2 py-1 rounded-lg bg-white/20 text-white text-xs flex items-center gap-1">
                    <Beef className="w-3 h-3" />
                    {selectedMeal.meal.proteins}g prot
                  </span>
                  <span className="px-2 py-1 rounded-lg bg-white/20 text-white text-xs flex items-center gap-1">
                    <Wheat className="w-3 h-3" />
                    {selectedMeal.meal.carbs}g gluc
                  </span>
                  <span className="px-2 py-1 rounded-lg bg-white/20 text-white text-xs flex items-center gap-1">
                    <Droplets className="w-3 h-3" />
                    {selectedMeal.meal.fats}g lip
                  </span>
                  <span className="px-2 py-1 rounded-lg bg-white/20 text-white text-xs flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {selectedMeal.meal.prepTime} min
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 overflow-y-auto max-h-[50vh] space-y-4">
                {isLoadingRecipe ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-500 mb-3" />
                    <p className="text-sm text-[var(--text-secondary)]">Chargement de la recette...</p>
                  </div>
                ) : recipeDetails ? (
                  <>
                    <div>
                      <h4 className="font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4 text-green-500" />
                        Ingrédients
                      </h4>
                      <ul className="space-y-1.5">
                        {recipeDetails.ingredients.map((ing, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                            {ing.quantity} {ing.unit} {ing.name}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                        <ChefHat className="w-4 h-4 text-purple-500" />
                        Instructions
                      </h4>
                      <ol className="space-y-2">
                        {recipeDetails.instructions.map((step, idx) => (
                          <li key={idx} className="flex gap-3 text-sm text-[var(--text-secondary)]">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-medium">
                              {idx + 1}
                            </span>
                            <span className="pt-0.5">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {recipeDetails.tips && recipeDetails.tips.length > 0 && (
                      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
                        <h4 className="font-semibold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-2 text-sm">
                          <Info className="w-4 h-4" />
                          Astuces
                        </h4>
                        <ul className="space-y-1">
                          {recipeDetails.tips.map((tip, idx) => (
                            <li key={idx} className="text-xs text-amber-600 dark:text-amber-500">- {tip}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : null}
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-stone-100 dark:border-stone-800 flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    toggleMealValidation(selectedMeal.dayIndex, selectedMeal.mealIndex)
                    setShowRecipeModal(false)
                  }}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2",
                    validatedMeals.has(`${selectedMeal.dayIndex}-${selectedMeal.mealIndex}`)
                      ? "bg-green-500 text-white"
                      : "bg-green-50 text-green-600 border border-green-200"
                  )}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {validatedMeals.has(`${selectedMeal.dayIndex}-${selectedMeal.mealIndex}`) ? 'Validé' : 'Valider ce repas'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shopping list modal */}
      <AnimatePresence>
        {showShoppingList && shoppingList && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowShoppingList(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-stone-900 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden"
            >
              <div className="p-4 border-b border-stone-100 dark:border-stone-800 bg-gradient-to-r from-green-500 to-emerald-500">
                <div className="flex items-start justify-between">
                  <div className="text-white">
                    <div className="flex items-center gap-2 mb-1">
                      <ShoppingCart className="w-5 h-5" />
                      <span className="text-sm opacity-80">Liste de courses</span>
                    </div>
                    <h3 className="font-bold text-2xl flex items-center gap-1">
                      <Euro className="w-6 h-6" />
                      {shoppingList.totalEstimate?.toFixed(2) || '0.00'}
                    </h3>
                    <p className="text-sm opacity-80">Estimation totale</p>
                  </div>
                  <button
                    onClick={() => setShowShoppingList(false)}
                    className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {profile?.weeklyBudget && (
                  <div className="mt-3 bg-white/20 rounded-lg p-2">
                    <div className="flex items-center justify-between text-white text-sm">
                      <span>Votre budget</span>
                      <span className="font-semibold">{profile.weeklyBudget}€</span>
                    </div>
                    <div className="flex items-center justify-between text-white text-sm mt-1">
                      <span>Différence</span>
                      <span className={cn(
                        "font-semibold flex items-center gap-1",
                        (shoppingList.totalEstimate || 0) <= profile.weeklyBudget ? "text-green-200" : "text-red-200"
                      )}>
                        {(shoppingList.totalEstimate || 0) <= profile.weeklyBudget ? (
                          <>
                            <TrendingDown className="w-4 h-4" />
                            -{(profile.weeklyBudget - (shoppingList.totalEstimate || 0)).toFixed(2)}€
                          </>
                        ) : (
                          <>+{((shoppingList.totalEstimate || 0) - profile.weeklyBudget).toFixed(2)}€</>
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 overflow-y-auto max-h-[55vh] space-y-4">
                {shoppingList.categories?.map((cat, idx) => (
                  <div key={idx}>
                    <h4 className="font-semibold text-[var(--text-primary)] mb-2 flex items-center justify-between">
                      <span>{cat.name}</span>
                      <span className="text-sm text-green-600 font-medium">{cat.subtotal?.toFixed(2)}€</span>
                    </h4>
                    <ul className="space-y-1.5">
                      {cat.items?.map((item, iIdx) => (
                        <li key={iIdx} className="text-sm text-[var(--text-secondary)] flex items-center justify-between bg-[var(--bg-secondary)] rounded-lg px-3 py-2">
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-400" />
                            <span className="font-medium">{item.name}</span>
                            <span className="text-[var(--text-tertiary)]">({item.quantity})</span>
                          </span>
                          <span className="text-[var(--text-tertiary)]">{item.priceEstimate?.toFixed(2)}€</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                {shoppingList.savingsTips && shoppingList.savingsTips.length > 0 && (
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3">
                    <h5 className="font-medium text-green-700 dark:text-green-400 mb-2 flex items-center gap-2">
                      <TrendingDown className="w-4 h-4" />
                      Astuces économies
                    </h5>
                    <ul className="space-y-1">
                      {shoppingList.savingsTips.map((tip, idx) => (
                        <li key={idx} className="text-sm text-green-600 dark:text-green-500 flex items-start gap-2">
                          <ArrowRight className="w-3 h-3 mt-1 flex-shrink-0" />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Move meal modal */}
      <AnimatePresence>
        {showMoveModal && mealToMove && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => {
              setShowMoveModal(false)
              setMealToMove(null)
            }}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-stone-900 rounded-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-4 border-b border-stone-100 dark:border-stone-800 bg-gradient-to-r from-blue-500 to-indigo-500">
                <div className="flex items-start justify-between">
                  <div className="text-white">
                    <div className="flex items-center gap-2 mb-1">
                      <ArrowRightLeft className="w-5 h-5" />
                      <span className="text-sm opacity-80">Déplacer le repas</span>
                    </div>
                    <h3 className="font-bold text-lg">{mealToMove.meal.name}</h3>
                    <p className="text-sm opacity-80">
                      Depuis {dayLabels[mealToMove.fromDayIndex]}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowMoveModal(false)
                      setMealToMove(null)
                    }}
                    className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-4">
                <p className="text-sm text-[var(--text-secondary)] mb-3">Choisissez le jour de destination :</p>
                <div className="grid grid-cols-2 gap-2">
                  {dayLabels.map((day, index) => (
                    <motion.button
                      key={day}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleMoveMeal(index)}
                      disabled={index === mealToMove.fromDayIndex}
                      className={cn(
                        "py-3 px-4 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2",
                        index === mealToMove.fromDayIndex
                          ? "bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] cursor-not-allowed"
                          : index >= 5
                            ? "bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 text-purple-700 dark:text-purple-300 hover:from-purple-200 hover:to-pink-200"
                            : "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100"
                      )}
                    >
                      <span className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs",
                        index >= 5 ? "bg-purple-200 dark:bg-purple-800" : "bg-blue-200 dark:bg-blue-800"
                      )}>
                        {day.slice(0, 2)}
                      </span>
                      {day}
                      {index === mealToMove.fromDayIndex && (
                        <span className="text-xs">(actuel)</span>
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="p-4 border-t border-stone-100 dark:border-stone-800">
                <button
                  onClick={() => {
                    setShowMoveModal(false)
                    setMealToMove(null)
                  }}
                  className="w-full py-2.5 rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)] font-medium text-sm"
                >
                  Annuler
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Meal card component
interface MealCardProps {
  meal: MealPlanMeal
  isValidated: boolean
  onToggleValidation: () => void
  onDelete: () => void
  onViewRecipe: () => void
  onMove: () => void
}

function MealCard({ meal, isValidated, onToggleValidation, onDelete, onViewRecipe, onMove }: MealCardProps) {
  return (
    <Reorder.Item
      value={meal}
      className={cn(
        'p-3 rounded-xl border cursor-grab active:cursor-grabbing',
        meal.isFasting
          ? 'bg-[var(--bg-secondary)] border-[var(--border-default)]'
          : meal.isCheatMeal
            ? 'bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-orange-200 dark:border-orange-800'
            : isValidated
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-[var(--bg-primary)] border-[var(--border-light)]'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="text-[var(--text-tertiary)] cursor-grab active:cursor-grabbing pt-1">
          <GripVertical className="w-4 h-4" />
        </div>

        <div className="text-2xl">{mealTypeEmojis[meal.type]}</div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-[var(--text-primary)] text-sm truncate">{meal.name}</p>
            {meal.isCheatMeal && <Cookie className="w-4 h-4 text-orange-500" />}
            {isValidated && <CheckCircle2 className="w-4 h-4 text-green-500" />}
          </div>
          <p className="text-xs text-[var(--text-tertiary)]">{mealTypeLabels[meal.type]}</p>
          {meal.description && (
            <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-1">{meal.description}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="text-right">
            <p className="text-sm font-semibold text-purple-600">{meal.calories} kcal</p>
            {!meal.isFasting && (
              <p className="text-xs text-[var(--text-tertiary)] flex items-center gap-1 justify-end">
                <Clock className="w-3 h-3" />
                {meal.prepTime} min
              </p>
            )}
          </div>

          {!meal.isFasting && (
            <div className="flex items-center gap-1">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation()
                  onViewRecipe()
                }}
                className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center"
                title="Voir la recette"
              >
                <ChefHat className="w-3.5 h-3.5" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation()
                  onMove()
                }}
                className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center"
                title="Déplacer vers un autre jour"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleValidation()
                }}
                className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center",
                  isValidated ? "bg-green-500 text-white" : "bg-green-100 dark:bg-green-900/30 text-green-600"
                )}
                title={isValidated ? "Repas validé" : "Valider ce repas"}
              >
                {isValidated ? <Check className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
                className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center"
                title="Supprimer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </motion.button>
            </div>
          )}
        </div>
      </div>
    </Reorder.Item>
  )
}

export default WeeklyPlanGenerator
