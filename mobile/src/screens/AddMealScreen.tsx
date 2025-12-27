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
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { Card, Button, Badge } from '../components/ui'
import { colors, spacing, typography, radius, shadows } from '../constants/theme'
import { useMealsStore } from '../stores/meals-store'
import { useGamificationStore } from '../stores/gamification-store'
import { useRecipesStore } from '../stores/recipes-store'
import { useUserStore } from '../stores/user-store'
import type { MealType, FoodItem, MealItem, NutritionInfo, Recipe, UserProfile } from '../types'
import { generateId } from '../lib/utils'
import { searchFoods, preloadCiqual, type SearchSource } from '../services/food-search'
import { gustarRecipes, type GustarRecipe, type DietaryPreference } from '../services/gustar-recipes'
import { translateRecipe, suggestMeal, type AIRecipe } from '../services/ai-service'
import BarcodeScanner from '../components/BarcodeScanner'
import PhotoFoodScanner from '../components/PhotoFoodScanner'
import VoiceFoodInput from '../components/VoiceFoodInput'
import RecipeDiscovery from '../components/RecipeDiscovery'

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

// Input methods with large icons like web
const inputMethods = [
  { id: 'search', label: 'Rechercher', icon: Search, color: colors.accent.primary, bgColor: '#EBF5FF' },
  { id: 'photo', label: 'Photo', icon: Camera, color: '#E11D48', bgColor: '#FFF1F2' },
  { id: 'voice', label: 'Vocal', icon: Mic, color: '#8B5CF6', bgColor: '#F3E8FF' },
  { id: 'barcode', label: 'Code-barres', icon: Barcode, color: colors.success, bgColor: '#ECFDF5' },
  { id: 'ai-recipe', label: 'Recette IA', icon: Sparkles, color: '#F59E0B', bgColor: '#FFFBEB' },
  { id: 'discover-recipes', label: 'Decouvrir', icon: Globe, color: '#06B6D4', bgColor: '#ECFEFF' },
  { id: 'favorites', label: 'Mes favoris', icon: Heart, color: '#EC4899', bgColor: '#FDF2F8' },
]

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
  const { type = 'lunch', openDiscover = false } = (route.params as { type?: MealType; openDiscover?: boolean }) || {}

  const { addMeal, recentFoods = [], favoriteFoods = [], addToFavorites, removeFromFavorites, getDailyNutrition, currentDate } = useMealsStore()
  const { addXP } = useGamificationStore()
  const { favoriteRecipes, removeFromFavorites: removeRecipeFromFavorites, addToFavorites: addRecipeToFavorites, addAIRecipe, rateAIRecipe, aiRecipes } = useRecipesStore()
  const { profile, nutritionGoals } = useUserStore()

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

  // AI Recipe Modal state
  const [showAIRecipeModal, setShowAIRecipeModal] = useState(false)
  const [selectedMealType, setSelectedMealType] = useState<MealType>(type as MealType)
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [suggestedRecipe, setSuggestedRecipe] = useState<AIRecipe | null>(null)

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

  // Quantity modal state
  const [quantityModal, setQuantityModal] = useState<QuantityModalState>({
    isOpen: false,
    food: null,
    quantity: 100,
    unit: 'g',
  })

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
      } catch (error) {
        console.error('Search error:', error)
        setSearchResults([])
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
      let gramsEquivalent = quantity
      if (unit === 'unit' || unit === 'portion') {
        gramsEquivalent = quantity * (food.servingSize || 100)
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
    const defaultUnit: ServingUnit = 'g'
    setQuantityModal({
      isOpen: true,
      food,
      quantity: getDefaultQuantity(defaultUnit),
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

  // Change unit
  const changeUnit = (newUnit: ServingUnit) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setQuantityModal(prev => ({
      ...prev,
      unit: newUnit,
      quantity: getDefaultQuantity(newUnit),
    }))
  }

  // Adjust quantity
  const adjustQuantity = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const step = getQuantityStep(quantityModal.unit)
    const newQty = Math.max(step, quantityModal.quantity + delta * step)
    setQuantityModal(prev => ({ ...prev, quantity: newQty }))
  }

  // Set quantity directly
  const setQuantityValue = (qty: number) => {
    setQuantityModal(prev => ({ ...prev, quantity: Math.max(1, qty) }))
  }

  // Calculate nutrition for modal
  const calculateModalNutrition = () => {
    if (!quantityModal.food) return { calories: 0, proteins: 0, carbs: 0, fats: 0 }

    const { food, quantity, unit } = quantityModal
    let gramsEquivalent = quantity
    if (unit === 'unit' || unit === 'portion') {
      gramsEquivalent = quantity * (food.servingSize || 100)
    }
    const multiplier = gramsEquivalent / 100

    return {
      calories: Math.round(food.nutrition.calories * multiplier),
      proteins: Math.round(food.nutrition.proteins * multiplier * 10) / 10,
      carbs: Math.round(food.nutrition.carbs * multiplier * 10) / 10,
      fats: Math.round(food.nutrition.fats * multiplier * 10) / 10,
    }
  }

  // Confirm add food from modal
  const confirmAddFood = () => {
    if (!quantityModal.food) return

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    const { food, quantity, unit } = quantityModal

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
      Alert.alert('Aucun aliment', 'Veuillez ajouter au moins un aliment')
      return
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    // Convert to MealItems
    const mealItems: MealItem[] = selectedFoods.map(({ food, quantity, unit }) => {
      let gramsEquivalent = quantity
      if (unit === 'unit' || unit === 'portion') {
        gramsEquivalent = quantity * (food.servingSize || 100)
      }
      const multiplier = gramsEquivalent / food.servingSize

      return {
        id: generateId(),
        food,
        quantity: multiplier,
      }
    })

    addMeal(selectedMealType, mealItems)
    addXP(15, 'Repas enregistre')
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
      case 'ai-recipe':
        setShowAIRecipeModal(true)
        break
      case 'discover-recipes':
        setShowDiscoverModal(true)
        break
      case 'favorites':
        setActiveMethod('favorites')
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

  // AI Recipe suggestion handler
  const handleAISuggest = async () => {
    if (!profile || !nutritionGoals) {
      Alert.alert('Profil requis', 'Configurez votre profil pour utiliser LymIA.')
      return
    }

    setIsSuggesting(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      const consumed = getDailyNutrition(currentDate)

      const result = await suggestMeal({
        mealType: selectedMealType,
        userProfile: profile as UserProfile,
        consumed: {
          calories: consumed.calories,
          proteins: consumed.proteins,
          carbs: consumed.carbs,
          fats: consumed.fats,
        },
      })

      if (result.success && result.recipe) {
        setSuggestedRecipe(result.recipe)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

        // Create Recipe object and show detail modal
        const aiRecipe: Recipe = {
          id: `ai-${Date.now()}`,
          title: result.recipe.title,
          description: result.recipe.description,
          imageUrl: result.recipe.imageUrl || undefined,
          servings: result.recipe.servings,
          prepTime: result.recipe.prepTime,
          cookTime: 0,
          totalTime: result.recipe.prepTime,
          difficulty: 'medium',
          category: selectedMealType,
          ingredients: result.recipe.ingredients.map((ing, i) => ({
            id: `ai-ing-${i}`,
            name: ing.name,
            amount: parseFloat(ing.amount) || 0,
            unit: 'g',
          })),
          instructions: result.recipe.instructions,
          nutrition: result.recipe.nutrition,
          nutritionPerServing: result.recipe.nutrition,
          tags: ['LymIA'],
          dietTypes: [],
          allergens: [],
          rating: 5,
          ratingCount: 1,
          isFavorite: false,
          source: 'ai',
        }
        setSelectedRecipe(aiRecipe)
        setShowRecipeDetailModal(true)
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de generer une suggestion. Verifiez votre cle API.')
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

    setShowRecipeDetailModal(true)
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

    Alert.alert('Merci!', 'Votre note a ete enregistree. Cette recette apparaitra dans vos suggestions.')
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

            {/* Input methods grid - Large icons like web */}
            <Text style={styles.sectionTitle}>Comment ajouter ?</Text>
            <View style={styles.methodsGrid}>
              {inputMethods.map((method) => {
                const Icon = method.icon
                return (
                  <TouchableOpacity
                    key={method.id}
                    style={styles.methodButton}
                    onPress={() => handleMethodSelect(method.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.methodIconContainer, { backgroundColor: method.bgColor }]}>
                      <Icon size={24} color={method.color} />
                    </View>
                    <Text style={styles.methodLabel}>{method.label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

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
                ]}>CIQUAL</Text>
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
                ]}>Marques</Text>
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
                          {source === 'ciqual' ? 'CIQUAL' : 'OFF'}
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
                    {favoriteFoods.map((food: FoodItem) => (
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
                              `Retirer "${food.name}" de vos favoris ?`,
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
                      Ajoutez des aliments a vos favoris lors de la recherche
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
                    {favoriteRecipes.map((recipe) => (
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
                              `Retirer "${recipe.title}" de vos favoris ?`,
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
          <View style={styles.modalOverlay}>
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
                        Valeurs nutritionnelles pour 100g
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
                          value={String(quantityModal.quantity)}
                          onChangeText={(text) => setQuantityValue(parseFloat(text) || 0)}
                          keyboardType="numeric"
                          selectTextOnFocus
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
          </View>
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
              <Text style={styles.recipeModalTitle}>Suggestion intelligente</Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.recipeModalScroll} showsVerticalScrollIndicator={false}>
              {/* AI Suggestion Card */}
              <LinearGradient
                colors={[`${colors.accent.primary}15`, `${colors.secondary.primary}15`]}
                style={styles.aiCard}
              >
                <View style={styles.aiHeader}>
                  <Wand2 size={20} color={colors.accent.primary} />
                  <Text style={styles.aiTitle}>Recette IA personnalisee</Text>
                </View>
                <Text style={styles.aiDescription}>
                  LymIA vous suggere une recette adaptee a votre profil nutritionnel et votre solde calorique restant.
                </Text>

                {/* Meal Type Selector */}
                <Text style={styles.mealTypeLabel}>Pour quel repas ?</Text>
                <View style={styles.mealTypeRow}>
                  {mealTypeOptions.map((option) => (
                    <TouchableOpacity
                      key={option.id}
                      style={[styles.mealTypeChip, selectedMealType === option.id && styles.mealTypeChipActive]}
                      onPress={() => setSelectedMealType(option.id)}
                    >
                      <Text style={styles.mealTypeEmoji}>{option.icon}</Text>
                      <Text style={[styles.mealTypeText, selectedMealType === option.id && styles.mealTypeTextActive]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Button variant="primary" size="lg" fullWidth onPress={handleAISuggest} disabled={isSuggesting}>
                  {isSuggesting ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.buttonText}>Generation en cours...</Text>
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} color="#FFFFFF" />
                      <Text style={styles.buttonText}>Generer une recette</Text>
                    </>
                  )}
                </Button>
              </LinearGradient>

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
                      Les recettes les mieux notees apparaitront dans vos suggestions
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
                            color="#F59E0B"
                            fill={star <= userRating ? '#F59E0B' : 'transparent'}
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

                  {/* Add to favorites button */}
                  <Button
                    variant={isRecipeFavorite(selectedRecipe.id) ? 'outline' : 'primary'}
                    size="lg"
                    fullWidth
                    onPress={() => handleToggleRecipeFavorite(selectedRecipe)}
                    style={{ marginTop: spacing.lg }}
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
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  mealTypeSelectorChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  mealTypeSelectorChipActive: {
    backgroundColor: `${colors.accent.primary}15`,
    borderColor: colors.accent.primary,
  },
  mealTypeSelectorEmoji: {
    fontSize: 16,
  },
  mealTypeSelectorText: {
    ...typography.smallMedium,
    color: colors.text.secondary,
  },
  mealTypeSelectorTextActive: {
    color: colors.accent.primary,
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
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.light,
    ...shadows.sm,
  },
  methodIconContainer: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
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
    borderRadius: radius.lg,
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
    borderRadius: radius.md,
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
    ...typography.smallMedium,
    color: colors.text.tertiary,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  foodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
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
    borderRadius: radius.md,
    marginRight: spacing.md,
    backgroundColor: colors.bg.tertiary,
  },
  foodImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
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
  buttonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    marginLeft: spacing.sm,
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
})
