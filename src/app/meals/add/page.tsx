'use client'

import * as React from 'react'
import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Camera,
  Mic,
  Barcode,
  Sparkles,
  Star,
  Plus,
  Minus,
  Loader2,
  Apple,
  ShoppingBag,
  Check,
  X,
  ArrowLeft,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageContainer, Section } from '@/components/layout/page-container'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn, formatNumber } from '@/lib/utils'
import { useMealsStore } from '@/stores'
import { useFoodSearch, type FoodSource, type FoodProduct, type ServingUnit } from '@/hooks/use-food-search'
import { PhotoFoodScanner } from '@/components/features/scanner/PhotoFoodScanner'
import { VoiceFoodInput } from '@/components/features/voice/VoiceFoodInput'
import { BarcodeScanner } from '@/components/features/barcode/BarcodeScanner'
import { AIMealGenerator } from '@/components/features/ai/AIMealGenerator'
import type { MealType, FoodItem } from '@/types'

const mealTypes: { id: MealType; label: string; icon: string }[] = [
  { id: 'breakfast', label: 'Petit-déj', icon: '☀️' },
  { id: 'lunch', label: 'Déjeuner', icon: '🍽️' },
  { id: 'snack', label: 'Collation', icon: '🍎' },
  { id: 'dinner', label: 'Dîner', icon: '🌙' },
]

const inputMethods = [
  { id: 'search', label: 'Rechercher', icon: Search, color: 'text-blue-500', bgColor: 'bg-blue-50' },
  { id: 'photo', label: 'Photo', icon: Camera, color: 'text-rose-500', bgColor: 'bg-rose-50' },
  { id: 'voice', label: 'Vocal', icon: Mic, color: 'text-purple-500', bgColor: 'bg-purple-50' },
  { id: 'barcode', label: 'Code-barres', icon: Barcode, color: 'text-emerald-500', bgColor: 'bg-emerald-50' },
  { id: 'ai', label: 'IA', icon: Sparkles, color: 'text-amber-500', bgColor: 'bg-amber-50' },
]

const sourceFilters: { id: FoodSource; label: string; icon: typeof Apple; description: string }[] = [
  { id: 'all', label: 'Tout', icon: Search, description: 'Générique + Marques' },
  { id: 'generic', label: 'Générique', icon: Apple, description: 'Aliments de référence (CIQUAL)' },
  { id: 'branded', label: 'Marques', icon: ShoppingBag, description: 'Produits industriels' },
]

type InputMethod = 'method' | 'search' | 'photo' | 'voice' | 'barcode' | 'ai'

// Get unit label for display
function getUnitLabel(unit: ServingUnit | string): string {
  switch (unit) {
    case 'g': return 'g'
    case 'ml': return 'ml'
    case 'unit': return 'unité(s)'
    case 'portion': return 'portion(s)'
    default: return unit
  }
}

// Get default quantity increments based on unit
function getQuantityStep(unit: ServingUnit | string): number {
  switch (unit) {
    case 'g': return 10
    case 'ml': return 25
    case 'unit': return 1
    case 'portion': return 0.5
    default: return 10
  }
}

// Get default quantity based on unit
function getDefaultQuantity(unit: ServingUnit | string): number {
  switch (unit) {
    case 'g': return 100
    case 'ml': return 200
    case 'unit': return 1
    case 'portion': return 1
    default: return 100
  }
}

// Convert FoodProduct to FoodItem
function toFoodItem(product: FoodProduct): FoodItem {
  return {
    id: product.id,
    name: product.name,
    brand: product.brand,
    serving: product.servingSize || 100,
    servingUnit: product.servingUnit || 'g',
    nutrition: {
      calories: product.nutrition.calories,
      proteins: product.nutrition.proteins,
      carbs: product.nutrition.carbs,
      fats: product.nutrition.fats,
      fiber: product.nutrition.fiber ?? undefined,
      sugar: product.nutrition.sugar ?? undefined,
      sodium: product.nutrition.sodium ?? undefined,
      saturatedFat: product.nutrition.saturatedFat ?? undefined,
    },
    imageUrl: product.imageUrl ?? undefined,
    source: product.source,
  }
}

