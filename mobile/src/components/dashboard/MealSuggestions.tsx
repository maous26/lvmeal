import React, { useMemo, useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native'
import { Clock, Flame, ChevronRight, Sparkles, Timer, Star, ChefHat } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { colors, radius, spacing, typography } from '../../constants/theme'
import { useUserStore } from '../../stores/user-store'
import { useMealsStore } from '../../stores/meals-store'
import { useRecipesStore, type AIRecipeRating } from '../../stores/recipes-store'
import {
  loadStaticRecipes,
  getStaticRecipesByMealType,
  filterStaticRecipes,
  staticToRecipe,
  type StaticEnrichedRecipe,
} from '../../services/static-recipes'
import type { MealType } from '../../types'

interface MealSuggestionsProps {
  onSuggestionPress?: (recipe: SuggestedMeal) => void
  onViewAll?: () => void
}

export interface SuggestedMeal {
  id: string
  name: string
  calories: number
  proteins: number
  carbs: number
  fats: number
  prepTime: number
  category: string
  mealType: MealType
  emoji: string
  reason: string
  tags: string[]
  imageUrl?: string
  isAI?: boolean
  isGustar?: boolean
  rating?: number
  source?: string
}

// Get current meal type based on time
const getCurrentMealType = (): MealType => {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 11) return 'breakfast'
  if (hour >= 11 && hour < 15) return 'lunch'
  if (hour >= 15 && hour < 18) return 'snack'
  return 'dinner'
}

// Get meal type label
const getMealTypeLabel = (type: MealType): string => {
  const labels: Record<MealType, string> = {
    breakfast: 'Petit-dejeuner',
    lunch: 'Dejeuner',
    snack: 'Collation',
    dinner: 'Diner',
  }
  return labels[type]
}

// Get emoji for meal type
const getMealTypeEmoji = (type: MealType): string => {
  const emojis: Record<MealType, string> = {
    breakfast: '🌅',
    lunch: '☀️',
    snack: '🍎',
    dinner: '🌙',
  }
  return emojis[type]
}

// Convert StaticEnrichedRecipe to SuggestedMeal format
const staticToSuggestion = (recipe: StaticEnrichedRecipe, mealType: MealType): SuggestedMeal => {
  return {
    id: recipe.id,
    name: recipe.titleFr,
    calories: recipe.nutrition.calories,
    proteins: recipe.nutrition.proteins,
    carbs: recipe.nutrition.carbs,
    fats: recipe.nutrition.fats,
    prepTime: recipe.prepTime,
    category: recipe.mealType || 'general',
    mealType: recipe.mealType || mealType,
    emoji: getMealTypeEmoji(recipe.mealType || mealType),
    reason: recipe.descriptionFr?.substring(0, 60) + '...' || 'Recette recommandee',
    tags: [recipe.difficulty === 'easy' ? 'Facile' : recipe.difficulty === 'hard' ? 'Difficile' : 'Moyen', `${recipe.prepTime}min`],
    imageUrl: recipe.imageUrl,
    rating: 4.5,
    source: recipe.source,
  }
}

