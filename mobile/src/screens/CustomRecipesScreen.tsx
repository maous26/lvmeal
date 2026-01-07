/**
 * CustomRecipesScreen - Liste des recettes personnalisees
 *
 * Affiche toutes les recettes creees par l'utilisateur
 * Permet de les consulter, modifier, supprimer et favoriser
 * Permet d'ajouter une recette comme repas
 */

import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import {
  ArrowLeft,
  Plus,
  Heart,
  Clock,
  Users,
  Trash2,
  ChefHat,
  UtensilsCrossed,
  X,
  Check,
  Minus,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { useTheme } from '../contexts/ThemeContext'
import { useCustomRecipesStore, type CustomRecipe } from '../stores/custom-recipes-store'
import { useMealsStore } from '../stores/meals-store'
import { useToast } from '../components/ui/Toast'
import { spacing, radius, typography, fonts } from '../constants/theme'
import { Button } from '../components/ui'
import type { MealType, NutritionInfo } from '../types'

export default function CustomRecipesScreen() {
  const navigation = useNavigation()
  const { colors } = useTheme()
  const toast = useToast()
  const { recipes, toggleFavorite, deleteRecipe, incrementUsage } = useCustomRecipesStore()
  const { addMeal } = useMealsStore()
  const [filter, setFilter] = useState<'all' | 'favorites'>('all')

  // Modal state for adding as meal
  const [selectedRecipe, setSelectedRecipe] = useState<CustomRecipe | null>(null)
  const [portions, setPortions] = useState(1)
  const [showMealModal, setShowMealModal] = useState(false)

  const filteredRecipes = filter === 'favorites'
    ? recipes.filter(r => r.isFavorite)
    : recipes

  // Calculate nutrition for selected portions
  const getPortionNutrition = useCallback((recipe: CustomRecipe, numPortions: number): NutritionInfo => {
    return {
      calories: Math.round(recipe.nutritionPerServing.calories * numPortions),
      proteins: Math.round(recipe.nutritionPerServing.proteins * numPortions * 10) / 10,
      carbs: Math.round(recipe.nutritionPerServing.carbs * numPortions * 10) / 10,
      fats: Math.round(recipe.nutritionPerServing.fats * numPortions * 10) / 10,
      fiber: recipe.nutritionPerServing.fiber ? Math.round(recipe.nutritionPerServing.fiber * numPortions * 10) / 10 : undefined,
    }
  }, [])

  const handleSelectRecipe = useCallback((recipe: CustomRecipe) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedRecipe(recipe)
    setPortions(1)
    setShowMealModal(true)
  }, [])

  const handleAddAsMeal = useCallback(() => {
    if (!selectedRecipe) return

    const nutrition = getPortionNutrition(selectedRecipe, portions)

    // Determine meal type based on current hour
    const hour = new Date().getHours()
    let mealType: MealType = 'snack'
    if (hour >= 5 && hour < 11) mealType = 'breakfast'
    else if (hour >= 11 && hour < 15) mealType = 'lunch'
    else if (hour >= 18 && hour < 22) mealType = 'dinner'

    // Create MealItem for the store
    const mealItem = {
      id: `meal-item-${Date.now()}`,
      food: {
        id: selectedRecipe.id,
        name: selectedRecipe.title,
        nutrition: nutrition,
        servingSize: 1,
        servingUnit: 'portion',
        source: 'recipe' as const,
        isRecipe: true,
        recipeId: selectedRecipe.id,
      },
      quantity: portions,
    }

    addMeal(mealType, [mealItem])

    incrementUsage(selectedRecipe.id)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    toast.success(`${selectedRecipe.title} ajoute !`)
    setShowMealModal(false)
    setSelectedRecipe(null)
    navigation.goBack()
  }, [selectedRecipe, portions, getPortionNutrition, addMeal, incrementUsage, toast, navigation])

  const handleDelete = useCallback((recipe: CustomRecipe) => {
    Alert.alert(
      'Supprimer la recette',
      `Veux-tu vraiment supprimer "${recipe.title}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
            deleteRecipe(recipe.id)
          },
        },
      ]
    )
  }, [deleteRecipe])

  const handleToggleFavorite = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    toggleFavorite(id)
  }, [toggleFavorite])

  const renderRecipeCard = useCallback(
    ({ item, index }: { item: CustomRecipe; index: number }) => (
      <Animated.View
        entering={FadeInDown.delay(index * 50).springify()}
        style={[styles.recipeCard, { backgroundColor: colors.bg.elevated }]}
      >
        <TouchableOpacity
          style={styles.cardContent}
          activeOpacity={0.7}
          onPress={() => handleSelectRecipe(item)}
        >
          {/* Recipe Info */}
          <View style={styles.recipeInfo}>
            <Text style={[styles.recipeTitle, { color: colors.text.primary }]} numberOfLines={2}>
              {item.title}
            </Text>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Users size={14} color={colors.text.tertiary} />
                <Text style={[styles.metaText, { color: colors.text.tertiary }]}>
                  {item.servings} {item.servings > 1 ? 'portions' : 'portion'}
                </Text>
              </View>

              {item.prepTime && (
                <View style={styles.metaItem}>
                  <Clock size={14} color={colors.text.tertiary} />
                  <Text style={[styles.metaText, { color: colors.text.tertiary }]}>
                    {item.prepTime} min
                  </Text>
                </View>
              )}
            </View>

            {/* Nutrition per serving */}
            <View style={styles.nutritionRow}>
              <View style={[styles.nutriBadge, { backgroundColor: colors.warning + '20' }]}>
                <Text style={[styles.nutriValue, { color: colors.warning }]}>
                  {item.nutritionPerServing.calories}
                </Text>
                <Text style={[styles.nutriLabel, { color: colors.text.tertiary }]}>kcal</Text>
              </View>
              <View style={[styles.nutriBadge, { backgroundColor: colors.success + '20' }]}>
                <Text style={[styles.nutriValue, { color: colors.success }]}>
                  {item.nutritionPerServing.proteins}g
                </Text>
                <Text style={[styles.nutriLabel, { color: colors.text.tertiary }]}>prot</Text>
              </View>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => handleToggleFavorite(item.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Heart
                size={22}
                color={item.isFavorite ? colors.error : colors.text.muted}
                fill={item.isFavorite ? colors.error : 'transparent'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleDelete(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Trash2 size={20} color={colors.text.muted} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Animated.View>
    ),
    [colors, handleToggleFavorite, handleDelete, handleSelectRecipe]
  )

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border.light }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Mes Recettes</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('AddCustomRecipe' as never)}
          style={[styles.addHeaderButton, { backgroundColor: colors.accent.primary }]}
        >
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[
            styles.filterTab,
            filter === 'all' && { backgroundColor: colors.accent.light, borderColor: colors.accent.primary },
            { borderColor: colors.border.default },
          ]}
          onPress={() => setFilter('all')}
        >
          <Text style={[
            styles.filterText,
            { color: filter === 'all' ? colors.accent.primary : colors.text.secondary }
          ]}>
            Toutes ({recipes.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterTab,
            filter === 'favorites' && { backgroundColor: colors.error + '15', borderColor: colors.error },
            { borderColor: colors.border.default },
          ]}
          onPress={() => setFilter('favorites')}
        >
          <Heart size={14} color={filter === 'favorites' ? colors.error : colors.text.secondary} />
          <Text style={[
            styles.filterText,
            { color: filter === 'favorites' ? colors.error : colors.text.secondary }
          ]}>
            Favoris ({recipes.filter(r => r.isFavorite).length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Recipes list */}
      {filteredRecipes.length > 0 ? (
        <FlatList
          data={filteredRecipes}
          keyExtractor={(item) => item.id}
          renderItem={renderRecipeCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyState}>
          <ChefHat size={48} color={colors.text.muted} />
          <Text style={[styles.emptyTitle, { color: colors.text.secondary }]}>
            {filter === 'favorites'
              ? 'Pas encore de favoris'
              : 'Aucune recette'}
          </Text>
          <Text style={[styles.emptyText, { color: colors.text.tertiary }]}>
            {filter === 'favorites'
              ? 'Ajoute des recettes a tes favoris en cliquant sur le coeur'
              : 'Cree ta premiere recette pour commencer'}
          </Text>

          {filter === 'all' && (
            <TouchableOpacity
              style={[styles.emptyButton, { backgroundColor: colors.accent.primary }]}
              onPress={() => navigation.navigate('AddCustomRecipe' as never)}
            >
              <Plus size={18} color="#fff" />
              <Text style={styles.emptyButtonText}>Creer une recette</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Add as Meal Modal */}
      <Modal
        visible={showMealModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowMealModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.bg.primary }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border.light }]}>
              <TouchableOpacity onPress={() => setShowMealModal(false)}>
                <X size={24} color={colors.text.primary} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text.primary }]}>
                Ajouter comme repas
              </Text>
              <View style={{ width: 24 }} />
            </View>

            {selectedRecipe && (
              <View style={styles.modalBody}>
                {/* Recipe info */}
                <View style={[styles.selectedRecipeCard, { backgroundColor: colors.bg.elevated }]}>
                  <UtensilsCrossed size={24} color={colors.accent.primary} />
                  <View style={styles.selectedRecipeInfo}>
                    <Text style={[styles.selectedRecipeName, { color: colors.text.primary }]}>
                      {selectedRecipe.title}
                    </Text>
                    <Text style={[styles.selectedRecipeMeta, { color: colors.text.tertiary }]}>
                      {selectedRecipe.nutritionPerServing.calories} kcal par portion
                    </Text>
                  </View>
                </View>

                {/* Portions selector */}
                <View style={styles.portionSection}>
                  <Text style={[styles.portionLabel, { color: colors.text.secondary }]}>
                    Combien de portions ?
                  </Text>
                  <View style={styles.portionControls}>
                    <TouchableOpacity
                      style={[styles.portionButton, { backgroundColor: colors.bg.tertiary }]}
                      onPress={() => setPortions(Math.max(0.5, portions - 0.5))}
                    >
                      <Minus size={20} color={colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={[styles.portionValue, { color: colors.text.primary }]}>
                      {portions}
                    </Text>
                    <TouchableOpacity
                      style={[styles.portionButton, { backgroundColor: colors.bg.tertiary }]}
                      onPress={() => setPortions(portions + 0.5)}
                    >
                      <Plus size={20} color={colors.text.primary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Nutrition summary */}
                <View style={[styles.nutritionSummary, { backgroundColor: colors.bg.elevated }]}>
                  <Text style={[styles.nutritionTitle, { color: colors.text.secondary }]}>
                    Total pour {portions} portion{portions > 1 ? 's' : ''}
                  </Text>
                  <View style={styles.nutritionGrid}>
                    <View style={styles.nutritionItem}>
                      <Text style={[styles.nutritionValue, { color: colors.warning }]}>
                        {getPortionNutrition(selectedRecipe, portions).calories}
                      </Text>
                      <Text style={[styles.nutritionUnit, { color: colors.text.tertiary }]}>kcal</Text>
                    </View>
                    <View style={styles.nutritionItem}>
                      <Text style={[styles.nutritionValue, { color: colors.success }]}>
                        {getPortionNutrition(selectedRecipe, portions).proteins}g
                      </Text>
                      <Text style={[styles.nutritionUnit, { color: colors.text.tertiary }]}>prot</Text>
                    </View>
                    <View style={styles.nutritionItem}>
                      <Text style={[styles.nutritionValue, { color: colors.accent.primary }]}>
                        {getPortionNutrition(selectedRecipe, portions).carbs}g
                      </Text>
                      <Text style={[styles.nutritionUnit, { color: colors.text.tertiary }]}>gluc</Text>
                    </View>
                    <View style={styles.nutritionItem}>
                      <Text style={[styles.nutritionValue, { color: colors.secondary.primary }]}>
                        {getPortionNutrition(selectedRecipe, portions).fats}g
                      </Text>
                      <Text style={[styles.nutritionUnit, { color: colors.text.tertiary }]}>lip</Text>
                    </View>
                  </View>
                </View>

                {/* Add button */}
                <Button
                  onPress={handleAddAsMeal}
                  fullWidth
                  icon={<Check size={20} color="#fff" />}
                >
                  Ajouter au journal
                </Button>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h3,
    fontFamily: fonts.sans.semibold,
  },
  addHeaderButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  filterText: {
    ...typography.smallMedium,
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  recipeCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  cardContent: {
    flexDirection: 'row',
    padding: spacing.md,
  },
  recipeInfo: {
    flex: 1,
  },
  recipeTitle: {
    ...typography.bodyMedium,
    fontFamily: fonts.sans.semibold,
    marginBottom: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    ...typography.caption,
  },
  nutritionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  nutriBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  nutriValue: {
    ...typography.smallMedium,
  },
  nutriLabel: {
    ...typography.caption,
  },
  actions: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: spacing.md,
    gap: spacing.md,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyTitle: {
    ...typography.bodyMedium,
    fontFamily: fonts.sans.semibold,
  },
  emptyText: {
    ...typography.body,
    textAlign: 'center',
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    marginTop: spacing.md,
  },
  emptyButtonText: {
    ...typography.buttonSm,
    color: '#fff',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    ...typography.bodyMedium,
    fontFamily: fonts.sans.semibold,
  },
  modalBody: {
    padding: spacing.md,
    gap: spacing.lg,
  },
  selectedRecipeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.md,
  },
  selectedRecipeInfo: {
    flex: 1,
  },
  selectedRecipeName: {
    ...typography.bodyMedium,
    fontFamily: fonts.sans.semibold,
    marginBottom: 2,
  },
  selectedRecipeMeta: {
    ...typography.caption,
  },
  portionSection: {
    alignItems: 'center',
    gap: spacing.md,
  },
  portionLabel: {
    ...typography.body,
  },
  portionControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  portionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portionValue: {
    ...typography.h2,
    fontFamily: fonts.sans.bold,
    minWidth: 50,
    textAlign: 'center',
  },
  nutritionSummary: {
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  nutritionTitle: {
    ...typography.caption,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  nutritionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  nutritionItem: {
    alignItems: 'center',
  },
  nutritionValue: {
    ...typography.bodyMedium,
    fontFamily: fonts.sans.bold,
  },
  nutritionUnit: {
    ...typography.caption,
  },
})
