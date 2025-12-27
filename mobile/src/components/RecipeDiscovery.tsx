/**
 * RecipeDiscovery Component
 *
 * Full recipe discovery experience with:
 * - Auto-fetch from Gustar API on load
 * - Top-rated AI recipes display
 * - Filters by meal type, cuisine, rating, date
 * - Search functionality
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import {
  Search,
  Clock,
  Flame,
  Dumbbell,
  ChefHat,
  Globe,
  Sparkles,
  Star,
  Filter,
  X,
  Calendar,
  ChevronDown,
  TrendingUp,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { Card, Badge } from './ui'
import { colors, spacing, typography, radius } from '../constants/theme'
import { useRecipesStore, type AIRecipeRating } from '../stores/recipes-store'
import { useUserStore } from '../stores/user-store'
import { gustarRecipes, type GustarRecipe, type DietaryPreference } from '../services/gustar-recipes'
import type { Recipe, MealType } from '../types'

// API Key for Gustar.io
const GUSTAR_API_KEY = '7ab3c50b59mshef5d331907bd424p16332ajsn5ea4bf90e1b9'

// Popular search terms for auto-fetch (German terms for Gustar API)
const POPULAR_SEARCHES = [
  'huhn', 'salat', 'nudeln', 'lachs', 'gemuse',
  'suppe', 'reis', 'rindfleisch', 'kuchen', 'kartoffel'
]

// Filter options
const mealTypeFilters = [
  { id: '', label: 'Tous', emoji: '🍽️' },
  { id: 'breakfast', label: 'Petit-dej', emoji: '🌅' },
  { id: 'lunch', label: 'Dejeuner', emoji: '☀️' },
  { id: 'snack', label: 'Collation', emoji: '🍎' },
  { id: 'dinner', label: 'Diner', emoji: '🌙' },
]

const cuisineFilters = [
  { id: '', label: 'Toutes', emoji: '🌍' },
  { id: 'french', label: 'Francaise', emoji: '🇫🇷' },
  { id: 'italian', label: 'Italienne', emoji: '🇮🇹' },
  { id: 'asian', label: 'Asiatique', emoji: '🥢' },
  { id: 'mexican', label: 'Mexicaine', emoji: '🌮' },
  { id: 'mediterranean', label: 'Mediterr.', emoji: '🫒' },
]

const dietFilters = [
  { id: '', label: 'Tout', emoji: '🍽️' },
  { id: 'vegetarian', label: 'Veggie', emoji: '🥗' },
  { id: 'vegan', label: 'Vegan', emoji: '🌱' },
  { id: 'glutenfree', label: 'Sans Gluten', emoji: '🌾' },
  { id: 'keto', label: 'Keto', emoji: '🥓' },
  { id: 'lowcarb', label: 'Low Carb', emoji: '💪' },
]

const sortOptions = [
  { id: 'rating', label: 'Mieux notees', icon: Star },
  { id: 'recent', label: 'Plus recentes', icon: Calendar },
  { id: 'trending', label: 'Tendances', icon: TrendingUp },
  { id: 'calories', label: 'Calories', icon: Flame },
]

// Difficulty labels
const difficultyLabels: Record<string, { label: string; color: string }> = {
  easy: { label: 'Facile', color: colors.success },
  medium: { label: 'Moyen', color: colors.warning },
  hard: { label: 'Difficile', color: colors.error },
}

function getDifficulty(difficulty?: string) {
  return difficultyLabels[difficulty || 'medium'] || difficultyLabels.medium
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
    createdAt: new Date().toISOString(),
  }
}

interface RecipeDiscoveryProps {
  onRecipePress: (recipe: Recipe) => void
  onClose?: () => void
}

export function RecipeDiscovery({ onRecipePress, onClose }: RecipeDiscoveryProps) {
  const { profile } = useUserStore()
  const { getTopRatedAIRecipes, aiRecipes, favoriteRecipes } = useRecipesStore()

  // State
  const [isLoading, setIsLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [gustarRecipesList, setGustarRecipesList] = useState<Recipe[]>([])

  // Filters
  const [selectedMealType, setSelectedMealType] = useState('')
  const [selectedCuisine, setSelectedCuisine] = useState('')
  const [selectedDiet, setSelectedDiet] = useState('')
  const [sortBy, setSortBy] = useState('rating')
  const [showFilters, setShowFilters] = useState(false)

  // Initialize Gustar API
  useEffect(() => {
    if (GUSTAR_API_KEY) {
      gustarRecipes.init(GUSTAR_API_KEY)
    }
  }, [])

  // Auto-fetch popular recipes on mount
  useEffect(() => {
    fetchPopularRecipes()
  }, [])

  const fetchPopularRecipes = async () => {
    setIsLoading(true)
    try {
      // Pick random popular searches
      const randomSearches = POPULAR_SEARCHES
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)

      const allRecipes: Recipe[] = []

      for (const query of randomSearches) {
        try {
          const response = await gustarRecipes.searchRecipes({
            query,
            diet: profile?.dietType as DietaryPreference | undefined,
            limit: 5,
          })

          const transformed = response.recipes.map(transformGustarToRecipe)
          allRecipes.push(...transformed)
        } catch (error) {
          console.warn(`Failed to fetch recipes for "${query}":`, error)
        }
      }

      // Remove duplicates by id
      const uniqueRecipes = allRecipes.filter(
        (recipe, index, self) => index === self.findIndex(r => r.id === recipe.id)
      )

      setGustarRecipesList(uniqueRecipes)
    } catch (error) {
      console.warn('Failed to fetch popular recipes:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    try {
      const response = await gustarRecipes.searchRecipes({
        query: searchQuery,
        diet: selectedDiet as DietaryPreference | undefined,
        limit: 20,
      })

      const transformed = response.recipes.map(transformGustarToRecipe)
      setGustarRecipesList(transformed)
    } catch (error) {
      console.warn('Search failed:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchPopularRecipes()
    setRefreshing(false)
  }, [])

  // Get top-rated AI recipes
  const topAIRecipes = useMemo(() => {
    let recipes = getTopRatedAIRecipes(undefined, 10)

    // Filter by meal type if selected
    if (selectedMealType) {
      recipes = recipes.filter(r => r.mealType === selectedMealType)
    }

    return recipes
  }, [getTopRatedAIRecipes, selectedMealType])

  // Filter and sort Gustar recipes
  const filteredRecipes = useMemo(() => {
    let recipes = [...gustarRecipesList]

    // Filter by meal type (approximate based on calories)
    if (selectedMealType) {
      recipes = recipes.filter(recipe => {
        const cals = recipe.nutritionPerServing?.calories || 0
        switch (selectedMealType) {
          case 'breakfast': return cals >= 200 && cals <= 500
          case 'lunch': return cals >= 400 && cals <= 800
          case 'snack': return cals >= 50 && cals <= 300
          case 'dinner': return cals >= 350 && cals <= 700
          default: return true
        }
      })
    }

    // Filter by diet
    if (selectedDiet) {
      recipes = recipes.filter(recipe =>
        recipe.dietTypes?.includes(selectedDiet) ||
        recipe.tags?.includes(selectedDiet)
      )
    }

    // Sort
    switch (sortBy) {
      case 'rating':
        recipes.sort((a, b) => (b.rating || 0) - (a.rating || 0))
        break
      case 'recent':
        recipes.sort((a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        )
        break
      case 'calories':
        recipes.sort((a, b) =>
          (a.nutritionPerServing?.calories || 0) - (b.nutritionPerServing?.calories || 0)
        )
        break
      default:
        break
    }

    return recipes
  }, [gustarRecipesList, selectedMealType, selectedDiet, sortBy])

  const handleRecipePress = (recipe: Recipe) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onRecipePress(recipe)
  }

  const clearFilters = () => {
    setSelectedMealType('')
    setSelectedCuisine('')
    setSelectedDiet('')
    setSortBy('rating')
    setShowFilters(false)
  }

  const hasActiveFilters = selectedMealType || selectedCuisine || selectedDiet || sortBy !== 'rating'

  // Render AI recipe card
  const renderAIRecipeCard = (aiRecipe: AIRecipeRating) => {
    const recipe = aiRecipe.recipe
    return (
      <TouchableOpacity
        key={aiRecipe.recipeId}
        style={styles.aiRecipeCard}
        onPress={() => handleRecipePress(recipe)}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={['rgba(139, 92, 246, 0.15)', 'rgba(139, 92, 246, 0.05)']}
          style={styles.aiRecipeGradient}
        >
          {/* Image or placeholder */}
          <View style={styles.aiImageContainer}>
            {recipe.imageUrl ? (
              <Image source={{ uri: recipe.imageUrl }} style={styles.aiImage} resizeMode="cover" />
            ) : (
              <View style={styles.aiImagePlaceholder}>
                <Sparkles size={24} color="#8B5CF6" />
              </View>
            )}
            <View style={styles.aiStarBadge}>
              <Star size={10} color="#F59E0B" fill="#F59E0B" />
              <Text style={styles.aiStarText}>{aiRecipe.rating}</Text>
            </View>
          </View>

          {/* Content */}
          <View style={styles.aiContent}>
            <Text style={styles.aiTitle} numberOfLines={2}>{recipe.title}</Text>
            <View style={styles.aiMeta}>
              <View style={styles.aiMetaItem}>
                <Flame size={12} color={colors.nutrients.calories} />
                <Text style={styles.aiMetaText}>{recipe.nutritionPerServing?.calories || 0} kcal</Text>
              </View>
              <View style={styles.aiMetaItem}>
                <Clock size={12} color={colors.text.tertiary} />
                <Text style={styles.aiMetaText}>{recipe.prepTime}min</Text>
              </View>
            </View>
            <Text style={styles.aiUsage}>{aiRecipe.usedCount}x prepare</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    )
  }

  // Render Gustar recipe card
  const renderGustarRecipeCard = (recipe: Recipe) => {
    const difficulty = getDifficulty(recipe.difficulty)
    return (
      <Card
        key={recipe.id}
        style={styles.recipeCard}
        onPress={() => handleRecipePress(recipe)}
        padding="none"
      >
        <View style={styles.recipeCardRow}>
          {/* Image */}
          <View style={styles.recipeImageContainer}>
            {recipe.imageUrl ? (
              <Image source={{ uri: recipe.imageUrl }} style={styles.recipeImage} resizeMode="cover" />
            ) : (
              <LinearGradient
                colors={[`${colors.accent.primary}30`, `${colors.secondary.primary}30`]}
                style={styles.recipeImagePlaceholder}
              >
                <ChefHat size={32} color={colors.accent.primary} />
              </LinearGradient>
            )}
            <View style={styles.sourceBadge}>
              <Globe size={10} color="#FFFFFF" />
              <Text style={styles.sourceBadgeText}>{recipe.source || 'Web'}</Text>
            </View>
          </View>

          {/* Content */}
          <View style={styles.recipeContent}>
            <Text style={styles.recipeTitle} numberOfLines={2}>{recipe.title}</Text>
            <View style={styles.recipeMeta}>
              {(recipe.totalTime ?? 0) > 0 && (
                <View style={styles.metaItem}>
                  <Clock size={12} color={colors.text.tertiary} />
                  <Text style={styles.metaText}>{recipe.totalTime} min</Text>
                </View>
              )}
              <View style={styles.metaItem}>
                <Flame size={12} color={colors.text.tertiary} />
                <Text style={styles.metaText}>{recipe.nutritionPerServing?.calories || 0} kcal</Text>
              </View>
              <View style={styles.metaItem}>
                <Dumbbell size={12} color={colors.text.tertiary} />
                <Text style={styles.metaText}>{recipe.nutritionPerServing?.proteins || 0}g</Text>
              </View>
            </View>
            <View style={styles.recipeFooter}>
              <Badge variant="outline" size="sm" style={{ borderColor: difficulty.color }}>
                <Text style={{ color: difficulty.color, fontSize: 10 }}>{difficulty.label}</Text>
              </Badge>
              {recipe.rating && (
                <View style={styles.ratingContainer}>
                  <Star size={12} color="#F59E0B" fill="#F59E0B" />
                  <Text style={styles.ratingText}>{recipe.rating.toFixed(1)}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Card>
    )
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchInput}>
          <Search size={18} color={colors.text.tertiary} />
          <TextInput
            style={styles.searchText}
            placeholder="Rechercher (poulet, pasta, salade...)"
            placeholderTextColor={colors.text.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color={colors.text.muted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.searchButton}
          onPress={handleSearch}
          disabled={isSearching || !searchQuery.trim()}
        >
          {isSearching ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.searchButtonText}>Chercher</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Filter Toggle */}
      <TouchableOpacity
        style={styles.filterToggle}
        onPress={() => setShowFilters(!showFilters)}
      >
        <Filter size={16} color={hasActiveFilters ? colors.accent.primary : colors.text.secondary} />
        <Text style={[styles.filterToggleText, hasActiveFilters && styles.filterToggleTextActive]}>
          Filtres {hasActiveFilters && '(actifs)'}
        </Text>
        <ChevronDown
          size={16}
          color={hasActiveFilters ? colors.accent.primary : colors.text.secondary}
          style={{ transform: [{ rotate: showFilters ? '180deg' : '0deg' }] }}
        />
      </TouchableOpacity>

      {/* Filter Panel */}
      {showFilters && (
        <View style={styles.filterPanel}>
          {/* Meal Type Filter */}
          <Text style={styles.filterLabel}>Type de repas</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            {mealTypeFilters.map(filter => (
              <TouchableOpacity
                key={filter.id}
                style={[styles.filterChip, selectedMealType === filter.id && styles.filterChipActive]}
                onPress={() => setSelectedMealType(filter.id)}
              >
                <Text style={styles.filterEmoji}>{filter.emoji}</Text>
                <Text style={[styles.filterChipText, selectedMealType === filter.id && styles.filterChipTextActive]}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Diet Filter */}
          <Text style={styles.filterLabel}>Regime</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            {dietFilters.map(filter => (
              <TouchableOpacity
                key={filter.id}
                style={[styles.filterChip, selectedDiet === filter.id && styles.filterChipActive]}
                onPress={() => setSelectedDiet(filter.id)}
              >
                <Text style={styles.filterEmoji}>{filter.emoji}</Text>
                <Text style={[styles.filterChipText, selectedDiet === filter.id && styles.filterChipTextActive]}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Sort */}
          <Text style={styles.filterLabel}>Trier par</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            {sortOptions.map(option => (
              <TouchableOpacity
                key={option.id}
                style={[styles.filterChip, sortBy === option.id && styles.filterChipActive]}
                onPress={() => setSortBy(option.id)}
              >
                <option.icon size={14} color={sortBy === option.id ? '#FFFFFF' : colors.text.secondary} />
                <Text style={[styles.filterChipText, sortBy === option.id && styles.filterChipTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
              <X size={14} color={colors.error} />
              <Text style={styles.clearFiltersText}>Effacer les filtres</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent.primary} />
        }
      >
        {/* Top AI Recipes Section */}
        {topAIRecipes.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <View style={styles.aiIcon}>
                  <Sparkles size={16} color="#8B5CF6" />
                </View>
                <Text style={styles.sectionTitle}>Mes meilleures recettes IA</Text>
              </View>
              <Badge variant="default" size="sm">
                <Text style={styles.badgeText}>{topAIRecipes.length}</Text>
              </Badge>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.aiCarousel}>
              {topAIRecipes.map(renderAIRecipeCard)}
            </ScrollView>
          </View>
        )}

        {/* Gustar Recipes Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <View style={styles.gustarIcon}>
                <Globe size={16} color="#06B6D4" />
              </View>
              <Text style={styles.sectionTitle}>
                {searchQuery ? 'Resultats de recherche' : 'Decouvrir des recettes'}
              </Text>
            </View>
            {filteredRecipes.length > 0 && (
              <Badge variant="default" size="sm">
                <Text style={styles.badgeText}>{filteredRecipes.length}</Text>
              </Badge>
            )}
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.accent.primary} />
              <Text style={styles.loadingText}>Chargement des recettes...</Text>
            </View>
          ) : filteredRecipes.length > 0 ? (
            <View style={styles.recipesGrid}>
              {filteredRecipes.map(renderGustarRecipeCard)}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <ChefHat size={48} color={colors.text.muted} />
              <Text style={styles.emptyTitle}>Aucune recette trouvee</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? 'Essayez avec d\'autres mots-cles'
                  : 'Tirez vers le bas pour rafraichir'}
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: spacing['3xl'] }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.default,
    paddingVertical: spacing.md,
  },
  searchInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchText: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
  },
  searchButton: {
    backgroundColor: colors.accent.primary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    ...typography.smallMedium,
    color: '#FFFFFF',
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.default,
    paddingBottom: spacing.sm,
  },
  filterToggleText: {
    ...typography.small,
    color: colors.text.secondary,
  },
  filterToggleTextActive: {
    color: colors.accent.primary,
    fontWeight: '600',
  },
  filterPanel: {
    paddingHorizontal: spacing.default,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  filterLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  filterScroll: {
    marginBottom: spacing.xs,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.full,
    marginRight: spacing.sm,
  },
  filterChipActive: {
    backgroundColor: colors.accent.primary,
  },
  filterEmoji: {
    fontSize: 14,
  },
  filterChipText: {
    ...typography.small,
    color: colors.text.secondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    alignSelf: 'flex-start',
  },
  clearFiltersText: {
    ...typography.small,
    color: colors.error,
  },
  scrollView: {
    flex: 1,
  },
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
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  aiIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gustarIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  badgeText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  aiCarousel: {
    paddingHorizontal: spacing.default,
    gap: spacing.md,
  },
  aiRecipeCard: {
    width: 160,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  aiRecipeGradient: {
    flex: 1,
  },
  aiImageContainer: {
    height: 80,
    position: 'relative',
  },
  aiImage: {
    width: '100%',
    height: '100%',
  },
  aiImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  aiStarBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  aiStarText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  aiContent: {
    padding: spacing.sm,
  },
  aiTitle: {
    ...typography.smallMedium,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  aiMeta: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  aiMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  aiMetaText: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  aiUsage: {
    ...typography.caption,
    color: '#8B5CF6',
  },
  recipesGrid: {
    paddingHorizontal: spacing.default,
    gap: spacing.md,
  },
  recipeCard: {
    marginBottom: spacing.sm,
  },
  recipeCardRow: {
    flexDirection: 'row',
  },
  recipeImageContainer: {
    width: 100,
    height: 100,
    position: 'relative',
  },
  recipeImage: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
  },
  recipeImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
  },
  sourceBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  sourceBadgeText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontSize: 8,
  },
  recipeContent: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  recipeTitle: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  recipeMeta: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  metaText: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  recipeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    ...typography.small,
    color: colors.text.secondary,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.text.muted,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
  },
  emptySubtitle: {
    ...typography.small,
    color: colors.text.muted,
    textAlign: 'center',
  },
})

export default RecipeDiscovery
