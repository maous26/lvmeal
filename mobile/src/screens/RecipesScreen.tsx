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
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { colors, spacing, typography, radius } from '../constants/theme'
import { useRecipesStore, type AIRecipeRating } from '../stores/recipes-store'
import {
  loadStaticRecipes,
  searchStaticRecipes,
  staticToRecipe,
} from '../services/static-recipes'
import { NutriScoreBadge } from '../components/ui'
import type { Recipe, MealType } from '../types'

// Category configurations - Filtres pertinents et fonctionnels
const CATEGORIES = [
  { id: 'quick', label: 'Rapide (<20min)', emoji: '⚡', color: '#F59E0B' },
  { id: 'highprotein', label: 'Protéiné', emoji: '💪', color: '#EF4444' },
  { id: 'lowcarb', label: 'Low Carb', emoji: '🥩', color: '#8B5CF6' },
  { id: 'vegetarian', label: 'Végétarien', emoji: '🥗', color: '#22C55E' },
  { id: 'mealprep', label: 'Batch Cooking', emoji: '🍱', color: '#10B981' },
]

const MEAL_TYPES: { id: MealType | ''; label: string }[] = [
  { id: '', label: 'Tous' },
  { id: 'breakfast', label: 'Petit-déjeuner' },
  { id: 'lunch', label: 'Déjeuner' },
  { id: 'snack', label: 'Collation' },
  { id: 'dinner', label: 'Dîner' },
]

export default function RecipesScreen() {
  const navigation = useNavigation()
  const { getTopRatedAIRecipes } = useRecipesStore()
  const [favorites, setFavorites] = useState<string[]>([])

  // State
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMealType, setSelectedMealType] = useState<MealType | ''>('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([])

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

  // Filtered recipes based on selected category
  const filteredRecipes = useMemo(() => {
    return filterByCategory(allRecipes, selectedCategory)
  }, [allRecipes, selectedCategory, filterByCategory])

  // Group recipes by categories (with deduplication)
  const breakfastRecipes = useMemo(() => {
    const filtered = filteredRecipes.filter(r => {
      const cals = r.nutritionPerServing?.calories || 0
      return cals >= 150 && cals <= 500
    })
    return deduplicateRecipes(filtered).slice(0, 10)
  }, [filteredRecipes])

  const lunchRecipes = useMemo(() => {
    const filtered = filteredRecipes.filter(r => {
      const cals = r.nutritionPerServing?.calories || 0
      return cals >= 400 && cals <= 800
    })
    return deduplicateRecipes(filtered).slice(0, 10)
  }, [filteredRecipes])

  const snackRecipes = useMemo(() => {
    const filtered = filteredRecipes.filter(r => {
      const cals = r.nutritionPerServing?.calories || 0
      return cals >= 50 && cals <= 300
    })
    return deduplicateRecipes(filtered).slice(0, 10)
  }, [filteredRecipes])

  const dinnerRecipes = useMemo(() => {
    const filtered = filteredRecipes.filter(r => {
      const cals = r.nutritionPerServing?.calories || 0
      return cals >= 350 && cals <= 700
    })
    return deduplicateRecipes(filtered).slice(0, 10)
  }, [filteredRecipes])

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
        style={[styles.recipeCard, { width: cardWidth }]}
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
            <View style={styles.recipeImagePlaceholder}>
              <ChefHat size={32} color="#9CA3AF" />
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
          <Text style={[styles.categoryLabel, isSelected && { fontWeight: '700' }]}>
            {category.label}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    )
  }

  // Render section header
  const renderSectionHeader = (title: string, onViewAll?: () => void) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onViewAll && (
        <TouchableOpacity onPress={onViewAll}>
          <Text style={styles.viewAllText}>Voir tout</Text>
        </TouchableOpacity>
      )}
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={20} color={colors.text.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher"
            placeholderTextColor={colors.text.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity style={styles.filterButton}>
          <SlidersHorizontal size={20} color={colors.accent.primary} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent.primary} />
          <Text style={styles.loadingText}>Chargement des recettes...</Text>
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
                <Text style={styles.noResultsText}>Aucun résultat trouvé</Text>
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
                <View style={styles.activeFilterContainer}>
                  <Text style={styles.activeFilterText}>
                    Filtre actif : {CATEGORIES.find(c => c.id === selectedCategory)?.label}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setSelectedCategory(null)}
                    style={styles.clearFilterButton}
                  >
                    <Text style={styles.clearFilterText}>Effacer</Text>
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
    color: colors.text.muted,
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
  },
  viewAllText: {
    ...typography.small,
    color: colors.accent.primary,
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
    color: colors.text.muted,
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
    backgroundColor: colors.accent.primary + '15',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent.primary + '30',
  },
  activeFilterText: {
    ...typography.small,
    color: colors.accent.primary,
    fontWeight: '500',
  },
  clearFilterButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  clearFilterText: {
    ...typography.small,
    color: colors.accent.primary,
    fontWeight: '600',
  },
})
