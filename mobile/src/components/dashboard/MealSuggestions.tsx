import React, { useMemo, useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native'
import { Clock, Flame, ChevronRight, Sparkles, Timer, Star, Globe } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { Card } from '../ui/Card'
import { colors, radius, spacing, typography } from '../../constants/theme'
import { useUserStore } from '../../stores/user-store'
import { useMealsStore } from '../../stores/meals-store'
import { useRecipesStore, type AIRecipeRating } from '../../stores/recipes-store'
import { gustarRecipes, type GustarRecipe, type DietaryPreference } from '../../services/gustar-recipes'
import { translateGustarRecipesFast, hasOpenAIApiKey } from '../../services/ai-service'
import type { MealType, Recipe } from '../../types'

// API Key for Gustar.io
const GUSTAR_API_KEY = '7ab3c50b59mshef5d331907bd424p16332ajsn5ea4bf90e1b9'

// Search terms based on meal type for personalized suggestions (German terms for Gustar API)
// Using common German food terms that work with the API
const MEAL_TYPE_SEARCHES: Record<MealType, string[]> = {
  breakfast: ['haferflocken', 'pfannkuchen', 'ei', 'brot', 'joghurt'],
  lunch: ['salat', 'suppe', 'nudeln', 'reis', 'kartoffel'],
  snack: ['kuchen', 'keks', 'obst', 'nuss', 'riegel'],
  dinner: ['huhn', 'fisch', 'fleisch', 'gemuse', 'auflauf'],
}

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

// Mock suggestions based on remaining calories and meal type
const generateSuggestions = (
  remainingCalories: number,
  remainingProteins: number,
  mealType: MealType,
  dietType?: string
): SuggestedMeal[] => {
  const suggestions: SuggestedMeal[] = []

  // Base suggestions per meal type
  const mealSuggestions: Record<MealType, SuggestedMeal[]> = {
    breakfast: [
      {
        id: 'b1',
        name: 'Porridge proteines aux fruits',
        calories: 380,
        proteins: 18,
        carbs: 52,
        fats: 10,
        prepTime: 10,
        category: 'Cereales',
        mealType: 'breakfast',
        emoji: '🥣',
        reason: 'Riche en proteines pour bien demarrer',
        tags: ['Rapide', 'Proteines'],
      },
      {
        id: 'b2',
        name: 'Oeufs brouilles & avocat toast',
        calories: 420,
        proteins: 22,
        carbs: 28,
        fats: 24,
        prepTime: 15,
        category: 'Oeufs',
        mealType: 'breakfast',
        emoji: '🍳',
        reason: 'Equilibre parfait proteines/lipides',
        tags: ['Keto-friendly', 'Rassasiant'],
      },
      {
        id: 'b3',
        name: 'Smoothie bowl energetique',
        calories: 320,
        proteins: 12,
        carbs: 48,
        fats: 8,
        prepTime: 5,
        category: 'Smoothie',
        mealType: 'breakfast',
        emoji: '🫐',
        reason: 'Vitamines et antioxydants',
        tags: ['Express', 'Vitamines'],
      },
    ],
    lunch: [
      {
        id: 'l1',
        name: 'Bowl poulet quinoa legumes',
        calories: 520,
        proteins: 38,
        carbs: 45,
        fats: 18,
        prepTime: 25,
        category: 'Bowl',
        mealType: 'lunch',
        emoji: '🥗',
        reason: 'Complet et equilibre',
        tags: ['Proteines', 'Fibres'],
      },
      {
        id: 'l2',
        name: 'Saumon grille & riz sauvage',
        calories: 580,
        proteins: 42,
        carbs: 38,
        fats: 28,
        prepTime: 30,
        category: 'Poisson',
        mealType: 'lunch',
        emoji: '🐟',
        reason: 'Omega-3 pour la concentration',
        tags: ['Omega-3', 'Premium'],
      },
      {
        id: 'l3',
        name: 'Wrap poulet caesar',
        calories: 450,
        proteins: 32,
        carbs: 35,
        fats: 20,
        prepTime: 15,
        category: 'Wrap',
        mealType: 'lunch',
        emoji: '🌯',
        reason: 'Pratique et savoureux',
        tags: ['Rapide', 'Pratique'],
      },
    ],
    snack: [
      {
        id: 's1',
        name: 'Yaourt grec & granola maison',
        calories: 220,
        proteins: 15,
        carbs: 22,
        fats: 8,
        prepTime: 2,
        category: 'Laitier',
        mealType: 'snack',
        emoji: '🥛',
        reason: 'Boost proteine mi-journee',
        tags: ['Express', 'Proteines'],
      },
      {
        id: 's2',
        name: 'Fruits secs & amandes',
        calories: 180,
        proteins: 6,
        carbs: 20,
        fats: 10,
        prepTime: 0,
        category: 'Fruits secs',
        mealType: 'snack',
        emoji: '🥜',
        reason: 'Energie longue duree',
        tags: ['Sans prep', 'Energie'],
      },
      {
        id: 's3',
        name: 'Barre proteines maison',
        calories: 200,
        proteins: 18,
        carbs: 15,
        fats: 8,
        prepTime: 0,
        category: 'Barre',
        mealType: 'snack',
        emoji: '🍫',
        reason: 'Coupe-faim efficace',
        tags: ['Proteines', 'Sans prep'],
      },
    ],
    dinner: [
      {
        id: 'd1',
        name: 'Poulet roti & legumes grilles',
        calories: 480,
        proteins: 42,
        carbs: 25,
        fats: 22,
        prepTime: 40,
        category: 'Viande',
        mealType: 'dinner',
        emoji: '🍗',
        reason: 'Leger mais rassasiant',
        tags: ['Proteines', 'Low-carb'],
      },
      {
        id: 'd2',
        name: 'Curry de lentilles',
        calories: 420,
        proteins: 22,
        carbs: 55,
        fats: 12,
        prepTime: 35,
        category: 'Vegetarien',
        mealType: 'dinner',
        emoji: '🍛',
        reason: 'Fibres pour la digestion',
        tags: ['Vegetarien', 'Fibres'],
      },
      {
        id: 'd3',
        name: 'Poke bowl thon sesame',
        calories: 450,
        proteins: 35,
        carbs: 42,
        fats: 16,
        prepTime: 20,
        category: 'Poke',
        mealType: 'dinner',
        emoji: '🍣',
        reason: 'Frais et nutritif',
        tags: ['Omega-3', 'Rapide'],
      },
    ],
  }

  const baseSuggestions = mealSuggestions[mealType] || []

  // Filter based on remaining calories
  return baseSuggestions
    .filter(s => s.calories <= remainingCalories + 100)
    .map(s => ({
      ...s,
      reason: remainingProteins > 30
        ? s.proteins > 20 ? 'Riche en proteines' : s.reason
        : s.reason
    }))
    .slice(0, 3)
}

export function MealSuggestions({ onSuggestionPress, onViewAll }: MealSuggestionsProps) {
  const { profile, nutritionGoals } = useUserStore()
  const { getTodayData } = useMealsStore()
  const { getTopRatedAIRecipes, favoriteRecipes } = useRecipesStore()

  const [gustarSuggestions, setGustarSuggestions] = useState<SuggestedMeal[]>([])
  const [isLoadingGustar, setIsLoadingGustar] = useState(false)
  const [translations, setTranslations] = useState<Map<string, { titleFr: string; descriptionFr: string }>>(new Map())

  const todayData = getTodayData()
  const totals = todayData.totalNutrition
  const goals = nutritionGoals || { calories: 2000, proteins: 100, carbs: 250, fats: 67 }

  const remainingCalories = Math.max(0, goals.calories - totals.calories)
  const remainingProteins = Math.max(0, goals.proteins - totals.proteins)
  const currentMealType = getCurrentMealType()

  // Translate Gustar recipes
  const translateSuggestions = useCallback(async (suggestions: SuggestedMeal[]) => {
    const hasKey = await hasOpenAIApiKey()
    if (!hasKey || suggestions.length === 0) return

    try {
      const toTranslate = suggestions.filter(s => s.isGustar && !translations.has(s.id))
      if (toTranslate.length === 0) return

      const translationMap = await translateGustarRecipesFast(
        toTranslate.map(s => ({
          id: s.id,
          title: s.name,
          description: s.reason,
        }))
      )

      setTranslations(prev => {
        const newMap = new Map(prev)
        translationMap.forEach((value, key) => {
          newMap.set(key, value)
        })
        return newMap
      })
    } catch (error) {
      console.warn('Translation failed:', error)
    }
  }, [translations])

  // Initialize Gustar API and fetch personalized suggestions
  useEffect(() => {
    const fetchGustarSuggestions = async () => {
      if (!GUSTAR_API_KEY) return

      try {
        gustarRecipes.init(GUSTAR_API_KEY)
        setIsLoadingGustar(true)

        // Get search terms for current meal type
        const searchTerms = MEAL_TYPE_SEARCHES[currentMealType]
        const randomTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)]

        const response = await gustarRecipes.searchRecipes({
          query: randomTerm,
          diet: profile?.dietType as DietaryPreference | undefined,
          limit: 5,
        })

        console.log(`MealSuggestions: Got ${response.recipes.length} recipes for "${randomTerm}"`)

        // Transform to SuggestedMeal format (relaxed calorie filter)
        const transformed: SuggestedMeal[] = response.recipes
          .slice(0, 2)
          .map(recipe => ({
            id: recipe.id,
            name: recipe.title,
            calories: recipe.nutrition?.calories || 0,
            proteins: recipe.nutrition?.proteins || 0,
            carbs: recipe.nutrition?.carbs || 0,
            fats: recipe.nutrition?.fats || 0,
            prepTime: recipe.prepTime || 20,
            category: 'Gustar',
            mealType: currentMealType,
            emoji: '🌍',
            reason: 'Recommande pour vous',
            tags: ['Web', recipe.dietary?.[0] || 'Populaire'].filter(Boolean),
            imageUrl: recipe.image,
            isGustar: true,
            rating: 4.5,
            source: 'Gustar.io',
          }))

        setGustarSuggestions(transformed)

        // Translate in background
        translateSuggestions(transformed)
      } catch (error) {
        console.warn('Failed to fetch Gustar suggestions:', error)
      } finally {
        setIsLoadingGustar(false)
      }
    }

    fetchGustarSuggestions()
  }, [currentMealType, profile?.dietType, remainingCalories, translateSuggestions])

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

  // Generate default suggestions if no AI recipes
  const defaultSuggestions = useMemo(() =>
    generateSuggestions(
      remainingCalories,
      remainingProteins,
      currentMealType,
      profile?.dietType
    ),
    [remainingCalories, remainingProteins, currentMealType, profile?.dietType]
  )

  // Combine all sources: AI recipes first, then favorites, Gustar, then defaults
  // Apply translations to Gustar recipes
  const suggestions = useMemo(() => {
    const combined: SuggestedMeal[] = []

    // 1. Top-rated AI recipes (priority)
    combined.push(...aiSuggestions.slice(0, 2))

    // 2. Favorite recipes if any
    if (combined.length < 3 && favoriteSuggestions.length > 0) {
      combined.push(...favoriteSuggestions.slice(0, 3 - combined.length))
    }

    // 3. Gustar recipes (with translations applied)
    if (combined.length < 3 && gustarSuggestions.length > 0) {
      const translatedGustar = gustarSuggestions.map(suggestion => {
        const translation = translations.get(suggestion.id)
        if (translation) {
          return {
            ...suggestion,
            name: translation.titleFr,
            reason: translation.descriptionFr || suggestion.reason,
          }
        }
        return suggestion
      })
      combined.push(...translatedGustar.slice(0, 3 - combined.length))
    }

    // 4. Fill with defaults
    const remaining = 3 - combined.length
    if (remaining > 0) {
      combined.push(...defaultSuggestions.slice(0, remaining))
    }

    return combined
  }, [aiSuggestions, favoriteSuggestions, gustarSuggestions, defaultSuggestions, translations])

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
        {onViewAll && (
          <TouchableOpacity onPress={onViewAll} style={styles.viewAllButton}>
            <Text style={styles.viewAllText}>Voir tout</Text>
            <ChevronRight size={16} color={colors.accent.primary} />
          </TouchableOpacity>
        )}
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
              {suggestion.isGustar && (
                <View style={styles.gustarbadge}>
                  <Globe size={10} color="#FFFFFF" />
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
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllText: {
    ...typography.smallMedium,
    color: colors.accent.primary,
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
  gustarbadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#06B6D4',
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
