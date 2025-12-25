'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Plus, Calendar, Pencil, X, Check, Minus } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageContainer, Section } from '@/components/layout/page-container'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NutritionOverviewCompact } from '@/components/dashboard/nutrition-overview'
import { cn, formatNumber, isToday } from '@/lib/utils'
import { useMealsStore } from '@/stores/meals-store'
import type { MealType, MealItem, Meal } from '@/types'

type ServingUnit = 'g' | 'ml' | 'unit' | 'portion'

// Available units for selection
const availableUnits: { id: ServingUnit; label: string; shortLabel: string }[] = [
  { id: 'g', label: 'Grammes', shortLabel: 'g' },
  { id: 'ml', label: 'Millilitres', shortLabel: 'ml' },
  { id: 'unit', label: 'Unité(s)', shortLabel: 'unité' },
  { id: 'portion', label: 'Portion(s)', shortLabel: 'portion' },
]

// Get unit label for display
function getUnitLabel(unit: string): string {
  switch (unit) {
    case 'g': return 'g'
    case 'ml': return 'ml'
    case 'unit': return 'unité(s)'
    case 'portion': return 'portion(s)'
    default: return unit
  }
}

// Get default quantity increments based on unit
function getQuantityStep(unit: string): number {
  switch (unit) {
    case 'g': return 10
    case 'ml': return 25
    case 'unit': return 1
    case 'portion': return 0.5
    default: return 10
  }
}

// Get default quantity based on unit
function getDefaultQuantity(unit: string): number {
  switch (unit) {
    case 'g': return 100
    case 'ml': return 200
    case 'unit': return 1
    case 'portion': return 1
    default: return 100
  }
}

// Edit modal state
interface EditModalState {
  isOpen: boolean
  mealId: string | null
  item: MealItem | null
  quantity: number
  unit: ServingUnit
}

const mealConfig: Record<MealType, { label: string; icon: string; time: string }> = {
  breakfast: { label: 'Petit-déjeuner', icon: '☀️', time: '08:30' },
  lunch: { label: 'Déjeuner', icon: '🍽️', time: '12:30' },
  snack: { label: 'Collation', icon: '🍎', time: '16:00' },
  dinner: { label: 'Dîner', icon: '🌙', time: '19:30' },
}

// Generate days for the date selector
const generateDays = (centerDate: Date) => {
  const days = []
  for (let i = -3; i <= 3; i++) {
    const date = new Date(centerDate)
    date.setDate(date.getDate() + i)
    days.push({ date })
  }
  return days
}

