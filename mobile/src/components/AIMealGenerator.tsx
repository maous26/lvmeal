import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { Sparkles, ChefHat, Zap, Leaf, Dumbbell, Heart, Sun } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { Card, Button, Badge } from './ui'
import { colors, spacing, typography, radius } from '../constants/theme'
import { generateRecipe, hasOpenAIApiKey, type AIRecipe } from '../services/ai-service'
import { QUICK_RECIPE_PROMPTS } from '../lib/ai/prompts'
import type { MealType, NutritionInfo } from '../types'

interface AIMealGeneratorProps {
  mealType: MealType
  maxCalories?: number
  dietType?: string
  restrictions?: string[]
  onRecipeGenerated: (recipe: AIRecipe) => void
  onClose?: () => void
}

const QUICK_PROMPTS = [
  { key: 'fast_healthy', label: 'Rapide & Sain', icon: Zap, color: colors.success },
  { key: 'high_protein', label: 'Proteine', icon: Dumbbell, color: colors.nutrients.proteins },
  { key: 'vegetarian', label: 'Vegetarien', icon: Leaf, color: colors.success },
  { key: 'low_carb', label: 'Low Carb', icon: Heart, color: colors.warning },
  { key: 'comfort_food', label: 'Comfort', icon: Sun, color: colors.accent.primary },
  { key: 'mediterranean', label: 'Mediterraneen', icon: ChefHat, color: colors.secondary.primary },
]