export function MealSuggestions({ onSuggestionPress, onViewAll }: MealSuggestionsProps) {
  const { profile, nutritionGoals } = useUserStore()
  const { getTodayData } = useMealsStore()
  const { getTopRatedAIRecipes, favoriteRecipes } = useRecipesStore()

  const [staticSuggestions, setStaticSuggestions] = useState<SuggestedMeal[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const todayData = getTodayData()
  const totals = todayData.totalNutrition
  const goals = nutritionGoals || { calories: 2000, proteins: 100, carbs: 250, fats: 67 }

  const remainingCalories = Math.max(0, goals.calories - totals.calories)
  const remainingProteins = Math.max(0, goals.proteins - totals.proteins)
  const currentMealType = getCurrentMealType()

  // Load suggestions from enriched-recipes.json based on meal type and user profile
  useEffect(() => {
    const loadSuggestions = async () => {
      setIsLoading(true)
      try {
        // Load all static recipes first
        await loadStaticRecipes()

        // Filter recipes based on meal type and user's remaining calories
        const filtered = filterStaticRecipes({
          mealType: currentMealType,
          maxCalories: remainingCalories > 0 ? remainingCalories + 200 : undefined,
          minProtein: remainingProteins > 30 ? 15 : undefined,
          limit: 10,
        })

        // If no recipes match the meal type, get recipes by calorie range
        let recipesToUse = filtered
        if (filtered.length === 0) {
          // Fallback: get any recipes that fit calorie budget
          recipesToUse = filterStaticRecipes({
            maxCalories: remainingCalories > 0 ? remainingCalories + 200 : undefined,
            limit: 10,
          })
        }

        // Shuffle and pick 3-5 random recipes
        const shuffled = [...recipesToUse].sort(() => Math.random() - 0.5)
        const selected = shuffled.slice(0, 5)

        // Convert to SuggestedMeal format
        const suggestions = selected.map(recipe => staticToSuggestion(recipe, currentMealType))
        setStaticSuggestions(suggestions)

        console.log(`MealSuggestions: Loaded ${suggestions.length} suggestions for ${currentMealType}`)
      } catch (error) {
        console.warn('Failed to load static suggestions:', error)
        setStaticSuggestions([])
      } finally {
        setIsLoading(false)
      }
    }

    loadSuggestions()
  }, [currentMealType, remainingCalories, remainingProteins])

  // Get top-rated AI recipes for current meal type
  const topRatedAIRecipes = useMemo(() =>
    getTopRatedAIRecipes(currentMealType, 3),
    [currentMealType, getTopRatedAIRecipes]
  )

  // Get favorite recipes matching current meal type (based on calories)
  const favoriteSuggestions: SuggestedMeal[] = useMemo(() => {
    return favoriteRecipes
      .filter(recipe => {
        const cals = recipe.nutritionPerServing?.calories || recipe.nutrition?.calories || 0
        // Match by calorie range for meal type
        switch (currentMealType) {
          case 'breakfast': return cals >= 200 && cals <= 500
          case 'lunch': return cals >= 400 && cals <= 800
          case 'snack': return cals >= 50 && cals <= 300
          case 'dinner': return cals >= 350 && cals <= 700
          default: return true
        }
      })
      .slice(0, 1)
      .map(recipe => ({
        id: recipe.id,
        name: recipe.title,
        calories: recipe.nutritionPerServing?.calories || recipe.nutrition?.calories || 0,
        proteins: recipe.nutritionPerServing?.proteins || recipe.nutrition?.proteins || 0,
        carbs: recipe.nutritionPerServing?.carbs || recipe.nutrition?.carbs || 0,
        fats: recipe.nutritionPerServing?.fats || recipe.nutrition?.fats || 0,
        prepTime: recipe.prepTime || 0,
        category: 'Favori',
        mealType: currentMealType,
        emoji: '❤️',
        reason: 'Un de vos favoris',
        tags: ['Favori', `${recipe.rating || 5}★`],
        imageUrl: recipe.imageUrl,
        rating: recipe.rating || 5,
      }))
  }, [favoriteRecipes, currentMealType])

  // Convert AI recipes to SuggestedMeal format
  const aiSuggestions: SuggestedMeal[] = useMemo(() =>
    topRatedAIRecipes.map((aiRecipe: AIRecipeRating) => ({
      id: aiRecipe.recipeId,
      name: aiRecipe.recipe.title,
      calories: aiRecipe.recipe.nutrition?.calories || aiRecipe.recipe.nutritionPerServing?.calories || 0,
      proteins: aiRecipe.recipe.nutrition?.proteins || aiRecipe.recipe.nutritionPerServing?.proteins || 0,
      carbs: aiRecipe.recipe.nutrition?.carbs || aiRecipe.recipe.nutritionPerServing?.carbs || 0,
      fats: aiRecipe.recipe.nutrition?.fats || aiRecipe.recipe.nutritionPerServing?.fats || 0,
      prepTime: aiRecipe.recipe.prepTime || 0,
      category: 'IA',
      mealType: aiRecipe.mealType,
      emoji: '✨',
      reason: `Note: ${aiRecipe.rating}/5 · ${aiRecipe.usedCount}x prepare`,
      tags: ['IA', `${aiRecipe.rating}★`],
      imageUrl: aiRecipe.recipe.imageUrl,
      isAI: true,
      rating: aiRecipe.rating,
    })),
    [topRatedAIRecipes]
  )

  // Combine all sources: AI recipes first, then favorites, then static recipes from enriched-recipes.json
  const suggestions = useMemo(() => {
    const combined: SuggestedMeal[] = []

    // 1. Top-rated AI recipes (priority)
    combined.push(...aiSuggestions.slice(0, 2))

    // 2. Favorite recipes if any
    if (combined.length < 3 && favoriteSuggestions.length > 0) {
      combined.push(...favoriteSuggestions.slice(0, 3 - combined.length))
    }

    // 3. Static recipes from enriched-recipes.json
    const remaining = 3 - combined.length
    if (remaining > 0 && staticSuggestions.length > 0) {
      combined.push(...staticSuggestions.slice(0, remaining))
    }

    return combined
  }, [aiSuggestions, favoriteSuggestions, staticSuggestions])

  const handlePress = (suggestion: SuggestedMeal) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onSuggestionPress?.(suggestion)
  }

  if (suggestions.length === 0) {
    return null
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.aiIcon}>
            <Sparkles size={16} color="#8B5CF6" />
          </View>
          <View>
            <Text style={styles.title}>Suggestions pour le {getMealTypeLabel(currentMealType).toLowerCase()}</Text>
            <Text style={styles.subtitle}>
              {remainingCalories > 0
                ? `~${remainingCalories} kcal restantes`
                : 'Objectif atteint!'}
            </Text>
          </View>
        </View>
      </View>

      {/* Suggestions Carousel */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carouselContent}
      >
        {suggestions.map((suggestion) => (
          <TouchableOpacity
            key={suggestion.id}
            style={styles.suggestionCard}
            onPress={() => handlePress(suggestion)}
            activeOpacity={0.7}
          >
            {/* Image or Emoji */}
            <View style={styles.emojiContainer}>
              {suggestion.imageUrl ? (
                <Image
                  source={{ uri: suggestion.imageUrl }}
                  style={styles.suggestionImage}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.emoji}>{suggestion.emoji}</Text>
              )}
              {suggestion.isAI && (
                <View style={styles.aibadge}>
                  <Sparkles size={10} color="#FFFFFF" />
                </View>
              )}
              {!suggestion.isAI && suggestion.source && (
                <View style={styles.sourceBadge}>
                  <ChefHat size={10} color="#FFFFFF" />
                </View>
              )}
              {suggestion.rating && suggestion.rating > 0 && (
                <View style={styles.ratingBadge}>
                  <Star size={8} color="#F59E0B" fill="#F59E0B" />
                  <Text style={styles.ratingText}>{suggestion.rating}</Text>
                </View>
              )}
            </View>

            {/* Content */}
            <View style={styles.cardContent}>
              <Text style={styles.suggestionName} numberOfLines={2}>
                {suggestion.name}
              </Text>

              {/* Tags */}
              <View style={styles.tagsRow}>
                {suggestion.tags.slice(0, 2).map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>

              {/* Nutrition */}
              <View style={styles.nutritionRow}>
                <View style={styles.nutritionItem}>
                  <Flame size={12} color={colors.nutrients.calories} />
                  <Text style={styles.nutritionText}>{suggestion.calories}</Text>
                </View>
                <View style={styles.nutritionItem}>
                  <Text style={[styles.nutritionText, styles.proteinText]}>
                    P:{suggestion.proteins}g
                  </Text>
                </View>
                <View style={styles.nutritionItem}>
                  <Timer size={12} color={colors.text.muted} />
                  <Text style={styles.nutritionText}>{suggestion.prepTime}min</Text>
                </View>
              </View>

              {/* Reason */}
              <Text style={styles.reason} numberOfLines={1}>
                {suggestion.reason}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* More Card */}
        <TouchableOpacity
          style={styles.moreCard}
          onPress={onViewAll}
          activeOpacity={0.7}
        >
          <View style={styles.moreContent}>
            <ChevronRight size={24} color={colors.accent.primary} />
            <Text style={styles.moreText}>Explorer les recettes</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  aiIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  carouselContent: {
    paddingRight: spacing.default,
  },
  suggestionCard: {
    width: 180,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    marginRight: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  emojiContainer: {
    height: 80,
    backgroundColor: colors.bg.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  suggestionImage: {
    width: '100%',
    height: '100%',
  },
  emoji: {
    fontSize: 40,
  },
  aibadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#8B5CF6',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sourceBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#10B981',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingBadge: {
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
  ratingText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  cardContent: {
    padding: spacing.md,
  },
  suggestionName: {
    ...typography.smallMedium,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    height: 36,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: radius.sm,
  },
  tagText: {
    ...typography.caption,
    color: '#8B5CF6',
    fontSize: 10,
  },
  nutritionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  nutritionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  nutritionText: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  proteinText: {
    color: colors.nutrients.proteins,
    fontWeight: '600',
  },
  reason: {
    ...typography.caption,
    color: colors.text.muted,
    fontStyle: 'italic',
  },
  moreCard: {
    width: 100,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent.light,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreContent: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  moreText: {
    ...typography.caption,
    color: colors.accent.primary,
    textAlign: 'center',
  },
})

export default MealSuggestions