export default function MealsPage() {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = React.useState(new Date())
  const [isEditing, setIsEditing] = React.useState(false)
  const [isHydrated, setIsHydrated] = React.useState(false)
  const [editModal, setEditModal] = React.useState<EditModalState>({
    isOpen: false,
    mealId: null,
    item: null,
    quantity: 100,
    unit: 'g',
  })

  const { getMealsForDate, getMealsByType, deleteMeal, removeItemFromMeal, updateItemQuantity } = useMealsStore()

  // Handle hydration
  React.useEffect(() => {
    setIsHydrated(true)
  }, [])

  // Format date as YYYY-MM-DD for store
  const dateKey = selectedDate.toISOString().split('T')[0]
  const mealsForDate = isHydrated ? getMealsForDate(dateKey) : []

  // Calculate nutrition totals from actual meals
  const nutritionTotals = React.useMemo(() => {
    let calories = 0, proteins = 0, carbs = 0, fats = 0
    mealsForDate.forEach(meal => {
      calories += meal.totalNutrition.calories
      proteins += meal.totalNutrition.proteins
      carbs += meal.totalNutrition.carbs
      fats += meal.totalNutrition.fats
    })
    return { calories, proteins, carbs, fats }
  }, [mealsForDate])

  const nutritionData = {
    calories: { current: Math.round(nutritionTotals.calories), target: 2100 },
    proteins: { current: Math.round(nutritionTotals.proteins), target: 130 },
    carbs: { current: Math.round(nutritionTotals.carbs), target: 250 },
    fats: { current: Math.round(nutritionTotals.fats), target: 70 },
  }

  const navigateDay = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1))
    setSelectedDate(newDate)
  }

  // Get meal data for a specific type
  const getMealDataForType = (type: MealType) => {
    if (!isHydrated) {
      return { logged: false, time: undefined, calories: undefined, items: undefined, meal: undefined, nutrition: undefined }
    }
    const meals = getMealsByType(dateKey, type)
    if (meals.length === 0) {
      return { logged: false, time: undefined, calories: undefined, items: undefined, meal: undefined, nutrition: undefined }
    }
    const meal = meals[0]
    return {
      logged: true,
      time: new Date(meal.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      calories: Math.round(meal.totalNutrition.calories),
      items: meal.items.map(item => {
        // Calculate actual quantity (multiplier × serving size)
        const actualQuantity = Math.round(item.quantity * item.food.serving)
        const unit = item.food.servingUnit || 'g'
        const unitLabel = unit === 'unit' ? 'unité(s)' : unit === 'portion' ? 'portion(s)' : unit

        return {
          id: item.id,
          name: item.food.name,
          quantity: item.quantity,
          actualQuantity,
          unit,
          unitLabel,
          serving: item.food.serving,
          calories: Math.round(item.food.nutrition.calories * item.quantity),
          proteins: Math.round(item.food.nutrition.proteins * item.quantity * 10) / 10,
          carbs: Math.round(item.food.nutrition.carbs * item.quantity * 10) / 10,
          fats: Math.round(item.food.nutrition.fats * item.quantity * 10) / 10,
        }
      }),
      meal,
      nutrition: {
        proteins: Math.round(meal.totalNutrition.proteins),
        carbs: Math.round(meal.totalNutrition.carbs),
        fats: Math.round(meal.totalNutrition.fats),
      },
    }
  }

  const handleRemoveItem = (mealId: string, itemId: string) => {
    removeItemFromMeal(mealId, itemId)
  }

  const handleDeleteMeal = (mealId: string) => {
    deleteMeal(mealId, dateKey)
  }

  // Open edit modal for an item
  const openEditModal = (meal: Meal, item: MealItem) => {
    const currentUnit = (item.food.servingUnit || 'g') as ServingUnit
    // Calculate current quantity based on unit
    let displayQuantity = item.quantity
    if (currentUnit === 'g' || currentUnit === 'ml') {
      displayQuantity = Math.round(item.quantity * (item.food.serving || 100))
    }
    setEditModal({
      isOpen: true,
      mealId: meal.id,
      item,
      quantity: displayQuantity,
      unit: currentUnit,
    })
  }

  // Close edit modal
  const closeEditModal = () => {
    setEditModal({
      isOpen: false,
      mealId: null,
      item: null,
      quantity: 100,
      unit: 'g',
    })
  }

  // Change unit in modal
  const changeUnit = (newUnit: ServingUnit) => {
    const newQty = getDefaultQuantity(newUnit)
    setEditModal(prev => ({ ...prev, unit: newUnit, quantity: newQty }))
  }

  // Adjust quantity
  const adjustQuantity = (delta: number) => {
    const step = getQuantityStep(editModal.unit)
    const newQty = Math.max(step, editModal.quantity + delta * step)
    setEditModal(prev => ({ ...prev, quantity: newQty }))
  }

  // Set quantity directly
  const setQuantity = (qty: number) => {
    setEditModal(prev => ({ ...prev, quantity: Math.max(1, qty) }))
  }

  // Calculate nutrition for the selected quantity and unit
  const calculateNutrition = (item: MealItem, quantity: number, unit: ServingUnit) => {
    const food = item.food
    let gramsEquivalent = quantity
    if (unit === 'ml') {
      gramsEquivalent = quantity
    } else if (unit === 'unit' || unit === 'portion') {
      gramsEquivalent = quantity * (food.serving || 100)
    }

    const multiplier = gramsEquivalent / 100
    return {
      calories: Math.round(food.nutrition.calories * multiplier),
      proteins: Math.round(food.nutrition.proteins * multiplier * 10) / 10,
      carbs: Math.round(food.nutrition.carbs * multiplier * 10) / 10,
      fats: Math.round(food.nutrition.fats * multiplier * 10) / 10,
    }
  }

  // Confirm edit
  const confirmEdit = () => {
    if (!editModal.mealId || !editModal.item) return

    const { quantity, unit } = editModal
    let quantityMultiplier = quantity / 100
    if (unit === 'unit' || unit === 'portion') {
      quantityMultiplier = quantity
    }

    updateItemQuantity(editModal.mealId, editModal.item.id, quantityMultiplier, unit)
    closeEditModal()
  }

  const days = generateDays(new Date())

  return (
    <>
      <Header
        title="Journal des repas"
        showBack
        backHref="/"
        rightContent={
          <div className="flex gap-2">
            <Button
              variant={isEditing ? "default" : "ghost"}
              size="icon-sm"
              onClick={() => setIsEditing(!isEditing)}
              className={isEditing ? "bg-[var(--accent-primary)]" : ""}
            >
              {isEditing ? <Check className="h-5 w-5" /> : <Pencil className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon-sm">
              <Calendar className="h-5 w-5" />
            </Button>
          </div>
        }
      />

      <PageContainer>
        {/* Date selector */}
        <Section>
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigateDay('prev')}
              className="p-2 rounded-full hover:bg-[var(--bg-secondary)] transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-[var(--text-secondary)]" />
            </button>

            <div className="flex gap-2 overflow-x-auto scrollbar-hide px-2">
              {days.map((day, index) => {
                const isSelected = day.date.toDateString() === selectedDate.toDateString()
                const isTodayDate = isToday(day.date)

                return (
                  <button
                    key={index}
                    onClick={() => setSelectedDate(day.date)}
                    className={`flex flex-col items-center px-3 py-2 rounded-xl min-w-[52px] transition-all ${
                      isSelected
                        ? 'bg-[var(--accent-primary)] text-white'
                        : 'hover:bg-[var(--bg-secondary)]'
                    }`}
                  >
                    <span className={`text-xs ${isSelected ? 'text-white/80' : 'text-[var(--text-tertiary)]'}`}>
                      {day.date.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3)}
                    </span>
                    <span className={`text-lg font-semibold ${isSelected ? '' : 'text-[var(--text-primary)]'}`}>
                      {day.date.getDate()}
                    </span>
                    {isTodayDate && !isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] mt-0.5" />
                    )}
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => navigateDay('next')}
              className="p-2 rounded-full hover:bg-[var(--bg-secondary)] transition-colors"
            >
              <ChevronRight className="h-5 w-5 text-[var(--text-secondary)]" />
            </button>
          </div>
        </Section>

        {/* Daily nutrition summary */}
        <Section>
          <NutritionOverviewCompact data={nutritionData} />
        </Section>

        {/* Edit mode banner */}
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 rounded-xl p-3 mb-4 flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-[var(--accent-primary)] flex items-center justify-center">
              <Pencil className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-[var(--text-primary)]">Mode édition</p>
              <p className="text-sm text-[var(--text-secondary)]">Appuyez sur X pour supprimer</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(false)}
            >
              Terminer
            </Button>
          </motion.div>
        )}

        {/* Meals list */}
        <Section title="Repas du jour">
          <div className="space-y-4">
            {(Object.keys(mealConfig) as MealType[]).map((type, index) => {
              const config = mealConfig[type]
              const mealData = getMealDataForType(type)

              return (
                <motion.div
                  key={type}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card padding="default">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-3">
                      {/* Delete meal button in edit mode */}
                      {isEditing && mealData.logged && mealData.meal && (
                        <motion.button
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          onClick={() => handleDeleteMeal(mealData.meal!.id)}
                          className="p-2 text-white bg-[var(--error)] hover:bg-[var(--error)]/80 rounded-full shadow-sm"
                        >
                          <X className="h-4 w-4" />
                        </motion.button>
                      )}

                      <div className="text-2xl">{config.icon}</div>

                      <div className="flex-1">
                        <h3 className="font-semibold text-[var(--text-primary)]">
                          {config.label}
                        </h3>
                        {mealData.logged && mealData.time && (
                          <p className="text-xs text-[var(--text-tertiary)]">{mealData.time}</p>
                        )}
                      </div>

                      {/* Add button - always visible */}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/meals/add?type=${type}`)
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Food items list */}
                    {mealData.logged && mealData.items && mealData.items.length > 0 ? (
                      <div className="space-y-2">
                        {mealData.meal && mealData.meal.items.map((mealItem, itemIndex) => {
                          const item = mealData.items![itemIndex]
                          return (
                          <button
                            key={item.id}
                            onClick={() => !isEditing && mealData.meal && openEditModal(mealData.meal, mealItem)}
                            className={cn(
                              "flex items-center gap-3 p-2 rounded-lg bg-[var(--bg-secondary)] transition-colors w-full text-left",
                              !isEditing && "hover:bg-[var(--bg-tertiary)] active:scale-[0.98] cursor-pointer"
                            )}
                          >
                            {isEditing && mealData.meal && (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRemoveItem(mealData.meal!.id, item.id)
                                }}
                                className="p-1 text-[var(--error)] hover:bg-[var(--error)]/10 rounded-full flex-shrink-0"
                              >
                                <X className="h-4 w-4" />
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-[var(--text-primary)] truncate">
                                {item.name}
                              </p>
                              <p className="text-xs text-[var(--text-tertiary)]">
                                {item.actualQuantity} {item.unitLabel}
                              </p>
                            </div>

                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-semibold text-[var(--calories)]">
                                {formatNumber(item.calories)} kcal
                              </p>
                              <p className="text-[10px] text-[var(--text-tertiary)]">
                                P {item.proteins}g · G {item.carbs}g · L {item.fats}g
                              </p>
                            </div>
                          </button>
                        )})}

                        {/* Meal total */}
                        <div className="flex items-center justify-between pt-2 mt-2 border-t border-[var(--border-light)]">
                          <span className="text-sm font-medium text-[var(--text-secondary)]">Total</span>
                          <div className="text-right">
                            <span className="text-sm font-bold text-[var(--text-primary)]">
                              {formatNumber(mealData.calories || 0)} kcal
                            </span>
                            {mealData.nutrition && (
                              <p className="text-[10px] text-[var(--text-tertiary)]">
                                P {mealData.nutrition.proteins}g · G {mealData.nutrition.carbs}g · L {mealData.nutrition.fats}g
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-4 text-center">
                        <p className="text-sm text-[var(--text-tertiary)]">
                          Aucun aliment enregistré
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)] mt-1">
                          Heure suggérée : {config.time}
                        </p>
                      </div>
                    )}
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </Section>

        {/* Add meal FAB */}
        <Button
          variant="default"
          size="lg"
          className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg z-40"
          onClick={() => router.push('/meals/add')}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </PageContainer>

      {/* Edit quantity modal */}
      <AnimatePresence>
        {editModal.isOpen && editModal.item && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeEditModal}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-primary)] rounded-t-2xl safe-area-inset max-h-[85vh] overflow-y-auto"
            >
              {/* Handle bar */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-[var(--border-default)]" />
              </div>

              <div className="px-5 pb-6">
                {/* Header with food info */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-12 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center flex-shrink-0">
                    <span className="text-xl">🍽️</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[var(--text-primary)] truncate text-base">
                      {editModal.item.food.name}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      Modifier la quantité
                    </p>
                  </div>
                  <button
                    onClick={closeEditModal}
                    className="p-2 -mr-2 hover:bg-[var(--bg-secondary)] rounded-full transition-colors"
                  >
                    <X className="h-5 w-5 text-[var(--text-tertiary)]" />
                  </button>
                </div>

                {/* Unit selector */}
                <div className="mb-5">
                  <p className="text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
                    Unité de mesure
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {availableUnits.map((unit) => (
                      <button
                        key={unit.id}
                        onClick={() => changeUnit(unit.id)}
                        className={cn(
                          "py-2.5 px-2 rounded-xl text-sm font-medium transition-all",
                          editModal.unit === unit.id
                            ? "bg-[var(--accent-primary)] text-white shadow-sm"
                            : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                        )}
                      >
                        {unit.shortLabel}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quantity input */}
                <div className="mb-5">
                  <p className="text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
                    Quantité
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => adjustQuantity(-1)}
                      className="w-12 h-12 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] flex items-center justify-center transition-colors active:scale-95"
                    >
                      <Minus className="h-5 w-5 text-[var(--text-primary)]" />
                    </button>

                    <div className="flex-1 relative">
                      <input
                        type="number"
                        value={editModal.quantity}
                        onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                        className="w-full h-12 text-center text-2xl font-bold bg-[var(--bg-secondary)] rounded-xl border-2 border-transparent focus:border-[var(--accent-primary)] focus:outline-none text-[var(--text-primary)] transition-colors"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-tertiary)]">
                        {getUnitLabel(editModal.unit)}
                      </span>
                    </div>

                    <button
                      onClick={() => adjustQuantity(1)}
                      className="w-12 h-12 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] flex items-center justify-center transition-colors active:scale-95"
                    >
                      <Plus className="h-5 w-5 text-[var(--text-primary)]" />
                    </button>
                  </div>
                </div>

                {/* Quick quantity presets */}
                <div className="flex gap-2 mb-5 overflow-x-auto scrollbar-hide -mx-1 px-1">
                  {(() => {
                    const unit = editModal.unit
                    const presets = unit === 'ml'
                      ? [100, 150, 200, 250, 330, 500]
                      : unit === 'unit' || unit === 'portion'
                      ? [1, 2, 3, 4, 5, 6]
                      : [25, 50, 100, 150, 200, 300]

                    return presets.map(qty => (
                      <button
                        key={qty}
                        onClick={() => setQuantity(qty)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex-shrink-0",
                          editModal.quantity === qty
                            ? "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]"
                            : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                        )}
                      >
                        {qty}
                      </button>
                    ))
                  })()}
                </div>

                {/* Calculated nutrition */}
                {(() => {
                  const nutrition = calculateNutrition(editModal.item, editModal.quantity, editModal.unit)
                  return (
                    <div className="grid grid-cols-4 gap-1 mb-5 p-3 rounded-xl bg-[var(--bg-secondary)]">
                      <div className="text-center">
                        <p className="text-base font-bold text-[var(--calories)]">
                          {formatNumber(nutrition.calories)}
                        </p>
                        <p className="text-[10px] text-[var(--text-tertiary)] uppercase">kcal</p>
                      </div>
                      <div className="text-center">
                        <p className="text-base font-bold text-[var(--proteins)]">
                          {nutrition.proteins}g
                        </p>
                        <p className="text-[10px] text-[var(--text-tertiary)] uppercase">Prot.</p>
                      </div>
                      <div className="text-center">
                        <p className="text-base font-bold text-[var(--carbs)]">
                          {nutrition.carbs}g
                        </p>
                        <p className="text-[10px] text-[var(--text-tertiary)] uppercase">Gluc.</p>
                      </div>
                      <div className="text-center">
                        <p className="text-base font-bold text-[var(--fats)]">
                          {nutrition.fats}g
                        </p>
                        <p className="text-[10px] text-[var(--text-tertiary)] uppercase">Lip.</p>
                      </div>
                    </div>
                  )
                })()}

                {/* Confirm button */}
                <Button
                  variant="default"
                  size="lg"
                  onClick={confirmEdit}
                  className="w-full h-12"
                >
                  <Check className="h-5 w-5 mr-2" />
                  Enregistrer
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
