/**
 * AddCustomRecipeScreen - Ecran de creation de recette personnalisee
 *
 * Permet a l'utilisateur de creer ses propres recettes avec:
 * - Titre et description
 * - Nombre de portions
 * - Liste d'ingredients avec recherche CIQUAL
 * - Calcul automatique des macros
 * - Sauvegarde et favoris
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
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
  Modal,
  FlatList,
  Keyboard,
} from 'react-native'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import {
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  Search,
  Check,
  ChefHat,
  Users,
  Clock,
  X,
  Heart,
  Sparkles,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import { Card, Button } from '../components/ui'
import { useToast } from '../components/ui/Toast'
import { colors, fonts, spacing, typography, radius, shadows } from '../constants/theme'
import { useTheme } from '../contexts/ThemeContext'
import { useCustomRecipesStore, type CustomRecipeIngredient, type CustomRecipe } from '../stores/custom-recipes-store'
import { searchFoods, type FoodItemWithConversion } from '../services/food-search'
import type { FoodItem, NutritionInfo } from '../types'
import type { RootStackParamList } from '../navigation/RootNavigator'

// ============= TYPES =============

interface IngredientDraft {
  id: string
  name: string
  quantity: number
  unit: 'g' | 'ml' | 'unit'
  nutritionPer100g: NutritionInfo
  source: 'ciqual' | 'openfoodfacts' | 'manual'
  sourceId?: string
}

// ============= COMPONENT =============

export default function AddCustomRecipeScreen() {
  const navigation = useNavigation()
  const { colors: themeColors } = useTheme()
  const toast = useToast()
  const { addRecipe } = useCustomRecipesStore()

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [servings, setServings] = useState(2)
  const [prepTime, setPrepTime] = useState<number | undefined>(undefined)
  const [cookTime, setCookTime] = useState<number | undefined>(undefined)
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([])
  const [instructions, setInstructions] = useState<string[]>([])
  const [category, setCategory] = useState<string | undefined>(undefined)

  // Search state
  const [showIngredientSearch, setShowIngredientSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FoodItemWithConversion[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const searchInputRef = useRef<TextInput>(null)

  // Saving state
  const [isSaving, setIsSaving] = useState(false)

  // ============= COMPUTED =============

  const totalNutrition = React.useMemo(() => {
    const total: NutritionInfo = {
      calories: 0,
      proteins: 0,
      carbs: 0,
      fats: 0,
    }

    for (const ing of ingredients) {
      const factor = ing.quantity / 100
      total.calories += Math.round((ing.nutritionPer100g.calories || 0) * factor)
      total.proteins += Math.round((ing.nutritionPer100g.proteins || 0) * factor * 10) / 10
      total.carbs += Math.round((ing.nutritionPer100g.carbs || 0) * factor * 10) / 10
      total.fats += Math.round((ing.nutritionPer100g.fats || 0) * factor * 10) / 10
    }

    return total
  }, [ingredients])

  const nutritionPerServing = React.useMemo(() => {
    if (servings <= 0) return totalNutrition
    return {
      calories: Math.round(totalNutrition.calories / servings),
      proteins: Math.round((totalNutrition.proteins / servings) * 10) / 10,
      carbs: Math.round((totalNutrition.carbs / servings) * 10) / 10,
      fats: Math.round((totalNutrition.fats / servings) * 10) / 10,
    }
  }, [totalNutrition, servings])

  const isValid = title.trim().length > 0 && ingredients.length > 0 && servings > 0

  // ============= HANDLERS =============

  const handleSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const result = await searchFoods({
        query,
        limit: 15,
        source: 'generic', // CIQUAL only for base ingredients
      })
      setSearchResults(result.products)
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, handleSearch])

  const handleAddIngredient = useCallback((food: FoodItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    const newIngredient: IngredientDraft = {
      id: `ing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: food.name,
      quantity: 100, // Default 100g
      unit: food.servingUnit === 'ml' ? 'ml' : 'g',
      nutritionPer100g: food.nutrition,
      source: food.source as 'ciqual' | 'openfoodfacts',
      sourceId: food.id,
    }

    setIngredients((prev) => [...prev, newIngredient])
    setShowIngredientSearch(false)
    setSearchQuery('')
    setSearchResults([])
  }, [])

  const handleUpdateIngredientQuantity = useCallback((id: string, quantity: number) => {
    if (quantity < 0) return
    setIngredients((prev) =>
      prev.map((ing) => (ing.id === id ? { ...ing, quantity } : ing))
    )
  }, [])

  const handleRemoveIngredient = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setIngredients((prev) => prev.filter((ing) => ing.id !== id))
  }, [])

  const handleSave = useCallback(async () => {
    if (!isValid) {
      toast.error('Ajoute un titre et au moins un ingredient')
      return
    }

    setIsSaving(true)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    try {
      const recipe = addRecipe({
        title: title.trim(),
        description: description.trim() || undefined,
        servings,
        ingredients: ingredients.map((ing) => ({
          id: ing.id,
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          nutritionPer100g: ing.nutritionPer100g,
          source: ing.source,
          sourceId: ing.sourceId,
        })),
        instructions: instructions.filter((i) => i.trim()),
        prepTime,
        cookTime,
        category,
      })

      toast.success(`"${recipe.title}" ajoutee a tes recettes !`)
      navigation.goBack()
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setIsSaving(false)
    }
  }, [isValid, title, description, servings, ingredients, instructions, prepTime, cookTime, category, addRecipe, toast, navigation])

  // ============= RENDER =============

  const renderIngredientItem = useCallback(
    ({ item }: { item: IngredientDraft }) => {
      const ingredientCalories = Math.round((item.nutritionPer100g.calories * item.quantity) / 100)
      const ingredientProteins = Math.round((item.nutritionPer100g.proteins * item.quantity) / 100 * 10) / 10

      return (
        <Animated.View
          entering={SlideInRight.duration(200)}
          style={[styles.ingredientCard, { backgroundColor: themeColors.bg.elevated }]}
        >
          <View style={styles.ingredientHeader}>
            <Text style={[styles.ingredientName, { color: themeColors.text.primary }]} numberOfLines={2}>
              {item.name}
            </Text>
            <TouchableOpacity
              onPress={() => handleRemoveIngredient(item.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Trash2 size={18} color={themeColors.text.tertiary} />
            </TouchableOpacity>
          </View>

          <View style={styles.ingredientQuantityRow}>
            <View style={styles.quantityControls}>
              <TouchableOpacity
                style={[styles.quantityButton, { backgroundColor: themeColors.bg.tertiary }]}
                onPress={() => handleUpdateIngredientQuantity(item.id, Math.max(0, item.quantity - 10))}
              >
                <Minus size={16} color={themeColors.text.secondary} />
              </TouchableOpacity>

              <TextInput
                style={[styles.quantityInput, { color: themeColors.text.primary, borderColor: themeColors.border.light }]}
                value={String(item.quantity)}
                onChangeText={(text) => {
                  const num = parseInt(text) || 0
                  handleUpdateIngredientQuantity(item.id, num)
                }}
                keyboardType="number-pad"
              />

              <Text style={[styles.quantityUnit, { color: themeColors.text.secondary }]}>{item.unit}</Text>

              <TouchableOpacity
                style={[styles.quantityButton, { backgroundColor: themeColors.bg.tertiary }]}
                onPress={() => handleUpdateIngredientQuantity(item.id, item.quantity + 10)}
              >
                <Plus size={16} color={themeColors.text.secondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.ingredientNutrition}>
              <Text style={[styles.ingredientCalories, { color: themeColors.warning }]}>
                {ingredientCalories} kcal
              </Text>
              <Text style={[styles.ingredientMacro, { color: themeColors.text.tertiary }]}>
                {ingredientProteins}g prot
              </Text>
            </View>
          </View>
        </Animated.View>
      )
    },
    [themeColors, handleRemoveIngredient, handleUpdateIngredientQuantity]
  )

  const renderSearchResult = useCallback(
    ({ item }: { item: FoodItemWithConversion }) => (
      <TouchableOpacity
        style={[styles.searchResultItem, { borderBottomColor: themeColors.border.light }]}
        onPress={() => handleAddIngredient(item)}
      >
        <View style={styles.searchResultContent}>
          <Text style={[styles.searchResultName, { color: themeColors.text.primary }]} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={[styles.searchResultInfo, { color: themeColors.text.tertiary }]}>
            {item.nutrition.calories} kcal / 100{item.servingUnit || 'g'}
          </Text>
        </View>
        <Plus size={20} color={themeColors.accent.primary} />
      </TouchableOpacity>
    ),
    [themeColors, handleAddIngredient]
  )

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.bg.primary }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: themeColors.border.light }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ArrowLeft size={24} color={themeColors.text.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: themeColors.text.primary }]}>Nouvelle Recette</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Title & Description */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.text.secondary }]}>
              Informations
            </Text>

            <TextInput
              style={[styles.titleInput, { color: themeColors.text.primary, borderColor: themeColors.border.light, backgroundColor: themeColors.bg.elevated }]}
              placeholder="Nom de la recette"
              placeholderTextColor={themeColors.text.muted}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />

            <TextInput
              style={[styles.descriptionInput, { color: themeColors.text.primary, borderColor: themeColors.border.light, backgroundColor: themeColors.bg.elevated }]}
              placeholder="Description (optionnel)"
              placeholderTextColor={themeColors.text.muted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={2}
              maxLength={200}
            />
          </View>

          {/* Servings & Time */}
          <View style={styles.section}>
            <View style={styles.metaRow}>
              {/* Servings */}
              <View style={[styles.metaCard, { backgroundColor: themeColors.bg.elevated }]}>
                <Users size={18} color={themeColors.accent.primary} />
                <Text style={[styles.metaLabel, { color: themeColors.text.secondary }]}>Portions</Text>
                <View style={styles.servingsControls}>
                  <TouchableOpacity
                    style={[styles.smallButton, { backgroundColor: themeColors.bg.tertiary }]}
                    onPress={() => setServings(Math.max(1, servings - 1))}
                  >
                    <Minus size={14} color={themeColors.text.secondary} />
                  </TouchableOpacity>
                  <Text style={[styles.servingsValue, { color: themeColors.text.primary }]}>{servings}</Text>
                  <TouchableOpacity
                    style={[styles.smallButton, { backgroundColor: themeColors.bg.tertiary }]}
                    onPress={() => setServings(servings + 1)}
                  >
                    <Plus size={14} color={themeColors.text.secondary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Prep Time */}
              <View style={[styles.metaCard, { backgroundColor: themeColors.bg.elevated }]}>
                <Clock size={18} color={themeColors.warning} />
                <Text style={[styles.metaLabel, { color: themeColors.text.secondary }]}>Prep (min)</Text>
                <TextInput
                  style={[styles.timeInput, { color: themeColors.text.primary, borderColor: themeColors.border.light }]}
                  placeholder="-"
                  placeholderTextColor={themeColors.text.muted}
                  value={prepTime ? String(prepTime) : ''}
                  onChangeText={(t) => setPrepTime(parseInt(t) || undefined)}
                  keyboardType="number-pad"
                />
              </View>
            </View>
          </View>

          {/* Ingredients */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: themeColors.text.secondary }]}>
                Ingredients ({ingredients.length})
              </Text>
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: themeColors.accent.light }]}
                onPress={() => {
                  setShowIngredientSearch(true)
                  setTimeout(() => searchInputRef.current?.focus(), 100)
                }}
              >
                <Plus size={18} color={themeColors.accent.primary} />
                <Text style={[styles.addButtonText, { color: themeColors.accent.primary }]}>Ajouter</Text>
              </TouchableOpacity>
            </View>

            {ingredients.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: themeColors.bg.elevated }]}>
                <ChefHat size={32} color={themeColors.text.muted} />
                <Text style={[styles.emptyText, { color: themeColors.text.tertiary }]}>
                  Ajoute des ingredients pour commencer
                </Text>
              </View>
            ) : (
              <View style={styles.ingredientsList}>
                {ingredients.map((item) => (
                  <View key={item.id}>
                    {renderIngredientItem({ item })}
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Nutrition Summary */}
          {ingredients.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: themeColors.text.secondary }]}>
                Nutrition (par portion)
              </Text>
              <View style={[styles.nutritionSummary, { backgroundColor: themeColors.bg.elevated }]}>
                <View style={styles.nutritionItem}>
                  <Text style={[styles.nutritionValue, { color: themeColors.warning }]}>
                    {nutritionPerServing.calories}
                  </Text>
                  <Text style={[styles.nutritionLabel, { color: themeColors.text.tertiary }]}>kcal</Text>
                </View>
                <View style={styles.nutritionDivider} />
                <View style={styles.nutritionItem}>
                  <Text style={[styles.nutritionValue, { color: themeColors.success }]}>
                    {nutritionPerServing.proteins}g
                  </Text>
                  <Text style={[styles.nutritionLabel, { color: themeColors.text.tertiary }]}>Prot</Text>
                </View>
                <View style={styles.nutritionDivider} />
                <View style={styles.nutritionItem}>
                  <Text style={[styles.nutritionValue, { color: themeColors.accent.primary }]}>
                    {nutritionPerServing.carbs}g
                  </Text>
                  <Text style={[styles.nutritionLabel, { color: themeColors.text.tertiary }]}>Gluc</Text>
                </View>
                <View style={styles.nutritionDivider} />
                <View style={styles.nutritionItem}>
                  <Text style={[styles.nutritionValue, { color: themeColors.secondary.primary }]}>
                    {nutritionPerServing.fats}g
                  </Text>
                  <Text style={[styles.nutritionLabel, { color: themeColors.text.tertiary }]}>Lip</Text>
                </View>
              </View>

              <Text style={[styles.totalLabel, { color: themeColors.text.muted }]}>
                Total recette: {totalNutrition.calories} kcal
              </Text>
            </View>
          )}

          {/* Bottom spacing */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Save Button */}
        <View style={[styles.footer, { backgroundColor: themeColors.bg.primary, borderTopColor: themeColors.border.light }]}>
          <Button
            onPress={handleSave}
            disabled={!isValid || isSaving}
            style={styles.saveButton}
            icon={<Check size={20} color="#fff" />}
          >
            {isSaving ? 'Enregistrement...' : 'Enregistrer la recette'}
          </Button>
        </View>

        {/* Ingredient Search Modal */}
        <Modal
          visible={showIngredientSearch}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => {
            setShowIngredientSearch(false)
            setSearchQuery('')
            setSearchResults([])
          }}
        >
          <SafeAreaView style={[styles.modalContainer, { backgroundColor: themeColors.bg.primary }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: themeColors.border.light }]}>
              <TouchableOpacity
                onPress={() => {
                  setShowIngredientSearch(false)
                  setSearchQuery('')
                  setSearchResults([])
                }}
              >
                <X size={24} color={themeColors.text.primary} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: themeColors.text.primary }]}>
                Ajouter un ingredient
              </Text>
              <View style={{ width: 24 }} />
            </View>

            {/* Search Input */}
            <View style={[styles.searchContainer, { backgroundColor: themeColors.bg.elevated }]}>
              <Search size={20} color={themeColors.text.muted} />
              <TextInput
                ref={searchInputRef}
                style={[styles.searchInput, { color: themeColors.text.primary }]}
                placeholder="Rechercher un aliment..."
                placeholderTextColor={themeColors.text.muted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={18} color={themeColors.text.muted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Results */}
            {isSearching ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={themeColors.accent.primary} />
                <Text style={[styles.loadingText, { color: themeColors.text.tertiary }]}>
                  Recherche...
                </Text>
              </View>
            ) : searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                renderItem={renderSearchResult}
                contentContainerStyle={styles.searchResultsList}
                keyboardShouldPersistTaps="handled"
              />
            ) : searchQuery.length >= 2 ? (
              <View style={styles.emptySearchState}>
                <Text style={[styles.emptySearchText, { color: themeColors.text.tertiary }]}>
                  Aucun resultat pour "{searchQuery}"
                </Text>
              </View>
            ) : (
              <View style={styles.emptySearchState}>
                <Sparkles size={32} color={themeColors.text.muted} />
                <Text style={[styles.emptySearchText, { color: themeColors.text.tertiary }]}>
                  Tape le nom d'un aliment pour le rechercher
                </Text>
              </View>
            )}
          </SafeAreaView>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ============= STYLES =============

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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.smallMedium,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  titleInput: {
    ...typography.body,
    fontFamily: fonts.sans.semibold,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  descriptionInput: {
    ...typography.body,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  metaCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaLabel: {
    ...typography.caption,
  },
  servingsControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  smallButton: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  servingsValue: {
    ...typography.bodyMedium,
    minWidth: 24,
    textAlign: 'center',
  },
  timeInput: {
    ...typography.body,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    width: 60,
    textAlign: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  addButtonText: {
    ...typography.smallMedium,
  },
  emptyState: {
    padding: spacing.xl,
    borderRadius: radius.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    textAlign: 'center',
  },
  ingredientsList: {
    gap: spacing.sm,
  },
  ingredientCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  ingredientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  ingredientName: {
    ...typography.bodyMedium,
    flex: 1,
    marginRight: spacing.sm,
  },
  ingredientQuantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityInput: {
    ...typography.body,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    width: 60,
    textAlign: 'center',
  },
  quantityUnit: {
    ...typography.caption,
  },
  ingredientNutrition: {
    alignItems: 'flex-end',
  },
  ingredientCalories: {
    ...typography.smallMedium,
  },
  ingredientMacro: {
    ...typography.caption,
  },
  nutritionSummary: {
    flexDirection: 'row',
    padding: spacing.lg,
    borderRadius: radius.lg,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  nutritionItem: {
    alignItems: 'center',
  },
  nutritionValue: {
    ...typography.h3,
    fontFamily: fonts.sans.bold,
  },
  nutritionLabel: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  nutritionDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border.light,
  },
  totalLabel: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
  },
  saveButton: {
    width: '100%',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  modalTitle: {
    ...typography.bodyMedium,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    paddingVertical: spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
  },
  searchResultsList: {
    paddingHorizontal: spacing.md,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultName: {
    ...typography.body,
    marginBottom: spacing.xs,
  },
  searchResultInfo: {
    ...typography.caption,
  },
  emptySearchState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  emptySearchText: {
    ...typography.body,
    textAlign: 'center',
  },
})
