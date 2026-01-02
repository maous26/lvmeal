import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Image,
  TextInput,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { LinearGradient } from 'expo-linear-gradient'
import {
  ArrowLeft,
  Clock,
  Users,
  Flame,
  Heart,
  Star,
  Plus,
  Check,
  ChefHat,
  ExternalLink,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { Button } from '../components/ui'
import { colors, spacing, typography, radius } from '../constants/theme'
import { useTheme } from '../contexts/ThemeContext'
import { useMealsStore } from '../stores/meals-store'
import { useGamificationStore } from '../stores/gamification-store'
import { useRecipesStore } from '../stores/recipes-store'
import { loadStaticRecipes, getStaticRecipe, staticToRecipe } from '../services/static-recipes'
import type { MealType, FoodItem, MealItem, Recipe } from '../types'
import { generateId } from '../lib/utils'

const mealConfig: Record<MealType, { label: string; icon: string; color: string }> = {
  breakfast: { label: 'Petit-dejeuner', icon: '☀️', color: colors.warning },
  lunch: { label: 'Dejeuner', icon: '🍽️', color: colors.accent.primary },
  snack: { label: 'Collation', icon: '🍎', color: colors.success },
  dinner: { label: 'Diner', icon: '🌙', color: colors.secondary.primary },
}

const mealTypeOptions: { id: MealType; label: string; icon: string }[] = [
  { id: 'breakfast', label: 'Petit-dej', icon: '🌅' },
  { id: 'lunch', label: 'Dejeuner', icon: '☀️' },
  { id: 'snack', label: 'Collation', icon: '🍎' },
  { id: 'dinner', label: 'Diner', icon: '🌙' },
]

interface RecipeDetailParams {
  recipe?: Recipe
  suggestion?: {
    id: string
    name: string
    calories: number
    proteins: number
    carbs: number
    fats: number
    prepTime: number
    mealType: MealType
    imageUrl?: string
    isAI?: boolean
    isGustar?: boolean
    source?: string
  }
  mealType?: MealType
}

export default function RecipeDetailScreen() {
  const navigation = useNavigation()
  const route = useRoute()
  const params = (route.params as RecipeDetailParams) || {}
  const { colors: themeColors } = useTheme()

  const { addMeal } = useMealsStore()
  const { addXP } = useGamificationStore()
  const { favoriteRecipes, addToFavorites, removeFromFavorites, rateAIRecipe } = useRecipesStore()

  // Convert suggestion to recipe format if needed
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [selectedMealType, setSelectedMealType] = useState<MealType>(
    params.mealType || params.suggestion?.mealType || 'lunch'
  )
  const [userRating, setUserRating] = useState(0)
  const [userComment, setUserComment] = useState('')

  useEffect(() => {
    const loadRecipeData = async () => {
      if (params.recipe) {
        setRecipe(params.recipe)
      } else if (params.suggestion) {
        const suggestion = params.suggestion

        // Try to load full recipe data from enriched-recipes.json
        await loadStaticRecipes()
        const staticRecipe = getStaticRecipe(suggestion.id)

        if (staticRecipe) {
          // Found full recipe with ingredients and instructions
          const fullRecipe = staticToRecipe(staticRecipe)
          setRecipe(fullRecipe)
          console.log(`RecipeDetail: Loaded full recipe "${fullRecipe.title}" with ${fullRecipe.ingredients.length} ingredients`)
        } else {
          // Fallback to minimal recipe (for AI-generated or external recipes)
          setRecipe({
            id: suggestion.id,
            title: suggestion.name,
            description: '',
            servings: 1,
            prepTime: suggestion.prepTime || 20,
            cookTime: 0,
            totalTime: suggestion.prepTime || 20,
            difficulty: 'medium',
            category: 'general',
            ingredients: [],
            instructions: [],
            nutrition: {
              calories: suggestion.calories,
              proteins: suggestion.proteins,
              carbs: suggestion.carbs,
              fats: suggestion.fats,
            },
            nutritionPerServing: {
              calories: suggestion.calories,
              proteins: suggestion.proteins,
              carbs: suggestion.carbs,
              fats: suggestion.fats,
            },
            tags: [],
            dietTypes: [],
            allergens: [],
            rating: 4.5,
            ratingCount: 0,
            isFavorite: false,
            imageUrl: suggestion.imageUrl,
            source: suggestion.source || (suggestion.isAI ? 'IA' : suggestion.isGustar ? 'Gustar.io' : 'Presence'),
          })
        }
        setSelectedMealType(suggestion.mealType)
      }
    }

    loadRecipeData()
  }, [params])

  const isRecipeFavorite = (recipeId: string) => {
    return favoriteRecipes.some((r) => r.id === recipeId)
  }

  const handleToggleFavorite = () => {
    if (!recipe) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    if (isRecipeFavorite(recipe.id)) {
      removeFromFavorites(recipe.id)
    } else {
      addToFavorites(recipe)
    }
  }

  const handleRateRecipe = (rating: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setUserRating(rating)
  }

  const handleSaveRating = () => {
    if (!recipe || userRating === 0) return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    rateAIRecipe(recipe.id, userRating, userComment)
  }

  const handleAddToMeal = () => {
    if (!recipe) return

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    // Get nutrition per serving
    const servings = recipe.servings || 1
    const perServingNutrition = recipe.nutritionPerServing || {
      calories: (recipe.nutrition?.calories || 0) / servings,
      proteins: (recipe.nutrition?.proteins || 0) / servings,
      carbs: (recipe.nutrition?.carbs || 0) / servings,
      fats: (recipe.nutrition?.fats || 0) / servings,
    }

    // Convert recipe to FoodItem
    const recipeAsFood: FoodItem = {
      id: `recipe-${recipe.id}`,
      name: `${recipe.title} (1 portion)`,
      brand: recipe.source || 'Recette',
      servingSize: 1,
      servingUnit: 'portion',
      nutrition: {
        calories: Math.round(perServingNutrition.calories),
        proteins: Math.round(perServingNutrition.proteins),
        carbs: Math.round(perServingNutrition.carbs),
        fats: Math.round(perServingNutrition.fats),
      },
      source: 'recipe',
      imageUrl: recipe.imageUrl,
    }

    // Create MealItem
    const mealItem: MealItem = {
      id: generateId(),
      food: recipeAsFood,
      quantity: 1,
    }

    // Add to meal
    addMeal(selectedMealType, [mealItem])
    addXP(20, 'Recette ajoutee au repas')

    // Navigate back to home
    navigation.goBack()
  }

  if (!recipe) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.favoriteButton} onPress={handleToggleFavorite}>
            <Heart
              size={24}
              color={isRecipeFavorite(recipe.id) ? colors.error : colors.text.secondary}
              fill={isRecipeFavorite(recipe.id) ? colors.error : 'transparent'}
            />
          </TouchableOpacity>
        </View>

        {/* Recipe Image */}
        {recipe.imageUrl ? (
          <Image source={{ uri: recipe.imageUrl }} style={styles.recipeImage} resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={[colors.accent.primary, colors.secondary.primary]}
            style={styles.recipeImagePlaceholder}
          >
            <ChefHat size={64} color="#FFFFFF" />
          </LinearGradient>
        )}

        {/* Recipe Content */}
        <View style={styles.content}>
          <Text style={styles.title}>{recipe.title}</Text>
          {recipe.description ? (
            <Text style={styles.description}>{recipe.description}</Text>
          ) : null}

          {/* Meta */}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Clock size={18} color={colors.accent.primary} />
              <Text style={styles.metaValue}>{recipe.totalTime || recipe.prepTime} min</Text>
            </View>
            <View style={styles.metaItem}>
              <Users size={18} color={colors.accent.primary} />
              <Text style={styles.metaValue}>{recipe.servings} pers.</Text>
            </View>
            <View style={styles.metaItem}>
              <Flame size={18} color={colors.nutrients.calories} />
              <Text style={styles.metaValue}>
                {recipe.nutritionPerServing?.calories || recipe.nutrition?.calories} kcal
              </Text>
            </View>
          </View>

          {/* Nutrition */}
          <View style={styles.nutritionCard}>
            <Text style={styles.sectionTitle}>Nutrition par portion</Text>
            <View style={styles.nutritionRow}>
              <View style={styles.nutritionItem}>
                <Text style={[styles.nutritionValue, { color: colors.nutrients.proteins }]}>
                  {recipe.nutritionPerServing?.proteins || recipe.nutrition?.proteins}g
                </Text>
                <Text style={styles.nutritionLabel}>Proteines</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={[styles.nutritionValue, { color: colors.nutrients.carbs }]}>
                  {recipe.nutritionPerServing?.carbs || recipe.nutrition?.carbs}g
                </Text>
                <Text style={styles.nutritionLabel}>Glucides</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={[styles.nutritionValue, { color: colors.nutrients.fats }]}>
                  {recipe.nutritionPerServing?.fats || recipe.nutrition?.fats}g
                </Text>
                <Text style={styles.nutritionLabel}>Lipides</Text>
              </View>
            </View>
          </View>

          {/* Ingredients */}
          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ingredients</Text>
              {recipe.ingredients.map((ing, idx) => (
                <View key={idx} style={styles.ingredientRow}>
                  <View style={styles.bullet} />
                  <Text style={styles.ingredientText}>
                    {ing.amount} {ing.unit} {ing.name}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Instructions */}
          {recipe.instructions && recipe.instructions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Instructions</Text>
              {recipe.instructions.map((step, idx) => (
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
            <Text style={styles.sectionTitle}>Noter cette recette</Text>
            <Text style={styles.ratingSubtitle}>
              Les recettes les mieux notees apparaitront dans vos suggestions
            </Text>

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

            <TextInput
              style={styles.commentInput}
              placeholder="Ajouter un commentaire (optionnel)..."
              placeholderTextColor={colors.text.muted}
              value={userComment}
              onChangeText={setUserComment}
              multiline
              numberOfLines={2}
            />

            {userRating > 0 && (
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onPress={handleSaveRating}
                style={styles.saveRatingButton}
                icon={<Check size={18} color="#FFFFFF" />}
              >
                Enregistrer ma note
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
                    selectedMealType === meal.id && styles.mealTypeOptionActive,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setSelectedMealType(meal.id)
                  }}
                >
                  <Text style={styles.mealTypeEmoji}>{meal.icon}</Text>
                  <Text
                    style={[
                      styles.mealTypeLabel,
                      { color: themeColors.text.secondary },
                      selectedMealType === meal.id && [
                        styles.mealTypeLabelActive,
                        { color: themeColors.accent.primary },
                      ],
                    ]}
                  >
                    {meal.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Add to Meal Button */}
            <TouchableOpacity
              style={styles.addMealButton}
              onPress={handleAddToMeal}
              activeOpacity={0.8}
            >
              <Plus size={18} color="#FFFFFF" />
              <Text style={styles.addMealButtonText}>
                Ajouter au {mealConfig[selectedMealType]?.label || 'repas'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Add to favorites button */}
          <TouchableOpacity
            style={[
              styles.favActionButton,
              isRecipeFavorite(recipe.id)
                ? styles.favActionButtonOutline
                : styles.favActionButtonPrimary
            ]}
            onPress={handleToggleFavorite}
            activeOpacity={0.8}
          >
            <Heart
              size={18}
              color={isRecipeFavorite(recipe.id) ? themeColors.error : '#FFFFFF'}
              fill={isRecipeFavorite(recipe.id) ? themeColors.error : 'transparent'}
            />
            <Text
              style={[
                styles.favActionButtonText,
                isRecipeFavorite(recipe.id) && { color: themeColors.error }
              ]}
            >
              {isRecipeFavorite(recipe.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            </Text>
          </TouchableOpacity>

          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.default,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeImage: {
    width: '100%',
    height: 280,
  },
  recipeImagePlaceholder: {
    width: '100%',
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: spacing.lg,
    marginTop: -spacing.lg,
    backgroundColor: colors.bg.primary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    marginBottom: spacing.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaValue: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  nutritionCard: {
    backgroundColor: colors.bg.secondary,
    padding: spacing.default,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  nutritionItem: {
    alignItems: 'center',
  },
  nutritionValue: {
    ...typography.h4,
    fontWeight: '700',
  },
  nutritionLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.lg,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent.primary,
    marginRight: spacing.sm,
  },
  ingredientText: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },
  instructionRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  instructionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  instructionNumberText: {
    ...typography.smallMedium,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  instructionText: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
    lineHeight: 22,
  },
  ratingSection: {
    backgroundColor: colors.bg.secondary,
    padding: spacing.default,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
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
    backgroundColor: colors.bg.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.text.primary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveRatingButton: {
    marginTop: spacing.md,
  },
  addToMealSection: {
    backgroundColor: colors.bg.secondary,
    padding: spacing.default,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    overflow: 'visible',
  },
  addToMealTitle: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  mealTypeSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  mealTypeOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.bg.primary,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border.light,
  },
  mealTypeOptionActive: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.accent.light,
  },
  mealTypeEmoji: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  mealTypeLabel: {
    ...typography.caption,
  },
  mealTypeLabelActive: {
    fontWeight: '600',
  },
  addMealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#009FEB',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.xl,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  addMealButtonText: {
    ...typography.button,
    color: '#FFFFFF',
    fontSize: 17,
  },
  favActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.xl,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  favActionButtonPrimary: {
    backgroundColor: '#009FEB',
  },
  favActionButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.border.default,
  },
  favActionButtonText: {
    ...typography.button,
    color: '#FFFFFF',
    fontSize: 17,
  },
  bottomSpacer: {
    height: spacing['2xl'],
  },
})
