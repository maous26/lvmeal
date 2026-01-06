/**
 * RecipesScreen - Main recipes tab screen
 *
 * Full-featured recipe discovery with categories, search, and filters
 * Similar to the reference app design with horizontal carousels
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Image,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { LinearGradient } from 'expo-linear-gradient'
import {
  Search,
  SlidersHorizontal,
  Clock,
  Flame,
  ChefHat,
  Heart,
  Star,
  Sparkles,
  X,
  Check,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { useTheme } from '../contexts/ThemeContext'
import { colors as staticColors, spacing, typography, radius, fonts } from '../constants/theme'
import { useRecipesStore, type AIRecipeRating } from '../stores/recipes-store'
import {
  loadStaticRecipes,
  searchStaticRecipes,
  staticToRecipe,
} from '../services/static-recipes'
import { NutriScoreBadge } from '../components/ui'
import type { Recipe, MealType } from '../types'

// Category configurations - Filtres pertinents et fonctionnels
// Organic Luxury palette colors
const CATEGORIES = [
  { id: 'quick', label: 'Rapide (<20min)', emoji: '⚡', color: '#D4A574' },      // Caramel
  { id: 'highprotein', label: 'Protéiné', emoji: '💪', color: '#4A6741' },       // Vert Mousse
  { id: 'lowcarb', label: 'Low Carb', emoji: '🥩', color: '#C87863' },           // Terre Cuite
  { id: 'vegetarian', label: 'Végétarien', emoji: '🥗', color: '#7A9E7E' },      // Sauge
  { id: 'mealprep', label: 'Batch Cooking', emoji: '🍱', color: '#9B7BB8' },     // Lavande
]

const MEAL_TYPES: { id: MealType | ''; label: string }[] = [
  { id: '', label: 'Tous' },
  { id: 'breakfast', label: 'Petit-déjeuner' },
  { id: 'lunch', label: 'Déjeuner' },
  { id: 'snack', label: 'Collation' },
  { id: 'dinner', label: 'Dîner' },
]

// Advanced filter options for the modal
const CALORIE_RANGES = [
  { id: 'any', label: 'Toutes', min: 0, max: 9999 },
  { id: 'light', label: '< 300 kcal', min: 0, max: 300 },
  { id: 'moderate', label: '300-500 kcal', min: 300, max: 500 },
  { id: 'hearty', label: '> 500 kcal', min: 500, max: 9999 },
]

const PREP_TIME_RANGES = [
  { id: 'any', label: 'Tous', max: 9999 },
  { id: 'quick', label: '< 15 min', max: 15 },
  { id: 'medium', label: '15-30 min', max: 30 },
  { id: 'long', label: '> 30 min', max: 9999, min: 30 },
]

const DIFFICULTY_OPTIONS = [
  { id: 'any', label: 'Tous', emoji: '👨‍🍳' },
  { id: 'easy', label: 'Facile', emoji: '😊' },
  { id: 'medium', label: 'Moyen', emoji: '👍' },
  { id: 'hard', label: 'Difficile', emoji: '💪' },
]

const DIET_OPTIONS = [
  { id: 'highprotein', label: 'Riche en protéines', emoji: '💪', filter: (r: Recipe) => (r.nutritionPerServing?.proteins || 0) >= 25 },
  { id: 'lowcarb', label: 'Low Carb', emoji: '🥩', filter: (r: Recipe) => (r.nutritionPerServing?.carbs || 0) < 30 },
  { id: 'lowfat', label: 'Pauvre en graisses', emoji: '🥗', filter: (r: Recipe) => (r.nutritionPerServing?.fats || 0) < 15 },
  { id: 'balanced', label: 'Équilibré', emoji: '⚖️', filter: (r: Recipe) => {
    const p = r.nutritionPerServing?.proteins || 0
    const c = r.nutritionPerServing?.carbs || 0
    const f = r.nutritionPerServing?.fats || 0
    return p >= 15 && p <= 35 && c >= 30 && c <= 60 && f >= 10 && f <= 30
  }},
]

const SERVINGS_OPTIONS = [
  { id: 'any', label: 'Tous', min: 0, max: 99 },
  { id: 'solo', label: '1-2 pers.', min: 1, max: 2 },
  { id: 'couple', label: '3-4 pers.', min: 3, max: 4 },
  { id: 'family', label: '5+ pers.', min: 5, max: 99 },
]

// Seeded random shuffle for daily rotation
function seededShuffle<T>(array: T[], seed: number): T[] {
  const result = [...array]
  let m = result.length
  while (m) {
    const i = Math.floor(seededRandom(seed + m) * m--)
    ;[result[m], result[i]] = [result[i], result[m]]
  }
  return result
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000
  return x - Math.floor(x)
}

// Get daily seed (changes every day at midnight)
function getDailySeed(): number {
  const now = new Date()
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate()
}

export default function RecipesScreen() {
  const navigation = useNavigation()
  const { colors, isDark } = useTheme()
  const { getTopRatedAIRecipes } = useRecipesStore()
  const [favorites, setFavorites] = useState<string[]>([])

  // State
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMealType, setSelectedMealType] = useState<MealType | ''>('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([])

  // Advanced filters modal
  const [showFiltersModal, setShowFiltersModal] = useState(false)
  const [calorieFilter, setCalorieFilter] = useState('any')
  const [prepTimeFilter, setPrepTimeFilter] = useState('any')
  const [difficultyFilter, setDifficultyFilter] = useState('any')
  const [dietFilters, setDietFilters] = useState<string[]>([])
  const [servingsFilter, setServingsFilter] = useState('any')

  // Daily seed for rotation (changes each day)
  const [dailySeed] = useState(() => getDailySeed())

  // Load recipes on mount
  useEffect(() => {
    loadRecipes()
  }, [])

  const loadRecipes = async () => {
    setIsLoading(true)
    try {
      const staticRecipes = await loadStaticRecipes()
      if (staticRecipes.length > 0) {
        const recipes = staticRecipes.map(staticToRecipe)
        setAllRecipes(recipes)
      }
    } catch (error) {
      console.warn('Failed to load recipes:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadRecipes()
    setRefreshing(false)
  }, [])

  // Filter recipes by meal type (based on calories)
  const filterByMealType = (recipes: Recipe[], mealType: MealType | ''): Recipe[] => {
    if (!mealType) return recipes
    return recipes.filter(recipe => {
      const cals = recipe.nutritionPerServing?.calories || 0
      switch (mealType) {
        case 'breakfast': return cals >= 150 && cals <= 500
        case 'lunch': return cals >= 400 && cals <= 800
        case 'snack': return cals >= 50 && cals <= 300
        case 'dinner': return cals >= 350 && cals <= 700
        default: return true
      }
    })
  }

  // Filter recipes by category
  const filterByCategory = useCallback((recipes: Recipe[], category: string | null): Recipe[] => {
    if (!category) return recipes
    return recipes.filter(recipe => {
      const title = recipe.title.toLowerCase()
      const tags = recipe.tags?.map(t => t.toLowerCase()) || []
      const dietTypes = recipe.dietTypes?.map(d => d.toLowerCase()) || []
      const prepTime = recipe.prepTime || 0
      const carbs = recipe.nutritionPerServing?.carbs || 0
      const proteins = recipe.nutritionPerServing?.proteins || 0

      switch (category) {
        case 'quick':
          // Recettes rapides: moins de 20 minutes de préparation
          return prepTime <= 20
        case 'vegetarian':
          // Végétarien: tags ou dietTypes contiennent végétarien/vegan
          return dietTypes.some(d => d.includes('vegetar') || d.includes('vegan')) ||
                 tags.some(t => t.includes('végé') || t.includes('vegan') || t.includes('legume'))
        case 'keto':
          // Cétogène: faible en glucides (<20g) et riche en lipides
          return carbs < 20
        case 'lowcarb':
          // Low Carb: moins de 30g de glucides
          return carbs < 30
        case 'mealprep':
          // Préparation repas: recettes qui se conservent bien (>4 portions ou tags meal prep)
          return (recipe.servings && recipe.servings >= 4) ||
                 tags.some(t => t.includes('prep') || t.includes('batch'))
        case 'highprotein':
          // Riche en protéines: plus de 25g
          return proteins >= 25
        default:
          return true
      }
    })
  }, [])

  // Helper to deduplicate recipes by ID
  const deduplicateRecipes = (recipes: Recipe[]): Recipe[] => {
    const seen = new Set<string>()
    return recipes.filter(r => {
      if (seen.has(r.id)) return false
      seen.add(r.id)
      return true
    })
  }

  // Apply advanced filters (calories, prep time, difficulty, diet, servings)
  const applyAdvancedFilters = useCallback((recipes: Recipe[]): Recipe[] => {
    let result = recipes

    // Calorie filter
    if (calorieFilter !== 'any') {
      const range = CALORIE_RANGES.find(r => r.id === calorieFilter)
      if (range) {
        result = result.filter(r => {
          const cals = r.nutritionPerServing?.calories || 0
          return cals >= range.min && cals <= range.max
        })
      }
    }

    // Prep time filter
    if (prepTimeFilter !== 'any') {
      const range = PREP_TIME_RANGES.find(r => r.id === prepTimeFilter)
      if (range) {
        result = result.filter(r => {
          const time = r.prepTime || 0
          if (range.min !== undefined) {
            return time >= range.min
          }
          return time <= range.max
        })
      }
    }

    // Difficulty filter
    if (difficultyFilter !== 'any') {
      result = result.filter(r => r.difficulty === difficultyFilter)
    }

    // Diet filters (multiple selection - recipe must match ALL selected)
    if (dietFilters.length > 0) {
      result = result.filter(recipe => {
        return dietFilters.every(filterId => {
          const dietOption = DIET_OPTIONS.find(d => d.id === filterId)
          return dietOption ? dietOption.filter(recipe) : true
        })
      })
    }

    // Servings filter
    if (servingsFilter !== 'any') {
      const range = SERVINGS_OPTIONS.find(r => r.id === servingsFilter)
      if (range) {
        result = result.filter(r => {
          const servings = r.servings || 2
          return servings >= range.min && servings <= range.max
        })
      }
    }

    return result
  }, [calorieFilter, prepTimeFilter, difficultyFilter, dietFilters, servingsFilter])

  // Check if any advanced filter is active
  const hasAdvancedFilters = calorieFilter !== 'any' || prepTimeFilter !== 'any' ||
    difficultyFilter !== 'any' || dietFilters.length > 0 || servingsFilter !== 'any'

  // Count active filters for badge
  const activeFilterCount =
    (calorieFilter !== 'any' ? 1 : 0) +
    (prepTimeFilter !== 'any' ? 1 : 0) +
    (difficultyFilter !== 'any' ? 1 : 0) +
    dietFilters.length +
    (servingsFilter !== 'any' ? 1 : 0)

  // Filtered recipes based on selected category + advanced filters
  const filteredRecipes = useMemo(() => {
    let recipes = filterByCategory(allRecipes, selectedCategory)
    recipes = applyAdvancedFilters(recipes)
    return recipes
  }, [allRecipes, selectedCategory, filterByCategory, applyAdvancedFilters])

  // Group recipes by categories (with deduplication and daily rotation)
  const breakfastRecipes = useMemo(() => {
    const filtered = filteredRecipes.filter(r => {
      const cals = r.nutritionPerServing?.calories || 0
      return cals >= 150 && cals <= 500
    })
    const unique = deduplicateRecipes(filtered)
    // Rotate based on daily seed (different offset for each section)
    const shuffled = seededShuffle(unique, dailySeed + 1)
    return shuffled.slice(0, 10)
  }, [filteredRecipes, dailySeed])

  const lunchRecipes = useMemo(() => {
    const filtered = filteredRecipes.filter(r => {
      const cals = r.nutritionPerServing?.calories || 0
      return cals >= 400 && cals <= 800
    })
    const unique = deduplicateRecipes(filtered)
    const shuffled = seededShuffle(unique, dailySeed + 2)
    return shuffled.slice(0, 10)
  }, [filteredRecipes, dailySeed])

  const snackRecipes = useMemo(() => {
    const filtered = filteredRecipes.filter(r => {
      const cals = r.nutritionPerServing?.calories || 0
      return cals >= 50 && cals <= 300
    })
    const unique = deduplicateRecipes(filtered)
    const shuffled = seededShuffle(unique, dailySeed + 3)
    return shuffled.slice(0, 10)
  }, [filteredRecipes, dailySeed])

  const dinnerRecipes = useMemo(() => {
    const filtered = filteredRecipes.filter(r => {
      const cals = r.nutritionPerServing?.calories || 0
      return cals >= 350 && cals <= 700
    })
    const unique = deduplicateRecipes(filtered)
    const shuffled = seededShuffle(unique, dailySeed + 4)
    return shuffled.slice(0, 10)
  }, [filteredRecipes, dailySeed])

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const results = searchStaticRecipes(searchQuery)
    return results.slice(0, 20).map(staticToRecipe)
  }, [searchQuery])

  // Top AI recipes
  const topAIRecipes = useMemo(() => {
    return getTopRatedAIRecipes(undefined, 10)
  }, [getTopRatedAIRecipes])

  // Navigate to recipe detail
  const handleRecipePress = (recipe: Recipe) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // @ts-ignore - Navigation typing
    navigation.navigate('RecipeDetail', {
      suggestion: {
        id: recipe.id,
        name: recipe.title,
        calories: recipe.nutritionPerServing?.calories || 0,
        proteins: recipe.nutritionPerServing?.proteins || 0,
        carbs: recipe.nutritionPerServing?.carbs || 0,
        fats: recipe.nutritionPerServing?.fats || 0,
        prepTime: recipe.prepTime,
        mealType: 'lunch',
        imageUrl: recipe.imageUrl,
        isAI: false,
        isGustar: true,
        source: recipe.source,
      },
      mealType: 'lunch',
    })
  }

  const handleFavoritePress = (recipeId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setFavorites(prev =>
      prev.includes(recipeId)
        ? prev.filter(id => id !== recipeId)
        : [...prev, recipeId]
    )
  }

  // Render recipe card for horizontal carousel
  const renderRecipeCard = (recipe: Recipe, size: 'large' | 'medium' = 'large') => {
    const isFavorite = favorites.includes(recipe.id)
    const cardWidth = size === 'large' ? 220 : 160
    const cardHeight = size === 'large' ? 140 : 110

    return (
      <TouchableOpacity
        key={recipe.id}
        style={[styles.recipeCard, { width: cardWidth, backgroundColor: colors.bg.elevated }]}
        onPress={() => handleRecipePress(recipe)}
        activeOpacity={0.8}
      >
        {/* Image */}
        <View style={[styles.recipeImageContainer, { height: cardHeight }]}>
          {recipe.imageUrl ? (
            <Image
              source={{ uri: recipe.imageUrl }}
              style={styles.recipeImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.recipeImagePlaceholder, { backgroundColor: colors.bg.tertiary }]}>
              <ChefHat size={32} color={colors.text.muted} />
            </View>
          )}

          {/* Nutri-Score badge */}
          {recipe.nutriscore && recipe.nutriscore !== 'unknown' && (
            <View style={styles.nutriscoreContainer}>
              <NutriScoreBadge grade={recipe.nutriscore} size="sm" />
            </View>
          )}

          {/* Favorite button */}
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={() => handleFavoritePress(recipe.id)}
          >
            <Heart
              size={20}
              color={isFavorite ? colors.error : '#FFFFFF'}
              fill={isFavorite ? colors.error : 'transparent'}
            />
          </TouchableOpacity>

          {/* Gradient overlay for text */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.recipeGradient}
          >
            <Text style={styles.recipeTitle} numberOfLines={2}>
              {recipe.title}
            </Text>
            <View style={styles.recipeMeta}>
              <Text style={styles.recipeCalories}>
                {recipe.nutritionPerServing?.calories || 0} kcal
              </Text>
            </View>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    )
  }

  // Handle category selection
  const handleCategoryPress = (categoryId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // Toggle: if already selected, deselect; otherwise select
    setSelectedCategory(prev => prev === categoryId ? null : categoryId)
  }

  // Render category card
  const renderCategoryCard = (category: typeof CATEGORIES[0]) => {
    const isSelected = selectedCategory === category.id
    return (
      <TouchableOpacity
        key={category.id}
        style={[
          styles.categoryCard,
          isSelected && { borderWidth: 2, borderColor: category.color }
        ]}
        onPress={() => handleCategoryPress(category.id)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={isSelected
            ? [category.color + '60', category.color + '40']
            : [category.color + '40', category.color + '20']}
          style={styles.categoryGradient}
        >
          <Text style={styles.categoryEmoji}>{category.emoji}</Text>
          <Text style={[styles.categoryLabel, { color: colors.text.primary }, isSelected && { fontWeight: '700' }]}>
            {category.label}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    )
  }

  // Render section header
  const renderSectionHeader = (title: string, onViewAll?: () => void) => (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.text.tertiary }]}>{title}</Text>
      {onViewAll && (
        <TouchableOpacity onPress={onViewAll}>
          <Text style={[styles.viewAllText, { color: colors.accent.primary }]}>Voir tout</Text>
        </TouchableOpacity>
      )}
    </View>
  )

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.bg.elevated, borderColor: colors.border.light }]}>
          <Search size={20} color={colors.text.muted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text.primary }]}
            placeholder="Rechercher"
            placeholderTextColor={colors.text.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity
          style={[
            styles.filterButton,
            { backgroundColor: colors.bg.elevated, borderColor: colors.border.light },
            hasAdvancedFilters && { backgroundColor: colors.accent.primary + '20', borderColor: colors.accent.primary }
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setShowFiltersModal(true)
          }}
        >
          <SlidersHorizontal size={20} color={hasAdvancedFilters ? colors.accent.primary : colors.text.muted} />
          {hasAdvancedFilters && (
            <View style={[styles.filterBadge, { backgroundColor: colors.accent.primary }]}>
              <Text style={styles.filterBadgeText}>
                {activeFilterCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent.primary} />
          <Text style={[styles.loadingText, { color: colors.text.muted }]}>Chargement des recettes...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent.primary}
            />
          }
        >
          {/* Search Results */}
          {searchQuery.trim() && (
            <View style={styles.section}>
              {renderSectionHeader(`Résultats pour "${searchQuery}"`)}
              {searchResults.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalScroll}
                >
                  {searchResults.map(recipe => renderRecipeCard(recipe))}
                </ScrollView>
              ) : (
                <Text style={[styles.noResultsText, { color: colors.text.muted }]}>Aucun résultat trouvé</Text>
              )}
            </View>
          )}

          {/* Categories */}
          {!searchQuery.trim() && (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoriesScroll}
              >
                {CATEGORIES.map(renderCategoryCard)}
              </ScrollView>

              {/* Active filter indicator */}
              {selectedCategory && (
                <View style={[styles.activeFilterContainer, { backgroundColor: colors.accent.primary + '15', borderColor: colors.accent.primary + '30' }]}>
                  <Text style={[styles.activeFilterText, { color: colors.accent.primary }]}>
                    Filtre actif : {CATEGORIES.find(c => c.id === selectedCategory)?.label}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setSelectedCategory(null)}
                    style={styles.clearFilterButton}
                  >
                    <Text style={[styles.clearFilterText, { color: colors.accent.primary }]}>Effacer</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Petit-déjeuner */}
              <View style={styles.section}>
                {renderSectionHeader('PETIT-DÉJEUNER')}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalScroll}
                >
                  {breakfastRecipes.map(recipe => renderRecipeCard(recipe))}
                </ScrollView>
              </View>

              {/* Déjeuner */}
              <View style={styles.section}>
                {renderSectionHeader('DÉJEUNER')}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalScroll}
                >
                  {lunchRecipes.map(recipe => renderRecipeCard(recipe))}
                </ScrollView>
              </View>

              {/* Collation */}
              <View style={styles.section}>
                {renderSectionHeader('COLLATION')}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalScroll}
                >
                  {snackRecipes.map(recipe => renderRecipeCard(recipe, 'medium'))}
                </ScrollView>
              </View>

              {/* Dîner */}
              <View style={styles.section}>
                {renderSectionHeader('DÎNER')}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalScroll}
                >
                  {dinnerRecipes.map(recipe => renderRecipeCard(recipe))}
                </ScrollView>
              </View>

              {/* AI Recipes */}
              {topAIRecipes.length > 0 && (
                <View style={styles.section}>
                  {renderSectionHeader('MES RECETTES IA')}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.horizontalScroll}
                  >
                    {topAIRecipes.map(aiRecipe => renderRecipeCard(aiRecipe.recipe, 'medium'))}
                  </ScrollView>
                </View>
              )}
            </>
          )}

          <View style={{ height: spacing['3xl'] }} />
        </ScrollView>
      )}

      {/* Advanced Filters Modal */}
      <Modal
        visible={showFiltersModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFiltersModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.bg.primary }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text.primary }]}>Filtres avancés</Text>
              <TouchableOpacity
                onPress={() => setShowFiltersModal(false)}
                style={[styles.modalCloseButton, { backgroundColor: colors.bg.secondary }]}
              >
                <X size={20} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScrollView}
              showsVerticalScrollIndicator={false}
            >
              {/* Calorie Filter */}
              <View style={styles.filterSection}>
                <Text style={[styles.filterSectionTitle, { color: colors.text.secondary }]}>CALORIES</Text>
                <View style={styles.filterOptions}>
                  {CALORIE_RANGES.map(range => (
                    <TouchableOpacity
                      key={range.id}
                      style={[
                        styles.filterOption,
                        { backgroundColor: colors.bg.secondary, borderColor: colors.border.light },
                        calorieFilter === range.id && { backgroundColor: colors.accent.primary + '20', borderColor: colors.accent.primary }
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        setCalorieFilter(range.id)
                      }}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        { color: colors.text.primary },
                        calorieFilter === range.id && { color: colors.accent.primary, fontWeight: '600' }
                      ]}>
                        {range.label}
                      </Text>
                      {calorieFilter === range.id && (
                        <Check size={16} color={colors.accent.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Prep Time Filter */}
              <View style={styles.filterSection}>
                <Text style={[styles.filterSectionTitle, { color: colors.text.secondary }]}>TEMPS DE PRÉPARATION</Text>
                <View style={styles.filterOptions}>
                  {PREP_TIME_RANGES.map(range => (
                    <TouchableOpacity
                      key={range.id}
                      style={[
                        styles.filterOption,
                        { backgroundColor: colors.bg.secondary, borderColor: colors.border.light },
                        prepTimeFilter === range.id && { backgroundColor: colors.accent.primary + '20', borderColor: colors.accent.primary }
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        setPrepTimeFilter(range.id)
                      }}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        { color: colors.text.primary },
                        prepTimeFilter === range.id && { color: colors.accent.primary, fontWeight: '600' }
                      ]}>
                        {range.label}
                      </Text>
                      {prepTimeFilter === range.id && (
                        <Check size={16} color={colors.accent.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Difficulty Filter */}
              <View style={styles.filterSection}>
                <Text style={[styles.filterSectionTitle, { color: colors.text.secondary }]}>DIFFICULTÉ</Text>
                <View style={styles.filterOptions}>
                  {DIFFICULTY_OPTIONS.map(option => (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.filterOption,
                        { backgroundColor: colors.bg.secondary, borderColor: colors.border.light },
                        difficultyFilter === option.id && { backgroundColor: colors.accent.primary + '20', borderColor: colors.accent.primary }
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        setDifficultyFilter(option.id)
                      }}
                    >
                      <Text style={styles.filterOptionEmoji}>{option.emoji}</Text>
                      <Text style={[
                        styles.filterOptionText,
                        { color: colors.text.primary },
                        difficultyFilter === option.id && { color: colors.accent.primary, fontWeight: '600' }
                      ]}>
                        {option.label}
                      </Text>
                      {difficultyFilter === option.id && (
                        <Check size={16} color={colors.accent.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Diet/Nutrition Filter (Multi-select) */}
              <View style={styles.filterSection}>
                <Text style={[styles.filterSectionTitle, { color: colors.text.secondary }]}>PROFIL NUTRITIONNEL</Text>
                <Text style={[styles.filterSectionHint, { color: colors.text.muted }]}>Sélection multiple possible</Text>
                <View style={styles.filterOptions}>
                  {DIET_OPTIONS.map(option => {
                    const isSelected = dietFilters.includes(option.id)
                    return (
                      <TouchableOpacity
                        key={option.id}
                        style={[
                          styles.filterOption,
                          { backgroundColor: colors.bg.secondary, borderColor: colors.border.light },
                          isSelected && { backgroundColor: colors.accent.primary + '20', borderColor: colors.accent.primary }
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                          setDietFilters(prev =>
                            isSelected
                              ? prev.filter(id => id !== option.id)
                              : [...prev, option.id]
                          )
                        }}
                      >
                        <Text style={styles.filterOptionEmoji}>{option.emoji}</Text>
                        <Text style={[
                          styles.filterOptionText,
                          { color: colors.text.primary },
                          isSelected && { color: colors.accent.primary, fontWeight: '600' }
                        ]}>
                          {option.label}
                        </Text>
                        {isSelected && (
                          <Check size={16} color={colors.accent.primary} />
                        )}
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>

              {/* Servings Filter */}
              <View style={styles.filterSection}>
                <Text style={[styles.filterSectionTitle, { color: colors.text.secondary }]}>NOMBRE DE PORTIONS</Text>
                <View style={styles.filterOptions}>
                  {SERVINGS_OPTIONS.map(option => (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.filterOption,
                        { backgroundColor: colors.bg.secondary, borderColor: colors.border.light },
                        servingsFilter === option.id && { backgroundColor: colors.accent.primary + '20', borderColor: colors.accent.primary }
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        setServingsFilter(option.id)
                      }}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        { color: colors.text.primary },
                        servingsFilter === option.id && { color: colors.accent.primary, fontWeight: '600' }
                      ]}>
                        {option.label}
                      </Text>
                      {servingsFilter === option.id && (
                        <Check size={16} color={colors.accent.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={{ height: spacing.xl }} />
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.resetButton, { borderColor: colors.border.medium }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setCalorieFilter('any')
                  setPrepTimeFilter('any')
                  setDifficultyFilter('any')
                  setDietFilters([])
                  setServingsFilter('any')
                }}
              >
                <Text style={[styles.resetButtonText, { color: colors.text.secondary }]}>Réinitialiser</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.applyButton, { backgroundColor: colors.accent.primary }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                  setShowFiltersModal(false)
                }}
              >
                <Text style={styles.applyButtonText}>Appliquer ({activeFilterCount})</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F7F4', // Blanc cassé
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.default,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: '#1A1A1A',
  },
  filterButton: {
    width: 44,
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
  },
  // Categories
  categoriesScroll: {
    paddingHorizontal: spacing.default,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  categoryCard: {
    width: 140,
    height: 80,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginRight: spacing.sm,
  },
  categoryGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
  },
  categoryEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  categoryLabel: {
    ...typography.smallMedium,
    color: '#1A1A1A',
  },
  // Sections
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.default,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.caption,
    color: '#6B7280',
    fontWeight: '600',
    letterSpacing: 1,
    fontFamily: fonts.serif.bold,
  },
  viewAllText: {
    ...typography.small,
  },
  horizontalScroll: {
    paddingHorizontal: spacing.default,
    gap: spacing.md,
  },
  // Recipe Card
  recipeCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginRight: spacing.md,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  recipeImageContainer: {
    position: 'relative',
  },
  recipeImage: {
    width: '100%',
    height: '100%',
  },
  recipeImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E5E5E5',
  },
  nutriscoreContainer: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 6,
    padding: 2,
  },
  favoriteButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    paddingTop: spacing.xl,
  },
  recipeTitle: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    marginBottom: 4,
    fontFamily: fonts.serif.semibold,
  },
  recipeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recipeCalories: {
    ...typography.small,
    color: '#9CA3AF',
  },
  noResultsText: {
    ...typography.body,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  // Active filter indicator
  activeFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.default,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  activeFilterText: {
    ...typography.small,
    fontWeight: '500',
  },
  clearFilterButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  clearFilterText: {
    ...typography.small,
    fontWeight: '600',
  },
  // Filter button badge
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.default,
    paddingTop: spacing.lg,
    paddingBottom: spacing['3xl'],
    maxHeight: '85%',
  },
  modalScrollView: {
    flexGrow: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  modalTitle: {
    ...typography.h3,
    fontWeight: '600',
    fontFamily: fonts.serif.bold,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterSection: {
    marginBottom: spacing.xl,
  },
  filterSectionTitle: {
    ...typography.caption,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  filterSectionHint: {
    ...typography.small,
    marginBottom: spacing.sm,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  filterOptionText: {
    ...typography.body,
  },
  filterOptionEmoji: {
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  resetButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  resetButtonText: {
    ...typography.bodyMedium,
  },
  applyButton: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  applyButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '600',
  },
})