export default function AIMealGenerator({
  mealType,
  maxCalories,
  dietType,
  restrictions,
  onRecipeGenerated,
  onClose,
}: AIMealGeneratorProps) {
  const [customPrompt, setCustomPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedRecipe, setGeneratedRecipe] = useState<AIRecipe | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async (promptKey?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    // Check API key
    const hasKey = await hasOpenAIApiKey()
    if (!hasKey) {
      Alert.alert(
        'Configuration requise',
        'Configure ta clé API OpenAI dans les paramètres pour utiliser les fonctionnalités IA.',
        [{ text: 'OK' }]
      )
      return
    }

    setIsGenerating(true)
    setError(null)
    setGeneratedRecipe(null)

    try {
      const description = promptKey
        ? QUICK_RECIPE_PROMPTS[promptKey]
        : customPrompt || undefined

      const result = await generateRecipe({
        mealType,
        description,
        maxCalories,
        dietType,
        restrictions,
      })

      if (result.success && result.recipe) {
        setGeneratedRecipe(result.recipe)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      } else {
        setError(result.error || 'Erreur lors de la generation')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleConfirm = () => {
    if (generatedRecipe) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      onRecipeGenerated(generatedRecipe)
    }
  }

  const handleRegenerate = () => {
    setGeneratedRecipe(null)
    handleGenerate()
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Sparkles size={24} color="#8B5CF6" />
        </View>
        <Text style={styles.headerTitle}>Generation IA</Text>
      </View>

      {!generatedRecipe ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Quick Prompts */}
          <Text style={styles.sectionTitle}>Suggestions rapides</Text>
          <View style={styles.quickPrompts}>
            {QUICK_PROMPTS.map(prompt => {
              const Icon = prompt.icon
              return (
                <TouchableOpacity
                  key={prompt.key}
                  style={styles.quickPromptButton}
                  onPress={() => handleGenerate(prompt.key)}
                  disabled={isGenerating}
                >
                  <Icon size={20} color={prompt.color} />
                  <Text style={styles.quickPromptText}>{prompt.label}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Custom Prompt */}
          <Text style={styles.sectionTitle}>Ou décris ton envie</Text>
          <TextInput
            style={styles.customInput}
            placeholder="Ex: Un plat reconfortant avec du poulet et des legumes de saison..."
            placeholderTextColor={colors.text.muted}
            value={customPrompt}
            onChangeText={setCustomPrompt}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          {/* Constraints info */}
          <View style={styles.constraintsInfo}>
            {maxCalories && (
              <Badge variant="secondary" size="sm">
                Max {maxCalories} kcal
              </Badge>
            )}
            {dietType && dietType !== 'omnivore' && (
              <Badge variant="secondary" size="sm">
                {dietType}
              </Badge>
            )}
            {restrictions && restrictions.length > 0 && (
              <Badge variant="secondary" size="sm">
                {restrictions.length} restriction(s)
              </Badge>
            )}
          </View>

          {/* Generate Button */}
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={() => handleGenerate()}
            disabled={isGenerating || (!customPrompt.trim() && !isGenerating)}
            style={styles.generateButton}
          >
            {isGenerating ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.buttonText}>Generation en cours...</Text>
              </>
            ) : (
              <>
                <Sparkles size={20} color="#FFFFFF" />
                <Text style={styles.buttonText}>Generer une recette</Text>
              </>
            )}
          </Button>

          {/* Error */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>
      ) : (
        /* Generated Recipe Display */
        <ScrollView showsVerticalScrollIndicator={false}>
          <Card style={styles.recipeCard}>
            <Text style={styles.recipeTitle}>{generatedRecipe.title}</Text>
            <Text style={styles.recipeDescription}>{generatedRecipe.description}</Text>

            {/* Nutrition */}
            <View style={styles.nutritionRow}>
              <View style={styles.nutritionItem}>
                <Text style={[styles.nutritionValue, { color: colors.nutrients.calories }]}>
                  {generatedRecipe.nutrition.calories}
                </Text>
                <Text style={styles.nutritionLabel}>kcal</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={[styles.nutritionValue, { color: colors.nutrients.proteins }]}>
                  {generatedRecipe.nutrition.proteins}g
                </Text>
                <Text style={styles.nutritionLabel}>Prot.</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={[styles.nutritionValue, { color: colors.nutrients.carbs }]}>
                  {generatedRecipe.nutrition.carbs}g
                </Text>
                <Text style={styles.nutritionLabel}>Gluc.</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={[styles.nutritionValue, { color: colors.nutrients.fats }]}>
                  {generatedRecipe.nutrition.fats}g
                </Text>
                <Text style={styles.nutritionLabel}>Lip.</Text>
              </View>
            </View>

            {/* Meta */}
            <View style={styles.metaRow}>
              <Badge size="sm">{generatedRecipe.prepTime} min</Badge>
              <Badge size="sm">{generatedRecipe.servings} portions</Badge>
            </View>

            {/* Ingredients */}
            <Text style={styles.subTitle}>Ingredients</Text>
            {generatedRecipe.ingredients.map((ing, index) => (
              <View key={index} style={styles.ingredientRow}>
                <Text style={styles.ingredientName}>{ing.name}</Text>
                <Text style={styles.ingredientAmount}>{ing.amount}</Text>
              </View>
            ))}

            {/* Instructions */}
            <Text style={styles.subTitle}>Instructions</Text>
            {generatedRecipe.instructions.map((step, index) => (
              <View key={index} style={styles.instructionRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.instructionText}>{step}</Text>
              </View>
            ))}
          </Card>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <Button
              variant="outline"
              size="lg"
              onPress={handleRegenerate}
              style={styles.actionButton}
            >
              <Sparkles size={18} color={colors.accent.primary} />
              <Text style={styles.outlineButtonText}>Regenerer</Text>
            </Button>
            <Button
              variant="primary"
              size="lg"
              onPress={handleConfirm}
              style={styles.actionButton}
            >
              <ChefHat size={18} color="#FFFFFF" />
              <Text style={styles.buttonText}>Utiliser</Text>
            </Button>
          </View>
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    padding: spacing.default,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  sectionTitle: {
    ...typography.smallMedium,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickPrompts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  quickPromptButton: {
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
  quickPromptText: {
    ...typography.small,
    color: colors.text.secondary,
  },
  customInput: {
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: spacing.md,
    minHeight: 80,
    marginBottom: spacing.md,
  },
  constraintsInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  generateButton: {
    marginBottom: spacing.md,
  },
  buttonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    marginLeft: spacing.sm,
  },
  outlineButtonText: {
    ...typography.bodyMedium,
    color: colors.accent.primary,
    marginLeft: spacing.sm,
  },
  errorContainer: {
    backgroundColor: `${colors.error}15`,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: {
    ...typography.small,
    color: colors.error,
    textAlign: 'center',
  },
  recipeCard: {
    marginBottom: spacing.md,
  },
  recipeTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  recipeDescription: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.light,
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
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  subTitle: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  ingredientName: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },
  ingredientAmount: {
    ...typography.body,
    color: colors.text.tertiary,
  },
  instructionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.accent.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    ...typography.small,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  instructionText: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  actionButton: {
    flex: 1,
  },
})
