import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  Dimensions,
} from 'react-native'
import { useToast } from '../components/ui/Toast'
import { useNavigation, useRoute } from '@react-navigation/native'
import { LinearGradient } from 'expo-linear-gradient'
import {
  ArrowLeft,
  Search,
  Camera,
  Mic,
  Barcode,
  Plus,
  Minus,
  Check,
  X,
  Sparkles,
  Database,
  ShoppingCart,
  Star,
  Apple,
  Heart,
  Globe,
  Trash2,
  ChefHat,
  Wand2,
  Clock,
  Users,
  Flame,
  Dumbbell,
  ExternalLink,
  Calendar,
  CalendarDays,
  Percent,
  RefreshCw,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { Card, Button, Badge, NutriScoreBadge } from '../components/ui'
import { colors, fonts, spacing, typography, radius, shadows } from '../constants/theme'
import { useMealsStore } from '../stores/meals-store'
import { useGamificationStore } from '../stores/gamification-store'
import { useRecipesStore } from '../stores/recipes-store'
import { useUserStore } from '../stores/user-store'
import { useMealPlanStore, type WeekPlan } from '../stores/meal-plan-store'
import type { MealType, FoodItem, MealItem, NutritionInfo, Recipe, UserProfile } from '../types'
import { generateId } from '../lib/utils'
import { searchFoods, preloadCiqual, type SearchSource } from '../services/food-search'
import { gustarRecipes, type GustarRecipe, type DietaryPreference } from '../services/gustar-recipes'
import { translateRecipe, suggestMeal, type AIRecipe } from '../services/ai-service'
import {
  generateSingleMealWithRAG,
  generateFlexibleMealPlanWithRAG,
  type SingleMealResult,
  type MealSource,
  SOURCE_LABELS,
} from '../services/meal-plan-rag-service'
import BarcodeScanner from '../components/BarcodeScanner'
import PhotoFoodScanner from '../components/PhotoFoodScanner'
import VoiceFoodInput from '../components/VoiceFoodInput'
import RecipeDiscovery from '../components/RecipeDiscovery'
import { MealInputMethodsGrid } from '../components/MealInputMethodsGrid'
import { analytics } from '../services/analytics-service'
import { errorReporting } from '../services/error-reporting-service'
import { detectUnitWeight, calculateWeightFromUnits, getUnitDisplayInfo } from '../services/unit-weights'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

// API Key for Gustar.io
const GUSTAR_API_KEY = '7ab3c50b59mshef5d331907bd424p16332ajsn5ea4bf90e1b9'

const mealConfig: Record<MealType, { label: string; icon: string; color: string }> = {
  breakfast: { label: 'Petit-dejeuner', icon: '☀️', color: colors.warning },
  lunch: { label: 'Dejeuner', icon: '🍽️', color: colors.accent.primary },
  snack: { label: 'Collation', icon: '🍎', color: colors.success },
  dinner: { label: 'Diner', icon: '🌙', color: colors.secondary.primary },
}

// Diet filters for discover
const dietFilters = [
  { id: '', label: 'Tout', emoji: '🍽️' },
  { id: 'vegetarian', label: 'Veggie', emoji: '🥗' },
  { id: 'vegan', label: 'Vegan', emoji: '🌱' },
  { id: 'glutenfree', label: 'Sans Gluten', emoji: '🌾' },
  { id: 'keto', label: 'Keto', emoji: '🥓' },
  { id: 'lowcarb', label: 'Low Carb', emoji: '💪' },
]

// Meal type options for AI suggestion
const mealTypeOptions: { id: MealType; label: string; icon: string }[] = [
  { id: 'breakfast', label: 'Petit-dej', icon: '🌅' },
  { id: 'lunch', label: 'Dejeuner', icon: '☀️' },
  { id: 'snack', label: 'Collation', icon: '🍎' },
  { id: 'dinner', label: 'Diner', icon: '🌙' },
]

// Difficulty labels
const difficultyLabels: Record<string, { label: string; color: string }> = {
  easy: { label: 'Facile', color: colors.success },
  medium: { label: 'Moyen', color: colors.warning },
  hard: { label: 'Difficile', color: colors.error },
}

// Transform Gustar recipe to our Recipe type
function transformGustarToRecipe(gustar: GustarRecipe): Recipe {
  const totalTime = (gustar.prepTime || 0) + (gustar.cookTime || 0)
  const servings = gustar.servings || 2

  return {
    id: gustar.id,
    title: gustar.title,
    description: gustar.description,
    imageUrl: gustar.image,
    servings,
    prepTime: gustar.prepTime || 15,
    cookTime: gustar.cookTime || 20,
    totalTime: totalTime || 35,
    difficulty: gustar.difficulty || 'medium',
    category: gustar.dietary?.[0] || 'general',
    ingredients: gustar.ingredients.map((ing, index) => ({
      id: `${gustar.id}-ing-${index}`,
      name: ing.name,
      amount: ing.amount,
      unit: ing.unit,
    })),
    instructions: gustar.instructions,
    nutrition: {
      calories: (gustar.nutrition?.calories || 0) * servings,
      proteins: (gustar.nutrition?.proteins || 0) * servings,
      carbs: (gustar.nutrition?.carbs || 0) * servings,
      fats: (gustar.nutrition?.fats || 0) * servings,
    },
    nutritionPerServing: {
      calories: gustar.nutrition?.calories || 0,
      proteins: gustar.nutrition?.proteins || 0,
      carbs: gustar.nutrition?.carbs || 0,
      fats: gustar.nutrition?.fats || 0,
    },
    tags: gustar.dietary || [],
    dietTypes: gustar.dietary || [],
    allergens: [],
    rating: 4.5,
    ratingCount: Math.floor(Math.random() * 100) + 20,
    isFavorite: false,
    sourceUrl: gustar.sourceUrl,
    source: gustar.sourceName || 'Gustar.io',
  }
}


type ServingUnit = 'g' | 'ml' | 'unit' | 'portion'

interface SelectedFood {
  food: FoodItem
  quantity: number
  unit: ServingUnit
}

interface QuantityModalState {
  isOpen: boolean
  food: FoodItem | null
  quantity: number
  unit: ServingUnit
}

const availableUnits: { id: ServingUnit; label: string; shortLabel: string }[] = [
  { id: 'g', label: 'Grammes', shortLabel: 'g' },
  { id: 'ml', label: 'Millilitres', shortLabel: 'ml' },
  { id: 'unit', label: 'Unite(s)', shortLabel: 'unite' },
  { id: 'portion', label: 'Portion(s)', shortLabel: 'portion' },
]

function getUnitLabel(unit: ServingUnit | string): string {
  switch (unit) {
    case 'g': return 'g'
    case 'ml': return 'ml'
    case 'unit': return 'unite(s)'
    case 'portion': return 'portion(s)'
    default: return unit
  }
}

function getQuantityStep(unit: ServingUnit): number {
  switch (unit) {
    case 'g': return 10
    case 'ml': return 25
    case 'unit': return 1
    case 'portion': return 1
    default: return 10
  }
}

function getDefaultQuantity(unit: ServingUnit): number {
  switch (unit) {
    case 'g': return 100
    case 'ml': return 200
    case 'unit': return 1
    case 'portion': return 1
    default: return 100
  }
}

function getPresets(unit: ServingUnit): number[] {
  switch (unit) {
    case 'ml': return [100, 150, 200, 250, 330, 500]
    case 'unit':
    case 'portion': return [1, 2, 3, 4, 5, 6]
    default: return [25, 50, 100, 150, 200, 300]
  }
}

export default function AddMealScreen() {
  const navigation = useNavigation()
  const route = useRoute()
  const toast = useToast()
  const { type = 'lunch', openDiscover = false } = (route.params as { type?: MealType; openDiscover?: boolean }) || {}

  const { addMeal, recentFoods = [], favoriteFoods = [], addToFavorites, removeFromFavorites, getDailyNutrition, getMealsForDate, currentDate } = useMealsStore()
  const { addXP } = useGamificationStore()
  const { favoriteRecipes, removeFromFavorites: removeRecipeFromFavorites, addToFavorites: addRecipeToFavorites, addAIRecipe, rateAIRecipe, aiRecipes } = useRecipesStore()
  const { profile, nutritionGoals } = useUserStore()
  const { setPlan: setMealPlan } = useMealPlanStore()

  const [activeMethod, setActiveMethod] = useState<'method' | 'search' | 'favorites'>('method')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFoods, setSelectedFoods] = useState<SelectedFood[]>([])
  const [searchResults, setSearchResults] = useState<FoodItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchSource, setSearchSource] = useState<SearchSource>('all')
  const [lastSearchInfo, setLastSearchInfo] = useState<{
    fromCache: boolean
    sources: string[]
    total: number
  } | null>(null)
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const [showPhotoScanner, setShowPhotoScanner] = useState(false)
  const [showVoiceInput, setShowVoiceInput] = useState(false)
  const [addedFoodIds, setAddedFoodIds] = useState<Set<string>>(new Set())
  const [favoritesTab, setFavoritesTab] = useState<'foods' | 'recipes'>('foods')
  const [favoritesSearch, setFavoritesSearch] = useState('')

  // AI Recipe Modal state
  const [showAIRecipeModal, setShowAIRecipeModal] = useState(false)
  const [selectedMealType, setSelectedMealType] = useState<MealType>(type as MealType)
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [suggestedRecipe, setSuggestedRecipe] = useState<AIRecipe | null>(null)
  const [generationMode, setGenerationMode] = useState<'suggestion' | 'plan'>('suggestion')
  const [planDuration, setPlanDuration] = useState<1 | 3>(1)
  const [calorieReduction, setCalorieReduction] = useState(false)
  const [lastMealSource, setLastMealSource] = useState<{ source: MealSource; label: string; confidence: number } | null>(null)
  const [excludedRecipeIds, setExcludedRecipeIds] = useState<string[]>([]) // For "Autre suggestion" feature
  const [lastSuggestedRecipeId, setLastSuggestedRecipeId] = useState<string | null>(null) // Track last suggestion

  // Discover Modal state
  const [showDiscoverModal, setShowDiscoverModal] = useState(false)
  const [discoverSearchQuery, setDiscoverSearchQuery] = useState('')
  const [selectedDiet, setSelectedDiet] = useState('')
  const [discoverRecipes, setDiscoverRecipes] = useState<Recipe[]>([])
  const [isDiscoverLoading, setIsDiscoverLoading] = useState(false)
  const [isEnriching, setIsEnriching] = useState(false)
  const [discoverSearchInfo, setDiscoverSearchInfo] = useState<{ total: number } | null>(null)

  // Recipe Detail Modal state
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const [showRecipeDetailModal, setShowRecipeDetailModal] = useState(false)
  const [userRating, setUserRating] = useState(0)
  const [userComment, setUserComment] = useState('')
  const [showAddToMealSelector, setShowAddToMealSelector] = useState(false)
  const [addToMealType, setAddToMealType] = useState<MealType>(type as MealType)

  // Quantity modal state
  const [quantityModal, setQuantityModal] = useState<QuantityModalState>({
    isOpen: false,
    food: null,
    quantity: 100,
    unit: 'g',
  })
  // Separate text input state to allow clearing the field
  const [quantityInputText, setQuantityInputText] = useState('100')

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Use selectedMealType instead of route param for meal type selection
  const config = mealConfig[selectedMealType] || mealConfig.lunch

  // Preload CIQUAL and init Gustar on mount
  useEffect(() => {
    preloadCiqual()
    if (GUSTAR_API_KEY) {
      gustarRecipes.init(GUSTAR_API_KEY)
    }
  }, [])

  // Open discover modal if navigated with openDiscover param
  useEffect(() => {
    if (openDiscover) {
      setShowDiscoverModal(true)
    }
  }, [openDiscover])

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([])
      setLastSearchInfo(null)
      setIsSearching(false)
      return
    }

    setIsSearching(true)

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const result = await searchFoods({
          query: searchQuery,
          limit: 25,
          source: searchSource,
        })
        setSearchResults(result.products)
        setLastSearchInfo({
          fromCache: result.fromCache,
          sources: result.sources,
          total: result.total,
        })

        // Track search
        analytics.track('food_search', {
          query: searchQuery,
          results_count: result.products.length,
          source: searchSource,
        })
      } catch (error) {
        console.error('Search error:', error)
        setSearchResults([])
        errorReporting.captureFeatureError('food_search', error as Error)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, searchSource])

  // Calculate total nutrition
  const totalNutrition: NutritionInfo = selectedFoods.reduce(
    (acc, { food, quantity, unit }) => {
      // Special handling for custom recipes (source === 'recipe')
      // Their nutrition values are already per portion, not per 100g
      if (food.source === 'recipe' || food.isRecipe) {
        return {
          calories: acc.calories + Math.round(food.nutrition.calories * quantity),
          proteins: acc.proteins + Math.round(food.nutrition.proteins * quantity * 10) / 10,
          carbs: acc.carbs + Math.round(food.nutrition.carbs * quantity * 10) / 10,
          fats: acc.fats + Math.round(food.nutrition.fats * quantity * 10) / 10,
        }
      }

      // Standard foods: nutrition is per 100g
      let gramsEquivalent = quantity
      if (unit === 'unit' || unit === 'portion') {
        // Use accurate unit weight from our database
        const { weightGrams } = calculateWeightFromUnits(food, quantity)
        gramsEquivalent = weightGrams
      }
      const multiplier = gramsEquivalent / 100

      return {
        calories: acc.calories + Math.round(food.nutrition.calories * multiplier),
        proteins: acc.proteins + Math.round(food.nutrition.proteins * multiplier * 10) / 10,
        carbs: acc.carbs + Math.round(food.nutrition.carbs * multiplier * 10) / 10,
        fats: acc.fats + Math.round(food.nutrition.fats * multiplier * 10) / 10,
      }
    },
    { calories: 0, proteins: 0, carbs: 0, fats: 0 }
  )

  // Open quantity modal
  const openQuantityModal = (food: FoodItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // For custom recipes, default to 'portion' unit since their nutrition is per portion
    const defaultUnit: ServingUnit = (food.source === 'recipe' || food.isRecipe) ? 'portion' : 'g'
    const defaultQty = getDefaultQuantity(defaultUnit)
    setQuantityModal({
      isOpen: true,
      food,
      quantity: defaultQty,
      unit: defaultUnit,
    })
    setQuantityInputText(String(defaultQty))
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

  // Change unit
  const changeUnit = (newUnit: ServingUnit) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const defaultQty = getDefaultQuantity(newUnit)
    setQuantityModal(prev => ({
      ...prev,
      unit: newUnit,
      quantity: defaultQty,
    }))
    setQuantityInputText(String(defaultQty))
  }

  // Adjust quantity
  const adjustQuantity = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const step = getQuantityStep(quantityModal.unit)
    const newQty = Math.max(step, quantityModal.quantity + delta * step)
    setQuantityModal(prev => ({ ...prev, quantity: newQty }))
    setQuantityInputText(String(newQty))
  }

  // Set quantity directly (from presets or buttons)
  const setQuantityValue = (qty: number) => {
    const validQty = Math.max(1, qty)
    setQuantityModal(prev => ({ ...prev, quantity: validQty }))
    setQuantityInputText(String(validQty))
  }

  // Handle text input change - allows empty field while typing
  const handleQuantityTextChange = (text: string) => {
    // Allow empty string for clearing
    setQuantityInputText(text)
    // Parse and update the actual quantity (for nutrition preview)
    const parsed = parseFloat(text)
    if (!isNaN(parsed) && parsed > 0) {
      setQuantityModal(prev => ({ ...prev, quantity: parsed }))
    }
  }

  // Handle text input blur - ensure valid value
  const handleQuantityTextBlur = () => {
    const parsed = parseFloat(quantityInputText)
    if (isNaN(parsed) || parsed <= 0) {
      // Reset to minimum valid value
      const minQty = getQuantityStep(quantityModal.unit)
      setQuantityModal(prev => ({ ...prev, quantity: minQty }))
      setQuantityInputText(String(minQty))
    } else {
      setQuantityInputText(String(parsed))
    }
  }

  // Calculate nutrition for modal
  const calculateModalNutrition = () => {
    if (!quantityModal.food) return { calories: 0, proteins: 0, carbs: 0, fats: 0, gramsEquivalent: 0 }

    const { food, quantity, unit } = quantityModal

    // Special handling for custom recipes (source === 'recipe')
    // Their nutrition values are already per portion, not per 100g
    if (food.source === 'recipe' || food.isRecipe) {
      // For recipes, nutrition is per portion - just multiply by quantity
      return {
        calories: Math.round(food.nutrition.calories * quantity),
        proteins: Math.round(food.nutrition.proteins * quantity * 10) / 10,
        carbs: Math.round(food.nutrition.carbs * quantity * 10) / 10,
        fats: Math.round(food.nutrition.fats * quantity * 10) / 10,
        gramsEquivalent: quantity, // For recipes, gramsEquivalent = number of portions
      }
    }

    // Standard foods: nutrition is per 100g
    let gramsEquivalent = quantity
    if (unit === 'unit' || unit === 'portion') {
      // Use accurate unit weight from our database
      const { weightGrams } = calculateWeightFromUnits(food, quantity)
      gramsEquivalent = weightGrams
    }
    const multiplier = gramsEquivalent / 100

    return {
      calories: Math.round(food.nutrition.calories * multiplier),
      proteins: Math.round(food.nutrition.proteins * multiplier * 10) / 10,
      carbs: Math.round(food.nutrition.carbs * multiplier * 10) / 10,
      fats: Math.round(food.nutrition.fats * multiplier * 10) / 10,
      gramsEquivalent: Math.round(gramsEquivalent * 10) / 10,
    }
  }

  // Get unit weight info for display
  const getModalUnitInfo = () => {
    if (!quantityModal.food) return null
    return getUnitDisplayInfo(quantityModal.food)
  }

  // Confirm add food from modal
  const confirmAddFood = () => {
    if (!quantityModal.food) return

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    const { food, quantity, unit } = quantityModal
    console.log('[AddMealScreen] confirmAddFood:', {
      name: food.name,
      quantity,
      unit,
      caloriesPer100g: food.nutrition.calories,
      expectedCalories: Math.round(food.nutrition.calories * quantity / 100)
    })

    setSelectedFoods(prev => {
      const existing = prev.find(sf => sf.food.id === food.id)
      if (existing) {
        return prev.map(sf =>
          sf.food.id === food.id
            ? { ...sf, quantity: sf.quantity + quantity }
            : sf
        )
      }
      return [...prev, { food, quantity, unit }]
    })

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

  const handleRemoveFood = (foodId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedFoods(prev => prev.filter(sf => sf.food.id !== foodId))
  }

  const handleUpdateQuantity = (foodId: string, delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedFoods(prev =>
      prev.map(sf => {
        if (sf.food.id === foodId) {
          const step = getQuantityStep(sf.unit)
          const newQuantity = Math.max(step, sf.quantity + delta * step)
          return { ...sf, quantity: newQuantity }
        }
        return sf
      })
    )
  }

  const handleSaveMeal = () => {
    if (selectedFoods.length === 0) {
      toast.error('Veuillez ajouter au moins un aliment')
      return
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    // Convert to MealItems
    // IMPORTANT: For standard foods, nutrition values are per 100g, so multiplier must be grams/100
    // For custom recipes (source === 'recipe'), nutrition is per portion, so multiplier = quantity directly
    // For photo meals (source === 'photo'), nutrition is ABSOLUTE for the detected portion, so multiplier = 1
    const mealItems: MealItem[] = selectedFoods.map(({ food, quantity, unit }) => {
      // Special handling for custom recipes - their nutrition is already per portion
      if (food.source === 'recipe' || food.isRecipe) {
        return {
          id: generateId(),
          food,
          quantity: quantity, // For recipes, quantity = number of portions
        }
      }

      // Special handling for photo-detected meals - nutrition is ABSOLUTE for the detected portion
      // The AI already calculated calories for the estimated weight shown in the photo
      // So we use quantity = 1 to represent "1 complete meal as detected"
      if (food.source === 'photo') {
        return {
          id: generateId(),
          food,
          quantity: 1, // Photo meals: nutrition is already the total, no multiplier needed
        }
      }

      // Standard foods: nutrition is per 100g
      let gramsEquivalent = quantity
      if (unit === 'unit' || unit === 'portion') {
        // For units/portions, multiply by servingSize to get grams
        const servingSize = food.servingSize || 100
        gramsEquivalent = quantity * servingSize
      }
      // Divide by 100 because nutrition is per 100g
      const multiplier = gramsEquivalent / 100

      return {
        id: generateId(),
        food,
        quantity: multiplier,
      }
    })

    console.log('[AddMealScreen] Saving meal with items:', mealItems.map(m => ({
      name: m.food.name,
      source: m.food.source,
      quantity: m.quantity,
      nutritionCalories: m.food.nutrition.calories,
      finalCalories: Math.round(m.food.nutrition.calories * m.quantity)
    })))

    addMeal(selectedMealType, mealItems)
    addXP(15, 'Repas enregistré')

    // Track meal logged
    const totalCalories = mealItems.reduce((sum, item) => {
      return sum + (item.food.nutrition.calories || 0) * item.quantity
    }, 0)
    analytics.trackMealLogged(
      selectedMealType,
      activeMethod === 'search' ? 'search' : 'manual',
      mealItems[0]?.food.source as 'off' | 'ciqual' | 'gustar' | 'ai' | undefined,
      Math.round(totalCalories)
    )

    navigation.goBack()
  }

  const handleMethodSelect = (methodId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    switch (methodId) {
      case 'search':
        setActiveMethod('search')
        break
      case 'photo':
        setShowPhotoScanner(true)
        break
      case 'voice':
        setShowVoiceInput(true)
        break
      case 'barcode':
        setShowBarcodeScanner(true)
        break
      case 'ai-meal':
        setShowAIRecipeModal(true)
        // Reset excluded recipes when opening the modal (fresh start)
        setExcludedRecipeIds([])
        setLastSuggestedRecipeId(null)
        break
      case 'discover-recipes':
        setShowDiscoverModal(true)
        break
      case 'favorites':
        setActiveMethod('favorites')
        break
      case 'custom-recipe':
        // Navigate to CustomRecipes screen (list view with option to create)
        navigation.navigate('CustomRecipes' as never)
        break
    }
  }

  const handleBarcodeFoodFound = (food: FoodItem) => {
    openQuantityModal(food)
  }

  const handleFoodsFound = (foods: FoodItem[]) => {
    foods.forEach(food => {
      setSelectedFoods(prev => [...prev, { food, quantity: food.servingSize, unit: 'g' }])
      setAddedFoodIds(prev => new Set(prev).add(food.id))
    })
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    setTimeout(() => {
      foods.forEach(food => {
        setAddedFoodIds(prev => {
          const next = new Set(prev)
          next.delete(food.id)
          return next
        })
      })
    }, 2000)
  }

  const isFavorite = (foodId: string) => favoriteFoods?.some((f: FoodItem) => f.id === foodId) ?? false
  const isAdded = (foodId: string) => addedFoodIds.has(foodId)
  const isRecipeFavorite = (recipeId: string) => favoriteRecipes.some((f: Recipe) => f.id === recipeId)
  const getDifficulty = (level: string | undefined) => difficultyLabels[level || 'medium'] || difficultyLabels.medium

  // AI Recipe suggestion handler - Now uses RAG for intelligent source selection
  const handleAISuggest = async (excludeIds?: string[]) => {
    console.log('='.repeat(60))
    console.log('[AddMeal] handleAISuggest CALLED')
    console.log('[AddMeal] profile exists:', !!profile)
    console.log('[AddMeal] nutritionGoals exists:', !!nutritionGoals)
    console.log('[AddMeal] profile data:', JSON.stringify(profile, null, 2))
    console.log('[AddMeal] nutritionGoals data:', JSON.stringify(nutritionGoals, null, 2))
    console.log('[AddMeal] generationMode:', generationMode, 'selectedMealType:', selectedMealType)
    console.log('[AddMeal] excludeIds:', excludeIds)
    console.log('='.repeat(60))

    if (!profile || !nutritionGoals) {
      console.log('[AddMeal] ERROR: Missing profile or nutritionGoals!')
      toast.error('Configure ton profil pour utiliser LymIA')
      return
    }

    console.log('[AddMeal] Validation passed, starting generation...')
    setIsSuggesting(true)
    setLastMealSource(null)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      const consumed = getDailyNutrition(currentDate)
      const consumedNutrition = {
        calories: consumed.calories,
        proteins: consumed.proteins,
        carbs: consumed.carbs,
        fats: consumed.fats,
      }

      // Calculate remaining calories for the day
      const dailyTarget = nutritionGoals.calories
      const remainingCalories = Math.max(0, dailyTarget - consumed.calories)

      // Get meals already logged today to calculate smart calorie distribution
      const todayMeals = getMealsForDate(currentDate)
      const mealsLogged: MealType[] = todayMeals.map((meal) => meal.type)
      const uniqueMealsLogged = [...new Set(mealsLogged)] as MealType[]

      console.log('[AddMeal] Daily target:', dailyTarget, '| Consumed:', consumed.calories, '| Remaining:', remainingCalories)
      console.log('[AddMeal] Meals already logged today:', uniqueMealsLogged.join(', ') || 'none')

      // Mode suggestion = single meal, Mode plan = full day(s) plan
      if (generationMode === 'suggestion') {
        console.log('[AddMeal] Calling generateSingleMealWithRAG...')
        console.log('[AddMeal] params:', JSON.stringify({
          mealType: selectedMealType,
          consumed: consumedNutrition,
          remainingCalories,
          calorieReduction,
          mealsLogged: uniqueMealsLogged,
          composeFullMeal: true, // Compose multi-component meals
          excludeRecipeIds: excludeIds || excludedRecipeIds,
          profileGoal: (profile as UserProfile).goal,
          nutritionalNeeds: (profile as UserProfile).nutritionalNeeds,
        }))

        // Single meal suggestion - uses smart calorie calculation based on meals logged
        const result = await generateSingleMealWithRAG({
          mealType: selectedMealType,
          userProfile: profile as UserProfile,
          consumed: consumedNutrition,
          calorieReduction,
          remainingCalories,
          mealsLogged: uniqueMealsLogged, // Pass logged meals for smart distribution
          composeFullMeal: true, // Compose multi-component meals for realistic suggestions
          excludeRecipeIds: excludeIds || excludedRecipeIds,
        })

        console.log('[AddMeal] generateSingleMealWithRAG returned:', JSON.stringify({
          success: result.success,
          source: result.source,
          hasRecipe: !!result.recipe,
          error: result.error,
        }))

        if (result.success && result.recipe) {
          // Store source info for display
          setLastMealSource({
            source: result.source,
            label: result.sourceLabel,
            confidence: result.confidence,
          })

          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

          // Create Recipe object for adding to meal log
          const aiRecipe: Recipe = {
            id: result.recipe.id,
            title: result.recipe.title,
            description: result.recipe.description,
            imageUrl: result.recipe.imageUrl,
            servings: result.recipe.servings,
            prepTime: result.recipe.prepTime,
            cookTime: 0,
            totalTime: result.recipe.prepTime,
            difficulty: 'medium',
            category: selectedMealType,
            ingredients: result.recipe.ingredients.map((ing, i) => ({
              id: `rag-ing-${i}`,
              name: ing.name,
              amount: parseFloat(ing.amount) || 0,
              unit: 'g',
            })),
            instructions: result.recipe.instructions,
            nutrition: result.recipe.nutrition,
            nutritionPerServing: result.recipe.nutrition,
            tags: ['LymIA', result.sourceLabel],
            dietTypes: [],
            allergens: [],
            rating: 5,
            ratingCount: 1,
            isFavorite: false,
            source: result.source === 'ai' ? 'ai' : result.source,
          }
          // Set the suggested recipe to display in the same modal
          setSuggestedRecipe({
            title: result.recipe.title,
            description: result.recipe.description,
            ingredients: result.recipe.ingredients,
            instructions: result.recipe.instructions,
            nutrition: result.recipe.nutrition,
            prepTime: result.recipe.prepTime,
            servings: result.recipe.servings,
            imageUrl: result.recipe.imageUrl,
          })
          // Also set selectedRecipe for adding to meal log
          setSelectedRecipe(aiRecipe)

          // Track this recipe ID for "Autre suggestion" exclusion
          const recipeId = result.recipe.id
          setLastSuggestedRecipeId(recipeId)
          // Add to excluded list for subsequent "Autre suggestion" calls
          setExcludedRecipeIds(prev => [...prev, recipeId])
        } else {
          toast.error(result.error || 'Aucun repas trouve')
        }
      } else {
        // Full plan generation (1, 3 or 7 days)
        const result = await generateFlexibleMealPlanWithRAG({
          userProfile: profile as UserProfile,
          dailyCalories: nutritionGoals.calories,
          days: planDuration,
          calorieReduction,
        })

        if (result.meals.length > 0) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

          // Save the plan to the store
          const weekPlan: WeekPlan = {
            id: generateId(),
            meals: result.meals,
            generatedAt: result.generatedAt,
            weekStart: new Date().toISOString().split('T')[0],
          }
          setMealPlan(weekPlan)

          // Show summary of generated plan
          const totalMeals = result.meals.length
          const sourceInfo = Object.entries(result.sourceBreakdown)
            .filter(([_, count]) => count > 0)
            .map(([source, count]) => `${SOURCE_LABELS[source as MealSource]}: ${count}`)
            .join('\n')

          Alert.alert(
            `Plan ${planDuration} jour${planDuration > 1 ? 's' : ''} genere`,
            `${totalMeals} repas créés\n\nSources utilisées:\n${sourceInfo}\n\nCalories totales: ${result.totalNutrition.calories} kcal`,
            [
              { text: 'Voir le plan', onPress: () => {
                setShowAIRecipeModal(false)
                // @ts-ignore - Navigate with duration param so title displays correctly
                navigation.navigate('WeeklyPlan', { duration: planDuration, calorieReduction })
              }},
              { text: 'Fermer', style: 'cancel' }
            ]
          )
        } else {
          toast.error('Impossible de générer le plan repas')
        }
      }
    } catch (error) {
      console.error('[AddMeal] RAG meal generation error:', error)
      console.error('[AddMeal] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      toast.error(`Erreur: ${errorMessage}`)
    } finally {
      setIsSuggesting(false)
    }
  }

  // Discover search handler
  const handleDiscoverSearch = useCallback(async () => {
    if (!discoverSearchQuery.trim()) return

    setIsDiscoverLoading(true)
    try {
      const diet = selectedDiet as DietaryPreference | undefined
      const result = await gustarRecipes.searchRecipes({
        query: discoverSearchQuery,
        diet: diet || undefined,
        limit: 20,
      })

      if (result.recipes.length > 0) {
        const transformed = result.recipes.map(transformGustarToRecipe)
        setDiscoverRecipes(transformed)
        setDiscoverSearchInfo({ total: result.total })

        // Start enrichment (translation) in background
        enrichRecipes(transformed)
      } else {
        setDiscoverRecipes([])
        setDiscoverSearchInfo({ total: 0 })
      }
    } catch (error) {
      console.log('Search error:', error)
      setDiscoverRecipes([])
    } finally {
      setIsDiscoverLoading(false)
    }
  }, [discoverSearchQuery, selectedDiet])

  // Enrich recipes with French translation
  const enrichRecipes = async (recipesToEnrich: Recipe[]) => {
    setIsEnriching(true)
    try {
      for (let i = 0; i < Math.min(recipesToEnrich.length, 6); i += 3) {
        const batch = recipesToEnrich.slice(i, i + 3)
        await Promise.all(
          batch.map(async (recipe) => {
            try {
              const result = await translateRecipe({
                title: recipe.title,
                description: recipe.description,
                ingredients: recipe.ingredients.map((ing) => ({
                  name: ing.name,
                  amount: parseFloat(String(ing.amount)) || 0,
                  unit: ing.unit,
                })),
                instructions: recipe.instructions,
              })

              if (result.success && result.translated) {
                setDiscoverRecipes((prev) =>
                  prev.map((r) =>
                    r.id === recipe.id
                      ? {
                          ...r,
                          title: result.translated!.titleFr,
                          description: result.translated!.descriptionFr,
                          instructions: result.translated!.instructionsFr,
                        }
                      : r
                  )
                )
              }
            } catch (err) {
              console.log('Enrichment error for recipe:', recipe.id)
            }
          })
        )
      }
    } finally {
      setIsEnriching(false)
    }
  }

  // Recipe press handler
  const handleRecipePress = (recipe: Recipe) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedRecipe(recipe)

    // Check if this recipe has an existing rating
    const existingRating = aiRecipes.find(r => r.recipeId === recipe.id)
    if (existingRating) {
      setUserRating(existingRating.rating)
      setUserComment(existingRating.comment || '')
    } else {
      setUserRating(0)
      setUserComment('')
    }

    // Close discover modal first, then open recipe detail modal
    // This fixes modal stacking issue where recipe detail appeared behind discover modal
    setShowDiscoverModal(false)
    // Small delay to allow modal to close before opening the new one
    setTimeout(() => {
      setShowRecipeDetailModal(true)
    }, 100)
  }

  // Rating handlers
  const handleRateRecipe = (rating: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setUserRating(rating)
  }

  const handleSaveRating = () => {
    if (!selectedRecipe || userRating === 0) return

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    // Add to AI recipes if not already there
    addAIRecipe(selectedRecipe, selectedMealType)

    // Save the rating
    rateAIRecipe(selectedRecipe.id, userRating, userComment)

    toast.success('Note enregistrée !')
  }

  // Add recipe to meal
  const handleAddRecipeToMeal = () => {
    if (!selectedRecipe) return

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    // Get nutrition per serving (prioritize nutritionPerServing, fallback to dividing total by servings)
    const servings = selectedRecipe.servings || 1
    const perServingNutrition = selectedRecipe.nutritionPerServing || {
      calories: (selectedRecipe.nutrition?.calories || 0) / servings,
      proteins: (selectedRecipe.nutrition?.proteins || 0) / servings,
      carbs: (selectedRecipe.nutrition?.carbs || 0) / servings,
      fats: (selectedRecipe.nutrition?.fats || 0) / servings,
    }

    // Convert recipe to FoodItem for the meal (1 portion)
    const recipeAsFood: FoodItem = {
      id: `recipe-${selectedRecipe.id}`,
      name: `${selectedRecipe.title} (1 portion)`,
      brand: selectedRecipe.source || 'Recette',
      servingSize: 1,
      servingUnit: 'portion',
      nutrition: {
        calories: Math.round(perServingNutrition.calories),
        proteins: Math.round(perServingNutrition.proteins),
        carbs: Math.round(perServingNutrition.carbs),
        fats: Math.round(perServingNutrition.fats),
      },
      source: 'recipe',
      imageUrl: selectedRecipe.imageUrl,
    }

    // Create MealItem
    const mealItem: MealItem = {
      id: generateId(),
      food: recipeAsFood,
      quantity: 1, // 1 portion
    }

    // Add to meal
    addMeal(addToMealType, [mealItem])
    addXP(20, 'Recette ajoutee au repas')

    // Close modal and navigate back
    setShowRecipeDetailModal(false)
    setShowAddToMealSelector(false)
    navigation.goBack()
  }

  // Toggle recipe favorite
  const handleToggleRecipeFavorite = (recipe: Recipe) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const isFav = isRecipeFavorite(recipe.id)
    if (isFav) {
      removeRecipeFromFavorites(recipe.id)
    } else {
      addRecipeToFavorites(recipe)
    }
  }

  const getSourceIcon = (source: string) => {
    if (source === 'ciqual') {
      return <Database size={12} color={colors.success} />
    }
    if (source === 'custom' || source === 'recipe') {
      return <ChefHat size={12} color={colors.accent.primary} />
    }
    return <ShoppingCart size={12} color={colors.warning} />
  }

  const handleBack = () => {
    if (activeMethod === 'search') {
      setActiveMethod('method')
      setSearchQuery('')
      setSearchResults([])
    } else if (activeMethod === 'favorites') {
      setActiveMethod('method')
    } else {
      navigation.goBack()
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
          >
            <ArrowLeft size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerTitle}>
            <Text style={styles.headerEmoji}>{activeMethod === 'favorites' ? '❤️' : config.icon}</Text>
            <Text style={styles.headerText}>
              {activeMethod === 'search' ? 'Rechercher' : activeMethod === 'favorites' ? 'Mes favoris' : config.label}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.saveButton,
              selectedFoods.length === 0 && styles.saveButtonDisabled,
            ]}
            onPress={handleSaveMeal}
            disabled={selectedFoods.length === 0}
          >
            <Check size={24} color={selectedFoods.length > 0 ? colors.accent.primary : colors.text.muted} />
          </TouchableOpacity>
        </View>

        {/* Method Selection View */}
        {activeMethod === 'method' && (
          <ScrollView
            style={styles.foodList}
            contentContainerStyle={styles.methodContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Meal Type Selector */}
            <Text style={styles.sectionTitle}>Type de repas</Text>
            <View style={styles.mealTypeSelector}>
              {mealTypeOptions.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.mealTypeSelectorChip,
                    selectedMealType === option.id && styles.mealTypeSelectorChipActive,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setSelectedMealType(option.id)
                    // Reset excluded recipes when changing meal type
                    setExcludedRecipeIds([])
                    setLastSuggestedRecipeId(null)
                  }}
                >
                  <Text style={styles.mealTypeSelectorEmoji}>{option.icon}</Text>
                  <Text
                    style={[
                      styles.mealTypeSelectorText,
                      selectedMealType === option.id && styles.mealTypeSelectorTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Input methods grid - Personalized with pinned methods */}
            <MealInputMethodsGrid onMethodSelect={handleMethodSelect} />

            {/* Selected foods summary */}
            {selectedFoods.length > 0 && (
              <Card style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                  <Text style={styles.summaryTitle}>
                    {selectedFoods.length} aliment{selectedFoods.length > 1 ? 's' : ''} selectionne{selectedFoods.length > 1 ? 's' : ''}
                  </Text>
                  <Text style={[styles.summaryCalories, { color: config.color }]}>
                    {totalNutrition.calories} kcal
                  </Text>
                </View>
                <View style={styles.macrosRow}>
                  <View style={styles.macroItem}>
                    <Text style={[styles.macroValue, { color: colors.nutrients.proteins }]}>
                      {totalNutrition.proteins}g
                    </Text>
                    <Text style={styles.macroLabel}>Prot.</Text>
                  </View>
                  <View style={styles.macroItem}>
                    <Text style={[styles.macroValue, { color: colors.nutrients.carbs }]}>
                      {totalNutrition.carbs}g
                    </Text>
                    <Text style={styles.macroLabel}>Gluc.</Text>
                  </View>
                  <View style={styles.macroItem}>
                    <Text style={[styles.macroValue, { color: colors.nutrients.fats }]}>
                      {totalNutrition.fats}g
                    </Text>
                    <Text style={styles.macroLabel}>Lip.</Text>
                  </View>
                </View>

                {/* Selected items list */}
                <View style={styles.selectedList}>
                  {selectedFoods.map(({ food, quantity, unit }) => (
                    <View key={food.id} style={styles.selectedItem}>
                      <View style={styles.selectedItemInfo}>
                        <Text style={styles.selectedItemName} numberOfLines={1}>
                          {food.name}
                        </Text>
                        <Text style={styles.selectedItemQuantity}>
                          {quantity} {getUnitLabel(unit)}
                        </Text>
                      </View>
                      <View style={styles.selectedItemActions}>
                        <TouchableOpacity
                          style={styles.quantityButton}
                          onPress={() => handleUpdateQuantity(food.id, -1)}
                        >
                          <Minus size={14} color={colors.text.secondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.quantityButton}
                          onPress={() => handleUpdateQuantity(food.id, 1)}
                        >
                          <Plus size={14} color={colors.text.secondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.removeButton}
                          onPress={() => handleRemoveFood(food.id)}
                        >
                          <X size={14} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              </Card>
            )}

            {/* Recent foods */}
            {recentFoods && recentFoods.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Recents</Text>
                <View style={styles.recentList}>
                  {recentFoods.slice(0, 5).map((food: FoodItem) => (
                    <TouchableOpacity
                      key={food.id}
                      style={styles.recentItem}
                      onPress={() => openQuantityModal(food)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.recentItemInfo}>
                        <Text style={styles.recentItemName} numberOfLines={1}>
                          {food.name}
                        </Text>
                        <Text style={styles.recentItemMeta}>
                          {food.servingSize}{food.servingUnit} · {food.nutrition.calories} kcal
                        </Text>
                      </View>
                      <View style={[
                        styles.addFoodButton,
                        isAdded(food.id) && styles.addFoodButtonSelected
                      ]}>
                        {isAdded(food.id) ? (
                          <Check size={16} color="#FFFFFF" />
                        ) : (
                          <Plus size={16} color={colors.accent.primary} />
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

          </ScrollView>
        )}

        {/* Search View */}
        {activeMethod === 'search' && (
          <>
            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <Search size={20} color={colors.text.tertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher un aliment, une marque..."
                placeholderTextColor={colors.text.muted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
              {isSearching && (
                <ActivityIndicator size="small" color={colors.accent.primary} />
              )}
              {searchQuery.length > 0 && !isSearching && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={20} color={colors.text.tertiary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Source Filter */}
            <View style={styles.sourceFilter}>
              <TouchableOpacity
                style={[
                  styles.sourceButton,
                  searchSource === 'all' && styles.sourceButtonActive,
                ]}
                onPress={() => setSearchSource('all')}
              >
                <Text style={[
                  styles.sourceButtonText,
                  searchSource === 'all' && styles.sourceButtonTextActive,
                ]}>Tous</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.sourceButton,
                  searchSource === 'generic' && styles.sourceButtonActive,
                ]}
                onPress={() => setSearchSource('generic')}
              >
                <Database size={14} color={searchSource === 'generic' ? '#FFFFFF' : colors.success} />
                <Text style={[
                  styles.sourceButtonText,
                  searchSource === 'generic' && styles.sourceButtonTextActive,
                ]}>Le Marche</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.sourceButton,
                  searchSource === 'branded' && styles.sourceButtonActive,
                ]}
                onPress={() => setSearchSource('branded')}
              >
                <ShoppingCart size={14} color={searchSource === 'branded' ? '#FFFFFF' : colors.warning} />
                <Text style={[
                  styles.sourceButtonText,
                  searchSource === 'branded' && styles.sourceButtonTextActive,
                ]}>Les Rayons</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.sourceButton,
                  searchSource === 'custom' && styles.sourceButtonActive,
                ]}
                onPress={() => setSearchSource('custom')}
              >
                <ChefHat size={14} color={searchSource === 'custom' ? '#FFFFFF' : colors.accent.primary} />
                <Text style={[
                  styles.sourceButtonText,
                  searchSource === 'custom' && styles.sourceButtonTextActive,
                ]}>Vos Recettes</Text>
              </TouchableOpacity>
            </View>

            {/* Food List */}
            <ScrollView
              style={styles.foodList}
              contentContainerStyle={styles.foodListContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Search info */}
              {lastSearchInfo && searchResults.length > 0 && (
                <View style={styles.searchInfo}>
                  <Text style={styles.searchInfoText}>
                    {lastSearchInfo.total} resultats
                    {lastSearchInfo.fromCache && ' (cache)'}
                  </Text>
                  <View style={styles.searchSources}>
                    {lastSearchInfo.sources.map(source => (
                      <View key={source} style={styles.sourceTag}>
                        {getSourceIcon(source)}
                        <Text style={styles.sourceTagText}>
                          {source === 'ciqual' ? 'Marche' : source === 'openfoodfacts' ? 'Rayons' : source === 'custom' ? 'Recettes' : source}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <Text style={styles.sectionTitle}>
                {searchQuery.length >= 2 ? 'Resultats' : 'Tapez au moins 2 caracteres'}
              </Text>

              {searchResults.map(food => {
                const isSelected = selectedFoods.some(sf => sf.food.id === food.id)
                return (
                  <TouchableOpacity
                    key={food.id}
                    style={[styles.foodItem, isSelected && styles.foodItemSelected]}
                    onPress={() => openQuantityModal(food)}
                    activeOpacity={0.7}
                  >
                    {food.imageUrl ? (
                      <Image
                        source={{ uri: food.imageUrl }}
                        style={styles.foodImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.foodImagePlaceholder}>
                        {food.source === 'ciqual' ? (
                          <Apple size={20} color={colors.text.tertiary} />
                        ) : (
                          <ShoppingCart size={20} color={colors.text.tertiary} />
                        )}
                      </View>
                    )}
                    <View style={styles.foodInfo}>
                      <View style={styles.foodNameRow}>
                        <Text style={styles.foodName} numberOfLines={1}>
                          {food.name}
                        </Text>
                        {food.nutriscore && food.nutriscore !== 'unknown' && (
                          <NutriScoreBadge grade={food.nutriscore} size="sm" />
                        )}
                        {food.source && (
                          <View style={styles.foodSourceBadge}>
                            {getSourceIcon(food.source)}
                          </View>
                        )}
                      </View>
                      <Text style={styles.foodMeta} numberOfLines={1}>
                        {food.nutrition.calories} kcal
                        {food.brand && ` · ${food.brand}`}
                      </Text>
                      <Text style={styles.foodMacros}>
                        P {food.nutrition.proteins}g · G {food.nutrition.carbs}g · L {food.nutrition.fats}g
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.favoriteButton}
                      onPress={(e) => {
                        e.stopPropagation()
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        if (isFavorite(food.id)) {
                          removeFromFavorites?.(food.id)
                        } else {
                          addToFavorites?.(food)
                        }
                      }}
                    >
                      <Star
                        size={20}
                        color={isFavorite(food.id) ? colors.warning : colors.text.tertiary}
                        fill={isFavorite(food.id) ? colors.warning : 'transparent'}
                      />
                    </TouchableOpacity>
                    <View style={[styles.addFoodButton, isSelected && styles.addFoodButtonSelected]}>
                      {isSelected || isAdded(food.id) ? (
                        <Check size={16} color="#FFFFFF" />
                      ) : (
                        <Plus size={16} color={colors.accent.primary} />
                      )}
                    </View>
                  </TouchableOpacity>
                )
              })}

              {/* Empty state for no query */}
              {searchQuery.length < 2 && (
                <View style={styles.emptyState}>
                  <Search size={48} color={colors.text.muted} />
                  <Text style={styles.emptyStateText}>Recherchez un aliment</Text>
                  <Text style={styles.emptyStateSubtext}>
                    Ex: poulet, riz, yaourt, Danone...
                  </Text>
                </View>
              )}

              {/* Empty state for no results */}
              {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>Aucun aliment trouve</Text>
                  <Text style={styles.emptyStateSubtext}>
                    Essayez une autre recherche
                  </Text>
                </View>
              )}

              {/* Loading state */}
              {isSearching && searchResults.length === 0 && (
                <View style={styles.emptyState}>
                  <ActivityIndicator size="large" color={colors.accent.primary} />
                  <Text style={styles.emptyStateText}>Recherche en cours...</Text>
                </View>
              )}
            </ScrollView>
          </>
        )}

        {/* Favorites View */}
        {activeMethod === 'favorites' && (
          <ScrollView
            style={styles.foodList}
            contentContainerStyle={styles.foodListContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Quick Search Bar */}
            <View style={styles.favoritesSearchContainer}>
              <Search size={18} color={colors.text.muted} />
              <TextInput
                style={styles.favoritesSearchInput}
                placeholder="Rechercher dans les favoris..."
                placeholderTextColor={colors.text.muted}
                value={favoritesSearch}
                onChangeText={setFavoritesSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {favoritesSearch.length > 0 && (
                <TouchableOpacity onPress={() => setFavoritesSearch('')}>
                  <X size={18} color={colors.text.muted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Tabs */}
            <View style={styles.favoritesTabsContainer}>
              <TouchableOpacity
                style={[
                  styles.favoritesTab,
                  favoritesTab === 'foods' && styles.favoritesTabActive,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setFavoritesTab('foods')
                }}
              >
                <Apple size={18} color={favoritesTab === 'foods' ? colors.accent.primary : colors.text.tertiary} />
                <Text style={[
                  styles.favoritesTabText,
                  favoritesTab === 'foods' && styles.favoritesTabTextActive,
                ]}>
                  Aliments ({favoriteFoods?.length || 0})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.favoritesTab,
                  favoritesTab === 'recipes' && styles.favoritesTabActive,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setFavoritesTab('recipes')
                }}
              >
                <ChefHat size={18} color={favoritesTab === 'recipes' ? colors.accent.primary : colors.text.tertiary} />
                <Text style={[
                  styles.favoritesTabText,
                  favoritesTab === 'recipes' && styles.favoritesTabTextActive,
                ]}>
                  Recettes ({favoriteRecipes?.length || 0})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Foods Tab */}
            {favoritesTab === 'foods' && (
              <>
                {favoriteFoods && favoriteFoods.length > 0 ? (
                  <View style={styles.favoritesList}>
                    {favoriteFoods
                      .filter((food: FoodItem) =>
                        favoritesSearch.length === 0 ||
                        food.name.toLowerCase().includes(favoritesSearch.toLowerCase())
                      )
                      .map((food: FoodItem) => (
                      <View key={food.id} style={styles.favoriteItem}>
                        <TouchableOpacity
                          style={styles.favoriteItemContent}
                          onPress={() => openQuantityModal(food)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.favoriteItemIcon}>
                            <Apple size={20} color={colors.accent.primary} />
                          </View>
                          <View style={styles.favoriteItemInfo}>
                            <Text style={styles.favoriteItemName} numberOfLines={1}>
                              {food.name}
                            </Text>
                            <Text style={styles.favoriteItemMeta}>
                              {food.nutrition.calories} kcal · P {food.nutrition.proteins}g · G {food.nutrition.carbs}g
                            </Text>
                          </View>
                          <View style={[
                            styles.addFoodButton,
                            isAdded(food.id) && styles.addFoodButtonSelected
                          ]}>
                            {isAdded(food.id) ? (
                              <Check size={16} color="#FFFFFF" />
                            ) : (
                              <Plus size={16} color={colors.accent.primary} />
                            )}
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.deleteFavoriteButton}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                            Alert.alert(
                              'Supprimer des favoris',
                              `Retirer "${food.name}" de tes favoris ?`,
                              [
                                { text: 'Annuler', style: 'cancel' },
                                {
                                  text: 'Supprimer',
                                  style: 'destructive',
                                  onPress: () => removeFromFavorites?.(food.id),
                                },
                              ]
                            )
                          }}
                        >
                          <Trash2 size={18} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <Apple size={48} color={colors.text.muted} />
                    <Text style={styles.emptyStateText}>Aucun aliment favori</Text>
                    <Text style={styles.emptyStateSubtext}>
                      Ajoute des aliments a tes favoris lors de la recherche
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* Recipes Tab */}
            {favoritesTab === 'recipes' && (
              <>
                {favoriteRecipes && favoriteRecipes.length > 0 ? (
                  <View style={styles.favoritesList}>
                    {favoriteRecipes
                      .filter((recipe) =>
                        favoritesSearch.length === 0 ||
                        recipe.title.toLowerCase().includes(favoritesSearch.toLowerCase())
                      )
                      .map((recipe) => (
                      <View key={recipe.id} style={styles.favoriteItem}>
                        <TouchableOpacity
                          style={styles.favoriteItemContent}
                          onPress={() => handleRecipePress(recipe)}
                          activeOpacity={0.7}
                        >
                          {recipe.imageUrl ? (
                            <Image
                              source={{ uri: recipe.imageUrl }}
                              style={styles.favoriteRecipeImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={styles.favoriteItemIcon}>
                              <ChefHat size={20} color={colors.warning} />
                            </View>
                          )}
                          <View style={styles.favoriteItemInfo}>
                            <Text style={styles.favoriteItemName} numberOfLines={1}>
                              {recipe.title}
                            </Text>
                            <Text style={styles.favoriteItemMeta}>
                              {recipe.nutrition?.calories || 0} kcal · {recipe.prepTime + (recipe.cookTime || 0)} min
                            </Text>
                            {recipe.source && (
                              <View style={styles.recipeSourceBadge}>
                                <Text style={styles.recipeSourceText}>
                                  {recipe.source === 'ai' ? '🤖 IA' : '🍽️ Gustar'}
                                </Text>
                              </View>
                            )}
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.deleteFavoriteButton}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                            Alert.alert(
                              'Supprimer des favoris',
                              `Retirer "${recipe.title}" de tes favoris ?`,
                              [
                                { text: 'Annuler', style: 'cancel' },
                                {
                                  text: 'Supprimer',
                                  style: 'destructive',
                                  onPress: () => removeRecipeFromFavorites(recipe.id),
                                },
                              ]
                            )
                          }}
                        >
                          <Trash2 size={18} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <ChefHat size={48} color={colors.text.muted} />
                    <Text style={styles.emptyStateText}>Aucune recette favorite</Text>
                    <Text style={styles.emptyStateSubtext}>
                      Decouvrez des recettes IA ou Gustar et ajoutez-les aux favoris
                    </Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        )}

        {/* Save Button */}
        {selectedFoods.length > 0 && (
          <View style={styles.bottomBar}>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onPress={handleSaveMeal}
            >
              <Check size={20} color="#FFFFFF" />
              <Text style={styles.saveButtonText}>
                Enregistrer ({totalNutrition.calories} kcal)
              </Text>
            </Button>
          </View>
        )}

        {/* Quantity Selector Modal */}
        <Modal
          visible={quantityModal.isOpen}
          animationType="slide"
          transparent
          onRequestClose={closeQuantityModal}
        >
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            <TouchableOpacity
              style={styles.modalBackdrop}
              activeOpacity={1}
              onPress={closeQuantityModal}
            />
            <View style={styles.modalContent}>
              {/* Handle bar */}
              <View style={styles.modalHandle} />

              {quantityModal.food && (
                <>
                  {/* Header */}
                  <View style={styles.modalHeader}>
                    {quantityModal.food.imageUrl ? (
                      <Image
                        source={{ uri: quantityModal.food.imageUrl }}
                        style={styles.modalFoodImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.modalFoodImagePlaceholder}>
                        <Apple size={24} color={colors.accent.primary} />
                      </View>
                    )}
                    <View style={styles.modalFoodInfo}>
                      <Text style={styles.modalFoodName} numberOfLines={2}>
                        {quantityModal.food.name}
                      </Text>
                      <Text style={styles.modalFoodMeta}>
                        {quantityModal.food.source === 'recipe' || quantityModal.food.isRecipe
                          ? 'Valeurs nutritionnelles par portion'
                          : 'Valeurs nutritionnelles pour 100g'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.modalCloseButton}
                      onPress={closeQuantityModal}
                    >
                      <X size={20} color={colors.text.tertiary} />
                    </TouchableOpacity>
                  </View>

                  {/* Unit selector */}
                  <View style={styles.unitSection}>
                    <Text style={styles.unitSectionTitle}>Unite de mesure</Text>
                    <View style={styles.unitGrid}>
                      {availableUnits.map((unit) => (
                        <TouchableOpacity
                          key={unit.id}
                          style={[
                            styles.unitButton,
                            quantityModal.unit === unit.id && styles.unitButtonActive,
                          ]}
                          onPress={() => changeUnit(unit.id)}
                        >
                          <Text style={[
                            styles.unitButtonText,
                            quantityModal.unit === unit.id && styles.unitButtonTextActive,
                          ]}>
                            {unit.shortLabel}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Quantity input */}
                  <View style={styles.quantitySection}>
                    <Text style={styles.unitSectionTitle}>Quantite</Text>
                    <View style={styles.quantityInputRow}>
                      <TouchableOpacity
                        style={styles.quantityAdjustButton}
                        onPress={() => adjustQuantity(-1)}
                      >
                        <Minus size={20} color={colors.text.primary} />
                      </TouchableOpacity>

                      <View style={styles.quantityInputContainer}>
                        <TextInput
                          style={styles.quantityInput}
                          value={quantityInputText}
                          onChangeText={handleQuantityTextChange}
                          onBlur={handleQuantityTextBlur}
                          keyboardType="numeric"
                          selectTextOnFocus
                          returnKeyType="done"
                          blurOnSubmit
                        />
                        <Text style={styles.quantityInputUnit}>
                          {getUnitLabel(quantityModal.unit)}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.quantityAdjustButton}
                        onPress={() => adjustQuantity(1)}
                      >
                        <Plus size={20} color={colors.text.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Quick presets */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.presetsScroll}
                    contentContainerStyle={styles.presetsContent}
                  >
                    {getPresets(quantityModal.unit).map((preset) => (
                      <TouchableOpacity
                        key={preset}
                        style={[
                          styles.presetButton,
                          quantityModal.quantity === preset && styles.presetButtonActive,
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                          setQuantityValue(preset)
                        }}
                      >
                        <Text style={[
                          styles.presetButtonText,
                          quantityModal.quantity === preset && styles.presetButtonTextActive,
                        ]}>
                          {preset}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Calculated nutrition */}
                  {(() => {
                    const nutrition = calculateModalNutrition()
                    return (
                      <View style={styles.nutritionGrid}>
                        <View style={styles.nutritionItem}>
                          <Text style={[styles.nutritionValue, { color: colors.nutrients.calories }]}>
                            {nutrition.calories}
                          </Text>
                          <Text style={styles.nutritionLabel}>kcal</Text>
                        </View>
                        <View style={styles.nutritionItem}>
                          <Text style={[styles.nutritionValue, { color: colors.nutrients.proteins }]}>
                            {nutrition.proteins}g
                          </Text>
                          <Text style={styles.nutritionLabel}>Prot.</Text>
                        </View>
                        <View style={styles.nutritionItem}>
                          <Text style={[styles.nutritionValue, { color: colors.nutrients.carbs }]}>
                            {nutrition.carbs}g
                          </Text>
                          <Text style={styles.nutritionLabel}>Gluc.</Text>
                        </View>
                        <View style={styles.nutritionItem}>
                          <Text style={[styles.nutritionValue, { color: colors.nutrients.fats }]}>
                            {nutrition.fats}g
                          </Text>
                          <Text style={styles.nutritionLabel}>Lip.</Text>
                        </View>
                      </View>
                    )
                  })()}

                  {/* Confirm button */}
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={confirmAddFood}
                  >
                    <Check size={20} color="#FFFFFF" />
                    <Text style={styles.confirmButtonText}>Ajouter</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Barcode Scanner Modal */}
        <BarcodeScanner
          visible={showBarcodeScanner}
          onClose={() => setShowBarcodeScanner(false)}
          onFoodFound={handleBarcodeFoodFound}
        />

        {/* Photo Scanner Modal */}
        <PhotoFoodScanner
          visible={showPhotoScanner}
          onClose={() => setShowPhotoScanner(false)}
          onFoodsDetected={handleFoodsFound}
        />

        {/* Voice Input Modal */}
        <VoiceFoodInput
          visible={showVoiceInput}
          onClose={() => setShowVoiceInput(false)}
          onFoodsDetected={handleFoodsFound}
        />

        {/* AI Recipe Modal */}
        <Modal visible={showAIRecipeModal} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={styles.recipeModalContainer}>
            {/* Modal Header */}
            <View style={styles.recipeModalHeader}>
              <TouchableOpacity style={styles.recipeModalCloseButton} onPress={() => setShowAIRecipeModal(false)}>
                <X size={24} color={colors.text.primary} />
              </TouchableOpacity>
              <Text style={styles.recipeModalTitle}>Plan Repas IA</Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.recipeModalScroll} showsVerticalScrollIndicator={false}>
              {/* Mode Selector: Suggestion vs Plan */}
              <View style={styles.modeSelector}>
                <TouchableOpacity
                  style={[styles.modeTab, generationMode === 'suggestion' && styles.modeTabActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setGenerationMode('suggestion')
                    setSuggestedRecipe(null)
                  }}
                >
                  <Sparkles size={18} color={generationMode === 'suggestion' ? '#FFFFFF' : colors.text.secondary} />
                  <Text style={[styles.modeTabText, generationMode === 'suggestion' && styles.modeTabTextActive]}>
                    Suggestion
                  </Text>
                </TouchableOpacity>
                {/* Plan repas tab - HIDDEN for now
                <TouchableOpacity
                  style={[styles.modeTab, generationMode === 'plan' && styles.modeTabActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setGenerationMode('plan')
                    setSuggestedRecipe(null)
                  }}
                >
                  <CalendarDays size={18} color={generationMode === 'plan' ? '#FFFFFF' : colors.text.secondary} />
                  <Text style={[styles.modeTabText, generationMode === 'plan' && styles.modeTabTextActive]}>
                    Plan repas
                  </Text>
                </TouchableOpacity>
                */}
              </View>

              {/* AI Suggestion Card */}
              <LinearGradient
                colors={[`${colors.accent.primary}15`, `${colors.secondary.primary}15`]}
                style={styles.aiCard}
              >
                <View style={styles.aiHeader}>
                  <Sparkles size={20} color={colors.warning} />
                  <Text style={styles.aiTitle}>
                    {generationMode === 'suggestion' ? 'Suggestion de repas' : 'Plan repas personnalise'}
                  </Text>
                </View>
                <Text style={styles.aiDescription}>
                  {generationMode === 'suggestion'
                    ? 'LymIA te suggère un repas adapté à ton profil et tes besoins caloriques du moment.'
                    : 'LymIA génère un plan repas complet adapté à ton profil nutritionnel.'}
                </Text>

                {/* Plan Duration Selector (only for plan mode) */}
                {generationMode === 'plan' && (
                  <>
                    <Text style={styles.mealTypeLabel}>Duree du plan</Text>
                    <View style={styles.mealTypeRow}>
                      {([1, 3] as const).map((duration) => {
                        const icons = { 1: Calendar, 3: CalendarDays }
                        const labels = { 1: '1 jour', 3: '3 jours' }
                        const Icon = icons[duration]
                        const isSelected = planDuration === duration
                        return (
                          <TouchableOpacity
                            key={duration}
                            style={[styles.durationChip, isSelected && styles.durationChipActive]}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                              setPlanDuration(duration)
                            }}
                          >
                            <Icon size={16} color={isSelected ? '#FFFFFF' : colors.text.secondary} />
                            <Text style={[styles.durationText, isSelected && styles.durationTextActive]}>
                              {labels[duration]}
                            </Text>
                          </TouchableOpacity>
                        )
                      })}
                    </View>
                  </>
                )}

                {/* Meal Type Selector (only for suggestion mode) */}
                {generationMode === 'suggestion' && (
                  <>
                    <Text style={styles.mealTypeLabel}>Pour quel repas ?</Text>
                    <View style={styles.mealTypeRow}>
                      {mealTypeOptions.map((option) => (
                        <TouchableOpacity
                          key={option.id}
                          style={[styles.mealTypeChip, selectedMealType === option.id && styles.mealTypeChipActive]}
                          onPress={() => {
                            setSelectedMealType(option.id)
                            // Reset excluded recipes when changing meal type
                            setExcludedRecipeIds([])
                            setLastSuggestedRecipeId(null)
                          }}
                        >
                          <Text style={styles.mealTypeEmoji}>{option.icon}</Text>
                          <Text style={[styles.mealTypeText, selectedMealType === option.id && styles.mealTypeTextActive]}>
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                {/* Calorie Reduction Toggle */}
                <TouchableOpacity
                  style={[styles.reductionToggle, calorieReduction && styles.reductionToggleActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setCalorieReduction(!calorieReduction)
                  }}
                >
                  <View style={styles.reductionLeft}>
                    <Percent size={16} color={calorieReduction ? colors.success : colors.text.secondary} />
                    <View>
                      <Text style={[styles.reductionTitle, calorieReduction && styles.reductionTitleActive]}>
                        Mode economie -10%
                      </Text>
                      <Text style={styles.reductionSubtitle}>Accumule des calories pour un repas plaisir</Text>
                    </View>
                  </View>
                  <View style={[styles.reductionCheck, calorieReduction && styles.reductionCheckActive]}>
                    {calorieReduction && <Check size={14} color="#FFFFFF" />}
                  </View>
                </TouchableOpacity>

                {/* RAG Info Card */}
                <View style={styles.ragInfoCard}>
                  <Database size={16} color={colors.accent.primary} />
                  <Text style={styles.ragInfoText}>
                    Sources: Gustar, OFF, CIQUAL, IA{'\n'}
                    <Text style={styles.ragInfoHint}>Changer les sources de recettes dans Profil → Parametres</Text>
                  </Text>
                </View>
              </LinearGradient>

              {/* Generate Button - Prominent CTA outside the gradient card */}
              <TouchableOpacity
                style={[styles.generateButton, isSuggesting && styles.generateButtonDisabled]}
                onPress={() => handleAISuggest()}
                disabled={isSuggesting}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={isSuggesting ? ['#9CA3AF', '#6B7280'] : ['#4A6741', '#5C7A52']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.generateButtonGradient}
                >
                  {isSuggesting ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.generateButtonText}>Generation en cours...</Text>
                    </>
                  ) : (
                    <>
                      <Sparkles size={22} color="#FFFFFF" />
                      <Text style={styles.generateButtonText}>
                        {generationMode === 'suggestion'
                          ? 'Suggerer un repas'
                          : `Générer ${planDuration} jour${planDuration > 1 ? 's' : ''} de repas`}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Generated Recipe Display (only in suggestion mode) */}
              {suggestedRecipe && generationMode === 'suggestion' && (
                <View style={styles.suggestedRecipeCard}>
                  {/* Recipe Header */}
                  <View style={styles.suggestedRecipeHeader}>
                    <View style={styles.suggestedRecipeSourceBadge}>
                      <Database size={12} color="#FFFFFF" />
                      <Text style={styles.suggestedRecipeSourceText}>
                        {lastMealSource?.label || 'LymIA'}
                      </Text>
                    </View>
                    <Text style={styles.suggestedRecipeConfidence}>
                      {lastMealSource ? `${Math.round(lastMealSource.confidence * 100)}%` : ''}
                    </Text>
                  </View>

                  {/* Recipe Image or Placeholder */}
                  {suggestedRecipe.imageUrl ? (
                    <Image
                      source={{ uri: suggestedRecipe.imageUrl }}
                      style={styles.suggestedRecipeImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <LinearGradient
                      colors={[colors.accent.primary, colors.secondary.primary]}
                      style={styles.suggestedRecipeImagePlaceholder}
                    >
                      <ChefHat size={48} color="#FFFFFF" />
                    </LinearGradient>
                  )}

                  {/* Recipe Info */}
                  <Text style={styles.suggestedRecipeTitle}>{suggestedRecipe.title}</Text>
                  {suggestedRecipe.description && (
                    <Text style={styles.suggestedRecipeDescription} numberOfLines={2}>
                      {suggestedRecipe.description}
                    </Text>
                  )}

                  {/* Recipe Meta */}
                  <View style={styles.suggestedRecipeMeta}>
                    <View style={styles.suggestedRecipeMetaItem}>
                      <Clock size={14} color={colors.text.secondary} />
                      <Text style={styles.suggestedRecipeMetaText}>{suggestedRecipe.prepTime} min</Text>
                    </View>
                    <View style={styles.suggestedRecipeMetaItem}>
                      <Users size={14} color={colors.text.secondary} />
                      <Text style={styles.suggestedRecipeMetaText}>{suggestedRecipe.servings} pers.</Text>
                    </View>
                    <View style={styles.suggestedRecipeMetaItem}>
                      <Flame size={14} color={colors.nutrients.calories} />
                      <Text style={styles.suggestedRecipeMetaText}>{suggestedRecipe.nutrition.calories} kcal</Text>
                    </View>
                  </View>

                  {/* Nutrition Summary */}
                  <View style={styles.suggestedRecipeNutrition}>
                    <View style={[styles.nutritionPill, { backgroundColor: `${colors.nutrients.proteins}20` }]}>
                      <Text style={[styles.nutritionPillText, { color: colors.nutrients.proteins }]}>
                        P: {suggestedRecipe.nutrition.proteins}g
                      </Text>
                    </View>
                    <View style={[styles.nutritionPill, { backgroundColor: `${colors.nutrients.carbs}20` }]}>
                      <Text style={[styles.nutritionPillText, { color: colors.nutrients.carbs }]}>
                        G: {suggestedRecipe.nutrition.carbs}g
                      </Text>
                    </View>
                    <View style={[styles.nutritionPill, { backgroundColor: `${colors.nutrients.fats}20` }]}>
                      <Text style={[styles.nutritionPillText, { color: colors.nutrients.fats }]}>
                        L: {suggestedRecipe.nutrition.fats}g
                      </Text>
                    </View>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.suggestedRecipeActions}>
                    <TouchableOpacity
                      style={styles.suggestedRecipeSecondaryButton}
                      onPress={() => {
                        setSuggestedRecipe(null)
                        handleAISuggest()
                      }}
                    >
                      <RefreshCw size={16} color={colors.accent.primary} />
                      <Text style={styles.suggestedRecipeSecondaryButtonText}>Autre suggestion</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.suggestedRecipePrimaryButton}
                      onPress={() => {
                        if (selectedRecipe) {
                          handleAddRecipeToMeal()
                          setSuggestedRecipe(null)
                          setShowAIRecipeModal(false)
                        }
                      }}
                    >
                      <Plus size={16} color="#FFFFFF" />
                      <Text style={styles.suggestedRecipePrimaryButtonText}>Ajouter ce repas</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={{ height: spacing['3xl'] }} />
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* Discover Modal - Now using RecipeDiscovery component */}
        <Modal visible={showDiscoverModal} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={styles.recipeModalContainer}>
            {/* Modal Header */}
            <View style={styles.recipeModalHeader}>
              <TouchableOpacity style={styles.recipeModalCloseButton} onPress={() => setShowDiscoverModal(false)}>
                <X size={24} color={colors.text.primary} />
              </TouchableOpacity>
              <Text style={styles.recipeModalTitle}>Decouvrir des recettes</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Recipe Discovery Component with auto-fetch and filters */}
            <RecipeDiscovery
              onRecipePress={(recipe) => {
                handleRecipePress(recipe)
              }}
              onClose={() => setShowDiscoverModal(false)}
            />
          </SafeAreaView>
        </Modal>

        {/* Recipe Detail Modal */}
        <Modal visible={showRecipeDetailModal} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={styles.recipeModalContainer}>
            {selectedRecipe && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Modal Header */}
                <View style={styles.recipeDetailHeader}>
                  <TouchableOpacity style={styles.recipeModalCloseButton} onPress={() => setShowRecipeDetailModal(false)}>
                    <X size={24} color={colors.text.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.recipeModalCloseButton}
                    onPress={() => handleToggleRecipeFavorite(selectedRecipe)}
                  >
                    <Heart
                      size={24}
                      color={isRecipeFavorite(selectedRecipe.id) ? colors.error : colors.text.secondary}
                      fill={isRecipeFavorite(selectedRecipe.id) ? colors.error : 'transparent'}
                    />
                  </TouchableOpacity>
                </View>

                {/* Recipe Image */}
                {selectedRecipe.imageUrl ? (
                  <Image source={{ uri: selectedRecipe.imageUrl }} style={styles.recipeDetailImage} resizeMode="cover" />
                ) : (
                  <LinearGradient
                    colors={[colors.accent.primary, colors.secondary.primary]}
                    style={styles.recipeDetailImagePlaceholder}
                  >
                    <ChefHat size={64} color="#FFFFFF" />
                  </LinearGradient>
                )}

                {/* Recipe Info */}
                <View style={styles.recipeDetailContent}>
                  <Text style={styles.recipeDetailTitle}>{selectedRecipe.title}</Text>
                  {selectedRecipe.description && (
                    <Text style={styles.recipeDetailDescription}>{selectedRecipe.description}</Text>
                  )}

                  {/* Meta */}
                  <View style={styles.recipeDetailMeta}>
                    <View style={styles.recipeDetailMetaItem}>
                      <Clock size={18} color={colors.accent.primary} />
                      <Text style={styles.recipeDetailMetaValue}>{selectedRecipe.totalTime} min</Text>
                    </View>
                    <View style={styles.recipeDetailMetaItem}>
                      <Users size={18} color={colors.accent.primary} />
                      <Text style={styles.recipeDetailMetaValue}>{selectedRecipe.servings} pers.</Text>
                    </View>
                    <View style={styles.recipeDetailMetaItem}>
                      <Flame size={18} color={colors.nutrients.calories} />
                      <Text style={styles.recipeDetailMetaValue}>
                        {selectedRecipe.nutritionPerServing?.calories || selectedRecipe.nutrition.calories} kcal
                      </Text>
                    </View>
                  </View>

                  {/* Nutrition */}
                  <View style={styles.nutritionDetailCard}>
                    <Text style={styles.recipeDetailSectionTitle}>Nutrition par portion</Text>
                    <View style={styles.nutritionDetailRow}>
                      <View style={styles.nutritionDetailItem}>
                        <Text style={[styles.nutritionDetailValue, { color: colors.nutrients.proteins }]}>
                          {selectedRecipe.nutritionPerServing?.proteins || selectedRecipe.nutrition.proteins}g
                        </Text>
                        <Text style={styles.nutritionDetailLabel}>Proteines</Text>
                      </View>
                      <View style={styles.nutritionDetailItem}>
                        <Text style={[styles.nutritionDetailValue, { color: colors.nutrients.carbs }]}>
                          {selectedRecipe.nutritionPerServing?.carbs || selectedRecipe.nutrition.carbs}g
                        </Text>
                        <Text style={styles.nutritionDetailLabel}>Glucides</Text>
                      </View>
                      <View style={styles.nutritionDetailItem}>
                        <Text style={[styles.nutritionDetailValue, { color: colors.nutrients.fats }]}>
                          {selectedRecipe.nutritionPerServing?.fats || selectedRecipe.nutrition.fats}g
                        </Text>
                        <Text style={styles.nutritionDetailLabel}>Lipides</Text>
                      </View>
                    </View>
                  </View>

                  {/* Ingredients */}
                  {selectedRecipe.ingredients.length > 0 && (
                    <View style={styles.recipeDetailSection}>
                      <Text style={styles.recipeDetailSectionTitle}>Ingredients</Text>
                      {selectedRecipe.ingredients.map((ing, idx) => (
                        <View key={idx} style={styles.ingredientRow}>
                          <View style={styles.ingredientBullet} />
                          <Text style={styles.ingredientText}>
                            {ing.amount} {ing.unit} {ing.name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Instructions */}
                  {selectedRecipe.instructions.length > 0 && (
                    <View style={styles.recipeDetailSection}>
                      <Text style={styles.recipeDetailSectionTitle}>Instructions</Text>
                      {selectedRecipe.instructions.map((step, idx) => (
                        <View key={idx} style={styles.instructionRow}>
                          <View style={styles.instructionNumber}>
                            <Text style={styles.instructionNumberText}>{idx + 1}</Text>
                          </View>
                          <Text style={styles.instructionText}>{step}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Rating Section */}
                  <View style={styles.ratingSection}>
                    <Text style={styles.recipeDetailSectionTitle}>Noter cette recette</Text>
                    <Text style={styles.ratingSubtitle}>
                      Les recettes les mieux notees apparaitront dans tes suggestions
                    </Text>

                    {/* Star Rating */}
                    <View style={styles.starsContainer}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <TouchableOpacity
                          key={star}
                          onPress={() => handleRateRecipe(star)}
                          style={styles.starButton}
                        >
                          <Star
                            size={32}
                            color="#D4A574"
                            fill={star <= userRating ? '#D4A574' : 'transparent'}
                          />
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Comment Input */}
                    <TextInput
                      style={styles.commentInput}
                      placeholder="Ajouter un commentaire (optionnel)..."
                      placeholderTextColor={colors.text.muted}
                      value={userComment}
                      onChangeText={setUserComment}
                      multiline
                      numberOfLines={2}
                    />

                    {/* Save Rating Button */}
                    {userRating > 0 && (
                      <Button
                        variant="primary"
                        size="lg"
                        fullWidth
                        onPress={handleSaveRating}
                        style={{ marginTop: spacing.md }}
                      >
                        <Check size={18} color="#FFFFFF" />
                        <Text style={styles.buttonText}>Enregistrer ma note</Text>
                      </Button>
                    )}
                  </View>

                  {/* Add to Meal Section */}
                  <View style={styles.addToMealSection}>
                    <Text style={styles.addToMealTitle}>Ajouter au repas</Text>

                    {/* Meal Type Selector */}
                    <View style={styles.mealTypeSelectorRow}>
                      {mealTypeOptions.map((meal) => (
                        <TouchableOpacity
                          key={meal.id}
                          style={[
                            styles.mealTypeOption,
                            addToMealType === meal.id && styles.mealTypeOptionActive
                          ]}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                            setAddToMealType(meal.id)
                          }}
                        >
                          <Text style={styles.mealTypeEmoji}>{meal.icon}</Text>
                          <Text style={[
                            styles.mealTypeLabel,
                            addToMealType === meal.id && styles.mealTypeLabelActive
                          ]}>
                            {meal.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Add to Meal Button */}
                    <Button
                      variant="default"
                      size="lg"
                      fullWidth
                      onPress={handleAddRecipeToMeal}
                      style={{ marginTop: spacing.md }}
                    >
                      <Plus size={18} color="#FFFFFF" />
                      <Text style={styles.buttonText}>
                        Ajouter au {mealConfig[addToMealType]?.label || 'repas'}
                      </Text>
                    </Button>
                  </View>

                  {/* Add to favorites button */}
                  <Button
                    variant={isRecipeFavorite(selectedRecipe.id) ? 'outline' : 'primary'}
                    size="lg"
                    fullWidth
                    onPress={() => handleToggleRecipeFavorite(selectedRecipe)}
                    style={{ marginTop: spacing.md }}
                  >
                    <Heart
                      size={18}
                      color={isRecipeFavorite(selectedRecipe.id) ? colors.error : '#FFFFFF'}
                      fill={isRecipeFavorite(selectedRecipe.id) ? colors.error : 'transparent'}
                    />
                    <Text style={[styles.buttonText, isRecipeFavorite(selectedRecipe.id) && { color: colors.error }]}>
                      {isRecipeFavorite(selectedRecipe.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                    </Text>
                  </Button>

                  <View style={{ height: spacing['2xl'] }} />
                </View>
              </ScrollView>
            )}
          </SafeAreaView>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.default,
    paddingBottom: spacing.sm,
  },
  backButton: {
    padding: spacing.sm,
    marginLeft: -spacing.sm,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerEmoji: {
    fontSize: 24,
  },
  headerText: {
    ...typography.h4,
    color: colors.text.primary,
    fontFamily: fonts.sans.bold,
  },
  saveButton: {
    padding: spacing.sm,
    marginRight: -spacing.sm,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  methodContent: {
    padding: spacing.default,
    paddingBottom: spacing['3xl'],
  },
  mealTypeSelector: {
    flexDirection: 'row',
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.default,
    padding: 4,
    marginBottom: spacing.xl,
  },
  mealTypeSelectorChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.default - 2,
  },
  mealTypeSelectorChipActive: {
    backgroundColor: colors.bg.elevated,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  mealTypeSelectorEmoji: {
    fontSize: 18,
    marginBottom: 2,
  },
  mealTypeSelectorText: {
    ...typography.caption,
    fontFamily: fonts.sans.medium,
    color: colors.text.tertiary,
  },
  mealTypeSelectorTextActive: {
    color: colors.text.primary,
    fontFamily: fonts.sans.semibold,
  },
  methodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  methodButton: {
    width: '30%',
    alignItems: 'center',
    padding: spacing.default,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.default, // iOS 8px
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  methodIconContainer: {
    width: 52,
    height: 52,
    borderRadius: radius.default, // iOS 8px
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  methodLabel: {
    ...typography.smallMedium,
    color: colors.text.primary,
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.default,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.default, // iOS 8px
    borderWidth: 1,
    borderColor: colors.border.light,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
    paddingVertical: spacing.xs,
  },
  sourceFilter: {
    flexDirection: 'row',
    paddingHorizontal: spacing.default,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  sourceButtonActive: {
    backgroundColor: colors.accent.primary,
    borderColor: colors.accent.primary,
  },
  sourceButtonText: {
    ...typography.small,
    color: colors.text.secondary,
  },
  sourceButtonTextActive: {
    color: '#FFFFFF',
  },
  summaryCard: {
    marginBottom: spacing.xl,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  summaryTitle: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  summaryCalories: {
    ...typography.h4,
    fontWeight: '700',
  },
  macrosRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  macroItem: {
    alignItems: 'center',
  },
  macroValue: {
    ...typography.bodySemibold,
  },
  macroLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  selectedList: {
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingTop: spacing.sm,
  },
  selectedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  selectedItemInfo: {
    flex: 1,
  },
  selectedItemName: {
    ...typography.small,
    color: colors.text.primary,
  },
  selectedItemQuantity: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  selectedItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.bg.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: `${colors.error}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.xs,
  },
  recentList: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.default, // iOS 8px
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  recentItemInfo: {
    flex: 1,
  },
  recentItemName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  recentItemMeta: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  foodList: {
    flex: 1,
  },
  foodListContent: {
    padding: spacing.default,
    paddingBottom: spacing['3xl'],
  },
  searchInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  searchInfoText: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  searchSources: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  sourceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.sm,
  },
  sourceTagText: {
    ...typography.caption,
    color: colors.text.tertiary,
    fontSize: 10,
  },
  sectionTitle: {
    ...typography.caption,
    fontFamily: fonts.sans.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  foodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.default, // iOS 8px
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  foodItemSelected: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.accent.light,
  },
  foodImage: {
    width: 48,
    height: 48,
    borderRadius: radius.default, // iOS 8px
    marginRight: spacing.md,
    backgroundColor: colors.bg.tertiary,
  },
  foodImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: radius.default, // iOS 8px
    marginRight: spacing.md,
    backgroundColor: colors.bg.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  foodInfo: {
    flex: 1,
  },
  foodNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  foodName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    flex: 1,
  },
  foodSourceBadge: {
    marginLeft: spacing.xs,
  },
  foodMeta: {
    ...typography.small,
    color: colors.text.secondary,
    marginTop: 2,
  },
  foodMacros: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  favoriteButton: {
    padding: spacing.sm,
    marginRight: spacing.xs,
  },
  addFoodButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.accent.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addFoodButtonSelected: {
    backgroundColor: colors.accent.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    gap: spacing.sm,
  },
  emptyStateText: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
  },
  emptyStateSubtext: {
    ...typography.small,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  bottomBar: {
    padding: spacing.default,
    backgroundColor: colors.bg.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  saveButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    marginLeft: spacing.sm,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: colors.bg.primary,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingBottom: spacing['2xl'],
    maxHeight: '85%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border.default,
    borderRadius: radius.full,
    alignSelf: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.default,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  modalFoodImage: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
  },
  modalFoodImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.bg.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalFoodInfo: {
    flex: 1,
  },
  modalFoodName: {
    ...typography.bodySemibold,
    color: colors.text.primary,
  },
  modalFoodMeta: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  modalCloseButton: {
    padding: spacing.sm,
    marginRight: -spacing.sm,
  },
  unitSection: {
    paddingHorizontal: spacing.default,
    marginBottom: spacing.lg,
  },
  unitSectionTitle: {
    ...typography.caption,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  unitGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  unitButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  unitButtonActive: {
    backgroundColor: colors.accent.primary,
  },
  unitButtonText: {
    ...typography.smallMedium,
    color: colors.text.secondary,
  },
  unitButtonTextActive: {
    color: '#FFFFFF',
  },
  quantitySection: {
    paddingHorizontal: spacing.default,
    marginBottom: spacing.lg,
  },
  quantityInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  quantityAdjustButton: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.bg.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityInputContainer: {
    flex: 1,
    position: 'relative',
  },
  quantityInput: {
    height: 48,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    ...typography.h3,
    color: colors.text.primary,
    textAlign: 'center',
    paddingRight: 50,
  },
  quantityInputUnit: {
    position: 'absolute',
    right: spacing.md,
    top: '50%',
    transform: [{ translateY: -8 }],
    ...typography.small,
    color: colors.text.tertiary,
  },
  presetsScroll: {
    marginBottom: spacing.lg,
  },
  presetsContent: {
    paddingHorizontal: spacing.default,
    gap: spacing.sm,
  },
  presetButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
  },
  presetButtonActive: {
    backgroundColor: `${colors.accent.primary}20`,
    borderWidth: 1,
    borderColor: colors.accent.primary,
  },
  presetButtonText: {
    ...typography.smallMedium,
    color: colors.text.secondary,
  },
  presetButtonTextActive: {
    color: colors.accent.primary,
  },
  nutritionGrid: {
    flexDirection: 'row',
    marginHorizontal: spacing.default,
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
  },
  nutritionItem: {
    flex: 1,
    alignItems: 'center',
  },
  nutritionValue: {
    ...typography.bodySemibold,
    fontSize: 18,
  },
  nutritionLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.default,
    paddingVertical: spacing.md,
    backgroundColor: colors.accent.primary,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  confirmButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
  },
  // Favorites view styles
  favoritesSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  favoritesSearchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
    paddingVertical: spacing.xs,
  },
  favoritesTabsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  favoritesTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  favoritesTabActive: {
    backgroundColor: colors.accent.light,
    borderColor: colors.accent.primary,
  },
  favoritesTabText: {
    ...typography.smallMedium,
    color: colors.text.tertiary,
  },
  favoritesTabTextActive: {
    color: colors.accent.primary,
  },
  favoritesList: {
    gap: spacing.sm,
  },
  favoriteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    overflow: 'hidden',
  },
  favoriteItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  favoriteItemIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.bg.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteRecipeImage: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.bg.tertiary,
  },
  favoriteItemInfo: {
    flex: 1,
  },
  favoriteItemName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  favoriteItemMeta: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  deleteFavoriteButton: {
    padding: spacing.md,
    borderLeftWidth: 1,
    borderLeftColor: colors.border.light,
    backgroundColor: `${colors.error}08`,
  },
  recipeSourceBadge: {
    marginTop: spacing.xs,
  },
  recipeSourceText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  // Recipe Modal styles
  recipeModalContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  recipeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.default,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  recipeModalTitle: {
    ...typography.h4,
    color: colors.text.primary,
  },
  recipeModalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.bg.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeModalScroll: {
    flex: 1,
  },
  // AI Card styles
  aiCard: {
    marginHorizontal: spacing.default,
    marginTop: spacing.default,
    padding: spacing.default,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: `${colors.accent.primary}30`,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  aiTitle: {
    ...typography.bodySemibold,
    color: colors.text.primary,
  },
  aiDescription: {
    ...typography.small,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  mealTypeLabel: {
    ...typography.smallMedium,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  mealTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  mealTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.full,
  },
  mealTypeChipActive: {
    backgroundColor: colors.accent.primary,
  },
  mealTypeEmoji: {
    fontSize: 14,
  },
  mealTypeText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  mealTypeTextActive: {
    color: '#FFFFFF',
  },
  // Duration chip styles
  durationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.full,
    flex: 1,
    justifyContent: 'center',
  },
  durationChipActive: {
    backgroundColor: colors.accent.primary,
  },
  durationText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  durationTextActive: {
    color: '#FFFFFF',
  },
  // Reduction toggle styles
  reductionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  reductionToggleActive: {
    backgroundColor: `${colors.success}15`,
    borderColor: colors.success,
  },
  reductionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  reductionTitle: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  reductionTitleActive: {
    color: colors.success,
  },
  reductionSubtitle: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  reductionCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reductionCheckActive: {
    backgroundColor: colors.success,
  },
  buttonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    marginLeft: spacing.sm,
  },
  ragInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.accent.primary}10`,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  ragInfoText: {
    ...typography.caption,
    color: colors.text.secondary,
    flex: 1,
  },
  ragInfoHint: {
    ...typography.small,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },
  generateButton: {
    marginHorizontal: spacing.default,
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.sm,
    elevation: 4,
  },
  generateButtonDisabled: {
    opacity: 0.7,
  },
  generateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  generateButtonText: {
    fontSize: 15,
    fontFamily: fonts.sans.semibold,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  // Mode Selector styles
  modeSelector: {
    flexDirection: 'row',
    marginHorizontal: spacing.default,
    marginTop: spacing.default,
    marginBottom: spacing.md,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    padding: spacing.xs,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  modeTabActive: {
    backgroundColor: colors.accent.primary,
  },
  modeTabText: {
    ...typography.body,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  modeTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // Suggested Recipe Card styles
  suggestedRecipeCard: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    marginTop: spacing.lg,
    marginHorizontal: spacing.default,
    padding: spacing.default,
    ...shadows.sm,
  },
  suggestedRecipeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  suggestedRecipeSourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  suggestedRecipeSourceText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  suggestedRecipeConfidence: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
  },
  suggestedRecipeImage: {
    width: '100%',
    height: 180,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  suggestedRecipeImagePlaceholder: {
    width: '100%',
    height: 180,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestedRecipeTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  suggestedRecipeDescription: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  suggestedRecipeMeta: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  suggestedRecipeMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  suggestedRecipeMetaText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  suggestedRecipeNutrition: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  nutritionPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  nutritionPillText: {
    ...typography.caption,
    fontWeight: '600',
  },
  suggestedRecipeActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  suggestedRecipeSecondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent.primary,
    gap: spacing.xs,
  },
  suggestedRecipeSecondaryButtonText: {
    ...typography.body,
    color: colors.accent.primary,
    fontWeight: '600',
  },
  suggestedRecipePrimaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accent.primary,
    gap: spacing.xs,
  },
  suggestedRecipePrimaryButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // Discover styles
  discoverSearchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginHorizontal: spacing.default,
    marginTop: spacing.default,
    marginBottom: spacing.md,
  },
  discoverSearchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
    gap: spacing.sm,
  },
  discoverSearchText: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
  },
  discoverSearchButton: {
    backgroundColor: colors.accent.primary,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    justifyContent: 'center',
  },
  discoverSearchButtonText: {
    ...typography.smallMedium,
    color: '#FFFFFF',
  },
  dietScroll: {
    maxHeight: 44,
    marginBottom: spacing.md,
  },
  dietContent: {
    paddingHorizontal: spacing.default,
    gap: spacing.sm,
  },
  dietChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  dietChipActive: {
    backgroundColor: colors.accent.primary,
    borderColor: colors.accent.primary,
  },
  dietEmoji: {
    fontSize: 14,
  },
  dietLabel: {
    ...typography.smallMedium,
    color: colors.text.secondary,
  },
  dietLabelActive: {
    color: '#FFFFFF',
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.default,
    marginBottom: spacing.md,
  },
  resultsCount: {
    ...typography.small,
    color: colors.text.secondary,
  },
  enrichingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  enrichingText: {
    ...typography.caption,
    color: colors.accent.primary,
  },
  discoverRecipesList: {
    paddingHorizontal: spacing.default,
  },
  // Discover card styles
  discoverCard: {
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  discoverCardRow: {
    flexDirection: 'row',
  },
  discoverImageContainer: {
    width: 112,
    height: 112,
    position: 'relative',
  },
  discoverImage: {
    width: '100%',
    height: '100%',
  },
  discoverImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sourceBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: radius.sm,
  },
  sourceBadgeText: {
    fontSize: 9,
    color: '#FFFFFF',
  },
  discoverContent: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'center',
  },
  discoverTitle: {
    ...typography.bodySemibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  discoverMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  discoverFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  servingsText: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  discoverInitialState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  initialIconContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: `${colors.accent.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  initialText: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
  },
  initialSubtext: {
    ...typography.small,
    color: colors.text.tertiary,
    marginTop: 4,
  },
  // Recipe detail styles
  recipeDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.default,
  },
  recipeDetailImage: {
    width: '100%',
    height: 250,
  },
  recipeDetailImagePlaceholder: {
    width: '100%',
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeDetailContent: {
    padding: spacing.default,
  },
  recipeDetailTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  recipeDetailDescription: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  recipeDetailMeta: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: spacing.md,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
  },
  recipeDetailMetaItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  recipeDetailMetaValue: {
    ...typography.smallMedium,
    color: colors.text.primary,
  },
  nutritionDetailCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  recipeDetailSectionTitle: {
    ...typography.bodySemibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  nutritionDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  nutritionDetailItem: {
    alignItems: 'center',
  },
  nutritionDetailValue: {
    ...typography.h4,
    fontWeight: '700',
  },
  nutritionDetailLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  recipeDetailSection: {
    marginBottom: spacing.lg,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  ingredientBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent.primary,
  },
  ingredientText: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
  },
  instructionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  instructionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionNumberText: {
    ...typography.smallMedium,
    color: '#FFFFFF',
  },
  instructionText: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
  },
  ratingSection: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  ratingSubtitle: {
    ...typography.small,
    color: colors.text.tertiary,
    marginBottom: spacing.md,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  starButton: {
    padding: spacing.xs,
  },
  commentInput: {
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.bg.primary,
    borderRadius: radius.lg,
    padding: spacing.md,
    minHeight: 60,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  // Add to Meal Section styles
  addToMealSection: {
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
  },
  addToMealTitle: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  mealTypeSelectorRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  mealTypeOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  mealTypeOptionActive: {
    backgroundColor: `${colors.accent.primary}15`,
    borderColor: colors.accent.primary,
  },
  mealTypeLabelActive: {
    color: colors.accent.primary,
    fontWeight: '600',
  },
})