// Available units for selection
const availableUnits: { id: ServingUnit | 'portion'; label: string; shortLabel: string }[] = [
  { id: 'g', label: 'Grammes', shortLabel: 'g' },
  { id: 'ml', label: 'Millilitres', shortLabel: 'ml' },
  { id: 'unit', label: 'Unité(s)', shortLabel: 'unité' },
  { id: 'portion', label: 'Portion(s)', shortLabel: 'portion' },
]

// Quantity selector modal state
interface QuantityModalState {
  isOpen: boolean
  food: FoodItem | null
  quantity: number
  unit: ServingUnit | 'portion'
}

function AddMealContent({ initialType }: { initialType: MealType }) {
  const router = useRouter()
  const { addFoodToMeal, recentFoods, favoriteFoods, addToFavorites, removeFromFavorites, currentDate } = useMealsStore()
  const { products, isLoading, isLoadingMore, error, search, clear } = useFoodSearch()

  const [activeMethod, setActiveMethod] = React.useState<InputMethod>('method')
  const [selectedType, setSelectedType] = React.useState<MealType>(initialType)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedSource, setSelectedSource] = React.useState<FoodSource>('all')
  const [addedFoodIds, setAddedFoodIds] = React.useState<Set<string>>(new Set())
  const [quantityModal, setQuantityModal] = React.useState<QuantityModalState>({
    isOpen: false,
    food: null,
    quantity: 100,
    unit: 'g',
  })

  // Debounced search
  const searchTimeoutRef = React.useRef<NodeJS.Timeout>()

  React.useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (searchQuery.length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        search({ query: searchQuery, source: selectedSource, limit: 20 })
      }, 300)
    } else {
      clear()
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, selectedSource, search, clear])

  // Convert products to FoodItems for display
  const searchResults = React.useMemo(() => products.map(toFoodItem), [products])

  const handleMethodSelect = (methodId: string) => {
    setActiveMethod(methodId as InputMethod)
  }

  const handleBack = () => {
    if (activeMethod !== 'method') {
      setActiveMethod('method')
    } else {
      router.push('/meals')
    }
  }

  // Handle food detected from AI features (photo, voice, AI generator)
  const handleFoodsDetected = (foods: FoodItem[]) => {
    foods.forEach(food => {
      addFoodToMeal(food, selectedType, currentDate, 1)
      setAddedFoodIds(prev => new Set(prev).add(food.id))
    })

    // Clear added feedback after 2s
    setTimeout(() => {
      setAddedFoodIds(new Set())
    }, 2000)
  }

  // Handle single food from barcode
  const handleProductFound = (food: FoodItem) => {
    openQuantityModal(food)
  }

  // Handle recipe from AI generator
  const handleRecipeGenerated = (food: FoodItem) => {
    addFoodToMeal(food, selectedType, currentDate, 1)
    setAddedFoodIds(prev => new Set(prev).add(food.id))
    setTimeout(() => {
      setAddedFoodIds(prev => {
        const next = new Set(prev)
        next.delete(food.id)
        return next
      })
    }, 2000)
  }

  // Open quantity modal for a food item
  const openQuantityModal = (food: FoodItem) => {
    const defaultUnit = 'g' as ServingUnit
    const defaultQty = getDefaultQuantity(defaultUnit)
    setQuantityModal({
      isOpen: true,
      food,
      quantity: defaultQty,
      unit: defaultUnit,
    })
  }

  // Close quantity modal
  const closeQuantityModal = () => {
    setQuantityModal({
      isOpen: false,
      food: null,
      quantity: 100,
      unit: 'g',
    })
  }

  // Change unit and adjust quantity accordingly
  const changeUnit = (newUnit: ServingUnit | 'portion') => {
    const newQty = getDefaultQuantity(newUnit)
    setQuantityModal(prev => ({ ...prev, unit: newUnit, quantity: newQty }))
  }

  // Adjust quantity in modal
  const adjustQuantity = (delta: number) => {
    const step = getQuantityStep(quantityModal.unit)
    const newQty = Math.max(step, quantityModal.quantity + delta * step)
    setQuantityModal(prev => ({ ...prev, quantity: newQty }))
  }

  // Set quantity directly
  const setQuantity = (qty: number) => {
    setQuantityModal(prev => ({ ...prev, quantity: Math.max(1, qty) }))
  }

  // Calculate nutrition for the selected quantity and unit
  const calculateNutrition = (food: FoodItem, quantity: number, unit: ServingUnit | 'portion') => {
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

  // Confirm and add the food with selected quantity
  const confirmAddFood = () => {
    if (!quantityModal.food) return

    const food = quantityModal.food
    const { quantity, unit } = quantityModal

    let quantityMultiplier = quantity / 100
    if (unit === 'unit' || unit === 'portion') {
      quantityMultiplier = quantity
    }

    const updatedFood = { ...food, servingUnit: unit }
    addFoodToMeal(updatedFood, selectedType, currentDate, quantityMultiplier)
    setAddedFoodIds(prev => new Set(prev).add(food.id))
    closeQuantityModal()

    setTimeout(() => {
      setAddedFoodIds(prev => {
        const next = new Set(prev)
        next.delete(food.id)
        return next
      })
    }, 2000)
  }

  const isFavorite = (foodId: string) => favoriteFoods.some((f) => f.id === foodId)
  const isAdded = (foodId: string) => addedFoodIds.has(foodId)

  const getMethodTitle = () => {
    switch (activeMethod) {
      case 'search': return 'Rechercher un aliment'
      case 'photo': return 'Scanner votre repas'
      case 'voice': return 'Dictée vocale'
      case 'barcode': return 'Scanner code-barres'
      case 'ai': return 'Générer une recette IA'
      default: return 'Ajouter un repas'
    }
  }

  return (
    <>
      <Header
        title={getMethodTitle()}
        showBack
        backHref={activeMethod === 'method' ? '/meals' : undefined}
        onBack={activeMethod !== 'method' ? handleBack : undefined}
      />

      <PageContainer className="pb-32">
        {/* Meal type selector */}
        <Section>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
            {mealTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all',
                  selectedType === type.id
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                )}
              >
                <span>{type.icon}</span>
                <span className="font-medium">{type.label}</span>
              </button>
            ))}
          </div>
        </Section>

        <AnimatePresence mode="wait">
          {/* Method selection */}
          {activeMethod === 'method' && (
            <motion.div
              key="method"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {/* Input methods grid */}
              <Section title="Comment ajouter ?">
                <div className="grid grid-cols-3 gap-3">
                  {inputMethods.map((method, index) => {
                    const Icon = method.icon
                    return (
                      <motion.button
                        key={method.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => handleMethodSelect(method.id)}
                        className={cn(
                          'flex flex-col items-center gap-2 p-4 rounded-xl text-center',
                          'bg-[var(--bg-elevated)] border border-[var(--border-light)]',
                          'hover:border-[var(--accent-primary)] hover:shadow-md',
                          'transition-all duration-200 active:scale-95'
                        )}
                      >
                        <div className={cn('p-3 rounded-xl', method.bgColor)}>
                          <Icon className={cn('h-6 w-6', method.color)} />
                        </div>
                        <span className="font-semibold text-sm text-[var(--text-primary)]">{method.label}</span>
                      </motion.button>
                    )
                  })}
                </div>
              </Section>

              {/* Recent foods */}
              {recentFoods.length > 0 && (
                <Section title="Récents">
                  <div className="space-y-2">
                    {recentFoods.slice(0, 5).map((food) => (
                      <Card key={food.id} padding="default" className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[var(--text-primary)] truncate">{food.name}</p>
                          <p className="text-sm text-[var(--text-tertiary)]">
                            {food.serving}{getUnitLabel(food.servingUnit)} · {formatNumber(food.nutrition.calories)} kcal
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openQuantityModal(food)}
                          disabled={isAdded(food.id)}
                          className={cn(
                            "h-9 px-3 text-xs rounded-xl transition-all inline-flex items-center justify-center",
                            isAdded(food.id)
                              ? "bg-[var(--success)] text-white"
                              : "bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--border-default)]"
                          )}
                        >
                          {isAdded(food.id) ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        </button>
                      </Card>
                    ))}
                  </div>
                </Section>
              )}

              {/* Favorites */}
              {favoriteFoods.length > 0 && (
                <Section title="Favoris">
                  <div className="space-y-2">
                    {favoriteFoods.slice(0, 5).map((food) => (
                      <Card key={food.id} padding="default" className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[var(--text-primary)] truncate">{food.name}</p>
                          <p className="text-sm text-[var(--text-tertiary)]">
                            {food.serving}{getUnitLabel(food.servingUnit)} · {formatNumber(food.nutrition.calories)} kcal
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openQuantityModal(food)}
                          disabled={isAdded(food.id)}
                          className={cn(
                            "h-9 px-3 text-xs rounded-xl transition-all inline-flex items-center justify-center",
                            isAdded(food.id)
                              ? "bg-[var(--success)] text-white"
                              : "bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--border-default)]"
                          )}
                        >
                          {isAdded(food.id) ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        </button>
                      </Card>
                    ))}
                  </div>
                </Section>
              )}
            </motion.div>
          )}

          {/* Search mode */}
          {activeMethod === 'search' && (
            <motion.div
              key="search"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {/* Search input */}
              <Section>
                <Input
                  placeholder="Rechercher un aliment, une marque..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={Search}
                  autoFocus
                />
              </Section>

              {/* Source filter */}
              <Section>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                  {sourceFilters.map((filter) => {
                    const Icon = filter.icon
                    return (
                      <button
                        key={filter.id}
                        onClick={() => setSelectedSource(filter.id)}
                        className={cn(
                          'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all',
                          selectedSource === filter.id
                            ? 'bg-[var(--accent-primary)] text-white'
                            : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{filter.label}</span>
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-[var(--text-tertiary)] mt-2">
                  {sourceFilters.find(f => f.id === selectedSource)?.description}
                </p>
              </Section>

              {/* Loading state */}
              {isLoading && (
                <div className="flex items-center justify-center gap-2 py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-[var(--accent-primary)]" />
                  <span className="text-sm text-[var(--text-secondary)]">Recherche en cours...</span>
                </div>
              )}

              {/* Error state */}
              {error && (
                <div className="p-4 rounded-xl bg-[var(--error)]/10 border border-[var(--error)]/20">
                  <p className="text-sm text-[var(--error)]">{error}</p>
                </div>
              )}

              {/* Search results */}
              {!isLoading && searchQuery.length >= 2 && (
                <Section
                  title={
                    <div className="flex items-center gap-2">
                      <span>{searchResults.length} résultat{searchResults.length > 1 ? 's' : ''}</span>
                      {isLoadingMore && (
                        <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Chargement des marques...</span>
                        </div>
                      )}
                    </div>
                  }
                >
                  <div className="space-y-2">
                    {searchResults.map((food, index) => (
                      <motion.div
                        key={food.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className="bg-[var(--bg-elevated)] border border-[var(--border-light)] rounded-xl p-4 flex items-center gap-3"
                      >
                        {/* Product image */}
                        {food.imageUrl ? (
                          <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--bg-secondary)]">
                            <Image
                              src={food.imageUrl}
                              alt={food.name}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center flex-shrink-0">
                            {food.source === 'ciqual' ? (
                              <Apple className="h-5 w-5 text-[var(--text-tertiary)]" />
                            ) : (
                              <ShoppingBag className="h-5 w-5 text-[var(--text-tertiary)]" />
                            )}
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[var(--text-primary)] truncate">{food.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge
                              variant={food.source === 'ciqual' ? 'success' : 'secondary'}
                              size="sm"
                              className="text-[10px]"
                            >
                              {food.source === 'ciqual' ? 'Générique' : 'Marque'}
                            </Badge>
                            <span className="text-sm text-[var(--text-secondary)]">
                              {formatNumber(food.nutrition.calories)} kcal
                            </span>
                          </div>
                          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                            P {food.nutrition.proteins}g · G {food.nutrition.carbs}g · L {food.nutrition.fats}g
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (isFavorite(food.id)) {
                              removeFromFavorites(food.id)
                            } else {
                              addToFavorites(food)
                            }
                          }}
                          className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
                        >
                          <Star
                            className={cn(
                              'h-5 w-5',
                              isFavorite(food.id)
                                ? 'fill-[var(--warning)] text-[var(--warning)]'
                                : 'text-[var(--text-tertiary)]'
                            )}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            openQuantityModal(food)
                          }}
                          disabled={isAdded(food.id)}
                          className={cn(
                            "h-9 px-3 text-xs rounded-xl transition-all inline-flex items-center justify-center",
                            isAdded(food.id)
                              ? "bg-[var(--success)] text-white"
                              : "bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--border-default)]"
                          )}
                        >
                          {isAdded(food.id) ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        </button>
                      </motion.div>
                    ))}

                    {searchResults.length === 0 && !isLoading && (
                      <div className="text-center py-8">
                        <p className="text-[var(--text-tertiary)]">Aucun résultat pour &quot;{searchQuery}&quot;</p>
                        <p className="text-sm text-[var(--text-tertiary)] mt-1">
                          Essayez avec un autre mot-clé ou une marque
                        </p>
                      </div>
                    )}
                  </div>
                </Section>
              )}

              {/* Initial state - show suggestions */}
              {!isLoading && searchQuery.length < 2 && (
                <Section title="Suggestions">
                  <div className="text-center py-8">
                    <Search className="h-8 w-8 text-[var(--text-tertiary)] mx-auto mb-3" />
                    <p className="text-[var(--text-secondary)]">
                      Tapez au moins 2 caractères pour rechercher
                    </p>
                    <p className="text-sm text-[var(--text-tertiary)] mt-1">
                      Ex: poulet, riz, yaourt, Danone, Lays...
                    </p>
                  </div>
                </Section>
              )}
            </motion.div>
          )}

          {/* Photo scanner mode */}
          {activeMethod === 'photo' && (
            <motion.div
              key="photo"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Section>
                <PhotoFoodScanner
                  mealType={selectedType}
                  onFoodsDetected={handleFoodsDetected}
                />
              </Section>
            </motion.div>
          )}

          {/* Voice input mode */}
          {activeMethod === 'voice' && (
            <motion.div
              key="voice"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Section>
                <VoiceFoodInput
                  mealType={selectedType}
                  onFoodsDetected={handleFoodsDetected}
                />
              </Section>
            </motion.div>
          )}

          {/* Barcode scanner mode */}
          {activeMethod === 'barcode' && (
            <motion.div
              key="barcode"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Section>
                <BarcodeScanner
                  mealType={selectedType}
                  onProductFound={handleProductFound}
                />
              </Section>
            </motion.div>
          )}

          {/* AI generator mode */}
          {activeMethod === 'ai' && (
            <motion.div
              key="ai"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Section>
                <AIMealGenerator
                  mealType={selectedType}
                  onRecipeGenerated={handleRecipeGenerated}
                />
              </Section>
            </motion.div>
          )}
        </AnimatePresence>
      </PageContainer>

      {/* Fixed bottom action - go to journal */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[var(--bg-primary)] border-t border-[var(--border-light)] safe-area-inset">
        <Button
          variant="outline"
          size="lg"
          onClick={() => router.push('/meals')}
          className="w-full"
        >
          Voir le journal des repas
        </Button>
      </div>

      {/* Quantity selector modal */}
      <AnimatePresence>
        {quantityModal.isOpen && quantityModal.food && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeQuantityModal}
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
                  {quantityModal.food.imageUrl ? (
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-[var(--bg-secondary)]">
                      <Image
                        src={quantityModal.food.imageUrl}
                        alt={quantityModal.food.name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center flex-shrink-0">
                      {quantityModal.food.source === 'ciqual' ? (
                        <Apple className="h-5 w-5 text-[var(--accent-primary)]" />
                      ) : (
                        <ShoppingBag className="h-5 w-5 text-[var(--accent-primary)]" />
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[var(--text-primary)] truncate text-base">
                      {quantityModal.food.name}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      Valeurs nutritionnelles pour 100g
                    </p>
                  </div>
                  <button
                    onClick={closeQuantityModal}
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
                          quantityModal.unit === unit.id
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
                        value={quantityModal.quantity}
                        onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                        className="w-full h-12 text-center text-2xl font-bold bg-[var(--bg-secondary)] rounded-xl border-2 border-transparent focus:border-[var(--accent-primary)] focus:outline-none text-[var(--text-primary)] transition-colors"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-tertiary)]">
                        {getUnitLabel(quantityModal.unit)}
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
                    const unit = quantityModal.unit
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
                          quantityModal.quantity === qty
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
                  const nutrition = calculateNutrition(quantityModal.food, quantityModal.quantity, quantityModal.unit)
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
                  onClick={confirmAddFood}
                  className="w-full h-12"
                >
                  <Check className="h-5 w-5 mr-2" />
                  Ajouter
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

function AddMealPageWithParams() {
  const searchParams = useSearchParams()
  const initialType = (searchParams.get('type') as MealType) || 'lunch'
  return <AddMealContent initialType={initialType} />
}

export default function AddMealPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="animate-pulse text-[var(--text-tertiary)]">Chargement...</div>
      </div>
    }>
      <AddMealPageWithParams />
    </Suspense>
  )
}
