import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  FlatList,
  Dimensions,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import {
  ArrowLeft,
  Sparkles,
  Calendar,
  ChefHat,
  Clock,
  Users,
  Check,
  RefreshCw,
  ShoppingCart,
  ChevronRight,
  ChevronDown,
  Flame,
  Beef,
  Wheat,
  Droplets,
  PartyPopper,
  Trash2,
  Move,
  X,
  CheckCircle,
  Circle,
  Euro,
  Lightbulb,
  Database,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { Card, Button } from '../components/ui'
import { colors, spacing, typography, radius, shadows } from '../constants/theme'
import { useUserStore } from '../stores/user-store'
import { useGamificationStore } from '../stores/gamification-store'
import { useMealPlanStore, type PlannedMealItem, type ShoppingList } from '../stores/meal-plan-store'
import { mealPlanAgent } from '../services/meal-plan-agent'
import type { MealType, NutritionInfo, UserProfile } from '../types'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner']

const mealTypeLabels: Record<MealType, { label: string; icon: string }> = {
  breakfast: { label: 'Petit-dej', icon: '☀️' },
  lunch: { label: 'Dejeuner', icon: '🍽️' },
  snack: { label: 'Collation', icon: '🍎' },
  dinner: { label: 'Diner', icon: '🌙' },
}

// Plan duration type
type PlanDuration = 1 | 3 | 7
type RecipeComplexity = 'basique' | 'elabore' | 'mix'

export default function WeeklyPlanScreen() {
  const navigation = useNavigation()
  const route = useRoute()
  const { profile, nutritionGoals } = useUserStore()
  const { addXP } = useGamificationStore()

  // Get params from navigation
  const params = route.params as { duration?: PlanDuration; calorieReduction?: boolean; complexity?: RecipeComplexity } | undefined
  const planDuration: PlanDuration = params?.duration || 7
  const calorieReduction = params?.calorieReduction || false
  const complexity: RecipeComplexity = params?.complexity || 'mix'

  // Use meal plan store
  const {
    currentPlan,
    setPlan,
    clearPlan,
    deleteMeal,
    moveMeal,
    toggleMealValidation,
    setShoppingList,
    toggleShoppingItem,
    getMealsForDay,
    getDailyNutrition,
    getProgress,
    getValidatedMeals,
    savePlan,
    clearShoppingList,
  } = useMealPlanStore()

  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState({ day: 0, total: planDuration as number })
  const [selectedDay, setSelectedDay] = useState(0)
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Move modal state
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [mealToMove, setMealToMove] = useState<PlannedMealItem | null>(null)
  const [targetDay, setTargetDay] = useState(0)
  const [targetMealType, setTargetMealType] = useState<MealType>('breakfast')

  // Shopping list modal state
  const [showShoppingModal, setShowShoppingModal] = useState(false)
  const [isGeneratingList, setIsGeneratingList] = useState(false)

  // Initialize agent
  useEffect(() => {
    const apiKey = process.env.EXPO_PUBLIC_RAPIDAPI_KEY
    if (apiKey) {
      mealPlanAgent.init(apiKey)
    }
  }, [])

  // Get current day's meals
  const dayMeals = getMealsForDay(selectedDay)
  const dailyNutrition = getDailyNutrition(selectedDay)
  const progress = getProgress()

  // Calculate shopping list totals from checked items (reactive)
  const shoppingTotals = useMemo(() => {
    const items = currentPlan?.shoppingList?.items || []
    const checkedItems = items.filter(item => item.isChecked)
    return {
      total: checkedItems.reduce((sum, item) => sum + item.estimatedPrice, 0),
      count: checkedItems.length,
      totalItems: items.length,
    }
  }, [currentPlan?.shoppingList?.items])

  const generateWeekPlan = async () => {
    if (!nutritionGoals || !profile) {
      Alert.alert(
        'Profil incomplet',
        'Veuillez configurer vos objectifs nutritionnels dans les parametres.'
      )
      return
    }

    setIsGenerating(true)
    setGenerationProgress({ day: 0, total: planDuration })
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    // Apply -10% reduction if enabled (for Solde Plaisir)
    const baseCalories = nutritionGoals.calories
    const effectiveCalories = calorieReduction
      ? Math.round(baseCalories * 0.9)
      : baseCalories

    // Get cooking preferences from profile
    const cookingPrefs = profile.cookingPreferences
    const weekdayTime = cookingPrefs?.weekdayTime || 30
    const weekendTime = cookingPrefs?.weekendTime || 45

    try {
      const meals = await mealPlanAgent.generateWeekPlan(
        {
          dailyCalories: effectiveCalories,
          proteins: Math.round(nutritionGoals.proteins * (calorieReduction ? 0.9 : 1)),
          carbs: Math.round(nutritionGoals.carbs * (calorieReduction ? 0.9 : 1)),
          fats: Math.round(nutritionGoals.fats * (calorieReduction ? 0.9 : 1)),
          dietType: profile.dietType,
          allergies: profile.allergies,
          includeCheatMeal: planDuration === 7, // Only for 7-day plans
          cookingTimeWeekday: weekdayTime,
          cookingTimeWeekend: weekendTime,
          complexity, // Recipe complexity level
          cookingLevel: profile.cookingPreferences?.level || 'intermediate',
        },
        (day, total) => {
          setGenerationProgress({ day, total })
        },
        planDuration // Pass duration to agent
      )

      // Filter meals to only include days within plan duration
      const filteredMeals = meals.filter(m => m.dayIndex < planDuration)

      const newPlan = {
        id: `plan-${Date.now()}`,
        meals: filteredMeals,
        generatedAt: new Date().toISOString(),
        weekStart: getWeekStart(),
        duration: planDuration,
        calorieReduction,
        savedCalories: calorieReduction ? Math.round(baseCalories * 0.1 * planDuration) : 0,
      }

      setPlan(newPlan)
      addXP(planDuration === 7 ? 50 : planDuration === 3 ? 25 : 10, `Plan ${planDuration}j genere`)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (error) {
      console.error('Error generating plan:', error)
      Alert.alert('Erreur', 'Impossible de generer le plan. Reessayez.')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setIsGenerating(false)
    }
  }

  const getWeekStart = () => {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(now.setDate(diff)).toISOString().split('T')[0]
  }

  const handleDeleteMeal = (meal: PlannedMealItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert(
      'Supprimer ce repas',
      `Voulez-vous supprimer "${meal.name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            deleteMeal(meal.id)
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          },
        },
      ]
    )
  }

  const handleMoveMeal = (meal: PlannedMealItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setMealToMove(meal)
    setTargetDay(meal.dayIndex)
    setTargetMealType(meal.mealType)
    setShowMoveModal(true)
  }

  const confirmMoveMeal = () => {
    if (!mealToMove) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    moveMeal(mealToMove.id, targetDay, targetMealType)
    setShowMoveModal(false)
    setMealToMove(null)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }

  const handleToggleValidation = (mealId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    toggleMealValidation(mealId)
  }

  const handleGenerateShoppingList = async () => {
    const validatedMeals = getValidatedMeals()

    if (validatedMeals.length === 0) {
      Alert.alert(
        'Aucun repas valide',
        'Validez d\'abord les repas que vous souhaitez cuisiner en appuyant sur le bouton check de chaque repas.'
      )
      return
    }

    setIsGeneratingList(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      // Generate shopping list only from validated meals
      const shoppingList = await mealPlanAgent.generateShoppingListFromMeals(
        validatedMeals,
        2 // servings
      )

      setShoppingList(shoppingList)
      setShowShoppingModal(true)
      addXP(20, 'Liste de courses generee')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (error) {
      console.error('Shopping list error:', error)
      Alert.alert('Erreur', 'Impossible de generer la liste.')
    } finally {
      setIsGeneratingList(false)
    }
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    generateWeekPlan().finally(() => setRefreshing(false))
  }, [profile])

  const handleCancelPlan = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert(
      'Annuler le plan',
      'Voulez-vous vraiment annuler ce plan ? Toutes les modifications seront perdues.',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: () => {
            clearPlan()
            clearShoppingList()
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          },
        },
      ]
    )
  }

  const handleSavePlan = () => {
    const validatedMeals = getValidatedMeals()

    if (validatedMeals.length === 0) {
      Alert.alert(
        'Aucun repas valide',
        'Validez au moins un repas avant d\'enregistrer le plan.'
      )
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    savePlan()
    addXP(50, 'Plan de repas enregistre')
    Alert.alert(
      'Plan enregistre',
      `${validatedMeals.length} repas valides ont ete enregistres dans votre plan.`,
      [{ text: 'Super!' }]
    )
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }

  // ============= RENDER FUNCTIONS =============

  const renderMealCard = (meal: PlannedMealItem) => {
    const isExpanded = expandedMeal === meal.id
    const config = mealTypeLabels[meal.mealType]

    return (
      <Card
        key={meal.id}
        style={[
          styles.mealCard,
          meal.isValidated && styles.mealCardValidated,
          meal.isCheatMeal && styles.mealCardCheat,
        ]}
      >
        <View style={styles.mealHeader}>
          <View style={styles.mealTypeTag}>
            <Text style={styles.mealEmoji}>{config.icon}</Text>
            <Text style={styles.mealTypeLabel}>{config.label}</Text>
            {meal.isCheatMeal && (
              <View style={styles.cheatTag}>
                <PartyPopper size={12} color={colors.warning} />
              </View>
            )}
            {meal.source === 'gustar' && (
              <View style={styles.sourceTag}>
                <Database size={10} color={colors.accent.primary} />
              </View>
            )}
          </View>
          <View style={styles.mealActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleMoveMeal(meal)}
            >
              <Move size={16} color={colors.text.tertiary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDeleteMeal(meal)}
            >
              <Trash2 size={16} color={colors.error} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.validateButton,
                meal.isValidated && styles.validateButtonActive,
              ]}
              onPress={() => handleToggleValidation(meal.id)}
            >
              <Check size={16} color={meal.isValidated ? '#FFFFFF' : colors.text.tertiary} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setExpandedMeal(isExpanded ? null : meal.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.mealName}>{meal.name}</Text>
          {meal.description && (
            <Text style={styles.mealDescription} numberOfLines={isExpanded ? undefined : 2}>
              {meal.description}
            </Text>
          )}

          <View style={styles.mealMeta}>
            <View style={styles.mealMetaItem}>
              <Clock size={14} color={colors.text.tertiary} />
              <Text style={styles.mealMetaText}>{meal.prepTime} min</Text>
            </View>
            <View style={styles.mealMetaItem}>
              <Users size={14} color={colors.text.tertiary} />
              <Text style={styles.mealMetaText}>{meal.servings} pers.</Text>
            </View>
            <View style={styles.mealMetaItem}>
              <Flame size={14} color={colors.nutrients.calories} />
              <Text style={styles.mealMetaText}>{meal.nutrition.calories} kcal</Text>
            </View>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.mealDetails}>
            {/* Ingredients */}
            <Text style={styles.detailsTitle}>Ingredients</Text>
            {meal.ingredients?.map((ing, idx) => (
              <View key={idx} style={styles.ingredientRow}>
                <Text style={styles.ingredientItem}>
                  • {ing.amount ? `${ing.amount} ` : ''}{ing.name || 'Ingrédient'}
                </Text>
                {ing.calories ? (
                  <Text style={styles.ingredientCalories}>{ing.calories} kcal</Text>
                ) : null}
              </View>
            ))}

            {/* Instructions */}
            <Text style={[styles.detailsTitle, { marginTop: spacing.md }]}>
              Instructions
            </Text>
            {meal.instructions?.map((step, idx) => (
              <Text key={idx} style={styles.instructionItem}>
                {idx + 1}. {step}
              </Text>
            ))}

            {/* Nutrition breakdown */}
            <View style={styles.nutritionBreakdown}>
              <View style={styles.nutritionBreakdownItem}>
                <Text style={[styles.nutritionBreakdownValue, { color: colors.nutrients.proteins }]}>
                  {meal.nutrition.proteins}g
                </Text>
                <Text style={styles.nutritionBreakdownLabel}>Proteines</Text>
              </View>
              <View style={styles.nutritionBreakdownItem}>
                <Text style={[styles.nutritionBreakdownValue, { color: colors.nutrients.carbs }]}>
                  {meal.nutrition.carbs}g
                </Text>
                <Text style={styles.nutritionBreakdownLabel}>Glucides</Text>
              </View>
              <View style={styles.nutritionBreakdownItem}>
                <Text style={[styles.nutritionBreakdownValue, { color: colors.nutrients.fats }]}>
                  {meal.nutrition.fats}g
                </Text>
                <Text style={styles.nutritionBreakdownLabel}>Lipides</Text>
              </View>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={styles.expandButton}
          onPress={() => setExpandedMeal(isExpanded ? null : meal.id)}
        >
          <Text style={styles.expandButtonText}>
            {isExpanded ? 'Voir moins' : 'Voir la recette'}
          </Text>
          <ChevronDown
            size={16}
            color={colors.accent.primary}
            style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
          />
        </TouchableOpacity>
      </Card>
    )
  }

  const renderMoveModal = () => (
    <Modal
      visible={showMoveModal}
      animationType="slide"
      transparent
      onRequestClose={() => setShowMoveModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Deplacer le repas</Text>
            <TouchableOpacity onPress={() => setShowMoveModal(false)}>
              <X size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          {mealToMove && (
            <Text style={styles.moveMealName}>"{mealToMove.name}"</Text>
          )}

          {/* Day selector */}
          <Text style={styles.sectionLabel}>Jour</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.dayPicker}
          >
            {DAYS.map((day, index) => (
              <TouchableOpacity
                key={day}
                style={[
                  styles.dayOption,
                  targetDay === index && styles.dayOptionActive,
                ]}
                onPress={() => setTargetDay(index)}
              >
                <Text style={[
                  styles.dayOptionText,
                  targetDay === index && styles.dayOptionTextActive,
                ]}>
                  {day}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Meal type selector */}
          <Text style={styles.sectionLabel}>Moment</Text>
          <View style={styles.mealTypePicker}>
            {MEAL_TYPES.map((type) => {
              const config = mealTypeLabels[type]
              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.mealTypeOption,
                    targetMealType === type && styles.mealTypeOptionActive,
                  ]}
                  onPress={() => setTargetMealType(type)}
                >
                  <Text style={styles.mealTypeEmoji}>{config.icon}</Text>
                  <Text style={[
                    styles.mealTypeOptionText,
                    targetMealType === type && styles.mealTypeOptionTextActive,
                  ]}>
                    {config.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={confirmMoveMeal}
            style={styles.confirmButton}
          >
            <Move size={20} color="#FFFFFF" />
            <Text style={styles.confirmButtonText}>Deplacer</Text>
          </Button>
        </View>
      </View>
    </Modal>
  )

  const renderShoppingModal = () => {
    const shoppingList = currentPlan?.shoppingList

    return (
      <Modal
        visible={showShoppingModal}
        animationType="slide"
        onRequestClose={() => setShowShoppingModal(false)}
      >
        <SafeAreaView style={styles.shoppingModalContainer}>
          <View style={styles.shoppingHeader}>
            <TouchableOpacity onPress={() => setShowShoppingModal(false)}>
              <ArrowLeft size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.shoppingTitle}>Liste de courses</Text>
            <View style={{ width: 24 }} />
          </View>

          {shoppingList ? (
            <ScrollView style={styles.shoppingContent}>
              {/* Total - Dynamic based on checked items */}
              <Card style={styles.totalCard}>
                <View style={styles.totalRow}>
                  <View style={styles.totalInfo}>
                    <ShoppingCart size={24} color={colors.accent.primary} />
                    <View>
                      <Text style={styles.totalLabel}>Total selectionne</Text>
                      <Text style={styles.totalValue}>{shoppingTotals.total.toFixed(2)} €</Text>
                    </View>
                  </View>
                  <Text style={styles.itemCount}>
                    {shoppingTotals.count} / {shoppingTotals.totalItems} articles
                  </Text>
                </View>
              </Card>

              {/* Tips */}
              {shoppingList.tips.length > 0 && (
                <Card style={styles.tipsCard}>
                  <View style={styles.tipsHeader}>
                    <Lightbulb size={16} color={colors.warning} />
                    <Text style={styles.tipsTitle}>Astuces</Text>
                  </View>
                  {shoppingList.tips.map((tip, idx) => (
                    <Text key={idx} style={styles.tipText}>• {tip}</Text>
                  ))}
                </Card>
              )}

              {/* Categories */}
              {shoppingList.categories.map((category) => (
                <View key={category.name} style={styles.categorySection}>
                  <View style={styles.categoryHeader}>
                    <Text style={styles.categoryName}>{category.name}</Text>
                    <Text style={styles.categorySubtotal}>
                      {category.subtotal.toFixed(2)} €
                    </Text>
                  </View>
                  {category.items.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.shoppingItem}
                      onPress={() => toggleShoppingItem(item.id)}
                    >
                      {item.isChecked ? (
                        <CheckCircle size={20} color={colors.success} />
                      ) : (
                        <Circle size={20} color={colors.text.tertiary} />
                      )}
                      <View style={styles.itemInfo}>
                        <Text style={[
                          styles.itemName,
                          item.isChecked && styles.itemNameChecked,
                        ]}>
                          {item.name}
                        </Text>
                        <Text style={styles.itemQuantity}>{item.quantity}</Text>
                      </View>
                      <Text style={styles.itemPrice}>
                        {item.estimatedPrice > 0 ? `${item.estimatedPrice.toFixed(2)} €` : '-'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyShoppingList}>
              <ShoppingCart size={48} color={colors.text.muted} />
              <Text style={styles.emptyText}>Aucune liste generee</Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    )
  }

  // ============= MAIN RENDER =============

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Sparkles size={20} color={colors.warning} />
          <Text style={styles.headerText}>
            Plan {planDuration} jour{planDuration > 1 ? 's' : ''}
            {calorieReduction ? ' (-10%)' : ''}
          </Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Generate button / Progress */}
        {!currentPlan ? (
          <Card style={styles.generateCard}>
            <View style={styles.generateContent}>
              <View style={styles.aiIconContainer}>
                <Sparkles size={32} color={colors.warning} />
              </View>
              <Text style={styles.generateTitle}>
                Plan repas {planDuration}j{calorieReduction ? ' economie' : ''}
              </Text>
              <Text style={styles.generateDescription}>
                LymIA va generer un plan de {planDuration} jour{planDuration > 1 ? 's' : ''} adapte a tes objectifs.
                {calorieReduction ? '\n-10% de calories pour alimenter ton Solde Plaisir.' : ''}
                {'\n'}Recettes issues de Gustar.io, OFF et Ciqual.
              </Text>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onPress={generateWeekPlan}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.buttonText}>
                      Jour {generationProgress.day}/{generationProgress.total}...
                    </Text>
                  </>
                ) : (
                  <>
                    <Sparkles size={20} color="#FFFFFF" />
                    <Text style={styles.buttonText}>Generer mon plan</Text>
                  </>
                )}
              </Button>
              {isGenerating && (
                <View style={styles.generationProgressBar}>
                  <View
                    style={[
                      styles.generationProgressFill,
                      { width: `${(generationProgress.day / generationProgress.total) * 100}%` }
                    ]}
                  />
                </View>
              )}
            </View>
          </Card>
        ) : (
          <>
            {/* Progress card */}
            <Card style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressTitle}>Progression</Text>
                <Text style={styles.progressValue}>
                  {progress.validated}/{progress.total} repas valides
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[styles.progressFill, { width: `${progress.percentage}%` }]}
                />
              </View>
              {progress.percentage >= 50 && (
                <View style={styles.cheatMealBanner}>
                  <PartyPopper size={16} color={colors.warning} />
                  <Text style={styles.cheatMealText}>
                    Bravo ! Vous avez debloque un repas plaisir !
                  </Text>
                </View>
              )}
            </Card>

            {/* Day selector */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.daySelector}
              contentContainerStyle={styles.daySelectorContent}
            >
              {DAYS.map((day, index) => {
                const dayMealsCount = getMealsForDay(index).length
                const dayValidated = getMealsForDay(index).every((m) => m.isValidated)

                return (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayButton,
                      selectedDay === index && styles.dayButtonActive,
                      dayValidated && dayMealsCount > 0 && styles.dayButtonValidated,
                    ]}
                    onPress={() => setSelectedDay(index)}
                  >
                    <Text style={[
                      styles.dayButtonText,
                      selectedDay === index && styles.dayButtonTextActive,
                    ]}>
                      {day.substring(0, 3)}
                    </Text>
                    {dayValidated && dayMealsCount > 0 && (
                      <Check size={12} color={colors.success} style={styles.dayCheck} />
                    )}
                  </TouchableOpacity>
                )
              })}
            </ScrollView>

            {/* Daily nutrition summary */}
            <View style={styles.nutritionSummary}>
              <View style={styles.nutritionItem}>
                <Flame size={16} color={colors.nutrients.calories} />
                <Text style={styles.nutritionValue}>{Math.round(dailyNutrition.calories)}</Text>
                <Text style={styles.nutritionLabel}>kcal</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Beef size={16} color={colors.nutrients.proteins} />
                <Text style={styles.nutritionValue}>{Math.round(dailyNutrition.proteins)}g</Text>
                <Text style={styles.nutritionLabel}>Prot.</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Wheat size={16} color={colors.nutrients.carbs} />
                <Text style={styles.nutritionValue}>{Math.round(dailyNutrition.carbs)}g</Text>
                <Text style={styles.nutritionLabel}>Gluc.</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Droplets size={16} color={colors.nutrients.fats} />
                <Text style={styles.nutritionValue}>{Math.round(dailyNutrition.fats)}g</Text>
                <Text style={styles.nutritionLabel}>Lip.</Text>
              </View>
            </View>

            {/* Day meals */}
            <View style={styles.mealsSection}>
              <View style={styles.mealsSectionHeader}>
                <Text style={styles.mealsSectionTitle}>{DAYS[selectedDay]}</Text>
                <Text style={styles.mealCount}>
                  {dayMeals.length} repas
                </Text>
              </View>

              {dayMeals.length > 0 ? (
                dayMeals.map(renderMealCard)
              ) : (
                <Card style={styles.emptyDayCard}>
                  <Text style={styles.emptyDayText}>
                    Aucun repas prevu ce jour
                  </Text>
                </Card>
              )}
            </View>

            {/* Shopping list button */}
            <Button
              variant="outline"
              size="lg"
              fullWidth
              style={styles.shoppingButton}
              onPress={handleGenerateShoppingList}
              disabled={isGeneratingList}
            >
              {isGeneratingList ? (
                <>
                  <ActivityIndicator size="small" color={colors.accent.primary} />
                  <Text style={styles.shoppingButtonText}>Generation...</Text>
                </>
              ) : (
                <>
                  <ShoppingCart size={20} color={colors.accent.primary} />
                  <Text style={styles.shoppingButtonText}>
                    {currentPlan.shoppingList ? 'Voir la liste de courses' : 'Generer la liste de courses'}
                  </Text>
                </>
              )}
            </Button>

            {currentPlan.shoppingList && (
              <TouchableOpacity
                style={styles.viewListButton}
                onPress={() => setShowShoppingModal(true)}
              >
                <Euro size={16} color={colors.success} />
                <Text style={styles.viewListText}>
                  Total: {shoppingTotals.total.toFixed(2)} € ({shoppingTotals.count} articles)
                </Text>
                <ChevronRight size={16} color={colors.accent.primary} />
              </TouchableOpacity>
            )}

            {/* Cancel and Save buttons */}
            <View style={styles.actionButtonsContainer}>
              <Button
                variant="outline"
                size="lg"
                style={styles.cancelButton}
                onPress={handleCancelPlan}
              >
                <X size={20} color={colors.error} />
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </Button>

              <Button
                variant="primary"
                size="lg"
                style={styles.saveButton}
                onPress={handleSavePlan}
              >
                <Check size={20} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>Enregistrer</Text>
              </Button>
            </View>
          </>
        )}
      </ScrollView>

      {/* Modals */}
      {renderMoveModal()}
      {renderShoppingModal()}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
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
  headerText: {
    ...typography.h4,
    color: colors.text.primary,
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.default,
    paddingBottom: spacing['3xl'],
  },
  generateCard: {
    marginBottom: spacing.xl,
  },
  generateContent: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  aiIconContainer: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: `${colors.warning}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  generateTitle: {
    ...typography.h3,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  generateDescription: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  buttonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    marginLeft: spacing.sm,
  },
  generationProgressBar: {
    height: 4,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.full,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  generationProgressFill: {
    height: '100%',
    backgroundColor: colors.warning,
    borderRadius: radius.full,
  },
  progressCard: {
    marginBottom: spacing.lg,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressTitle: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  progressValue: {
    ...typography.small,
    color: colors.text.secondary,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: radius.full,
  },
  cheatMealBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: `${colors.warning}15`,
    borderRadius: radius.md,
  },
  cheatMealText: {
    ...typography.small,
    color: colors.warning,
    flex: 1,
  },
  daySelector: {
    marginBottom: spacing.md,
    marginHorizontal: -spacing.default,
  },
  daySelectorContent: {
    paddingHorizontal: spacing.default,
    gap: spacing.sm,
  },
  dayButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dayButtonActive: {
    backgroundColor: colors.accent.primary,
  },
  dayButtonValidated: {
    borderWidth: 2,
    borderColor: colors.success,
  },
  dayButtonText: {
    ...typography.smallMedium,
    color: colors.text.secondary,
  },
  dayButtonTextActive: {
    color: '#FFFFFF',
  },
  dayCheck: {
    marginLeft: 2,
  },
  nutritionSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.bg.secondary,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
  },
  nutritionItem: {
    alignItems: 'center',
    gap: 2,
  },
  nutritionValue: {
    ...typography.bodySemibold,
    color: colors.text.primary,
  },
  nutritionLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  mealsSection: {
    marginBottom: spacing.xl,
  },
  mealsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  mealsSectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
  },
  mealCount: {
    ...typography.small,
    color: colors.text.tertiary,
  },
  mealCard: {
    marginBottom: spacing.md,
  },
  mealCardValidated: {
    borderWidth: 2,
    borderColor: colors.success,
  },
  mealCardCheat: {
    backgroundColor: `${colors.warning}08`,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  mealTypeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  mealEmoji: {
    fontSize: 16,
  },
  mealTypeLabel: {
    ...typography.smallMedium,
    color: colors.text.secondary,
  },
  cheatTag: {
    marginLeft: spacing.xs,
  },
  sourceTag: {
    marginLeft: spacing.xs,
    backgroundColor: `${colors.accent.primary}15`,
    padding: 4,
    borderRadius: radius.sm,
  },
  mealActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.bg.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  validateButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.bg.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  validateButtonActive: {
    backgroundColor: colors.success,
  },
  mealName: {
    ...typography.bodySemibold,
    color: colors.text.primary,
    marginBottom: 4,
  },
  mealDescription: {
    ...typography.small,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  mealMeta: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  mealMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mealMetaText: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  mealDetails: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    marginTop: spacing.sm,
  },
  detailsTitle: {
    ...typography.smallMedium,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  ingredientItem: {
    ...typography.small,
    color: colors.text.secondary,
    flex: 1,
  },
  ingredientCalories: {
    ...typography.caption,
    color: colors.text.muted,
  },
  instructionItem: {
    ...typography.small,
    color: colors.text.secondary,
    marginBottom: 8,
  },
  nutritionBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
  },
  nutritionBreakdownItem: {
    alignItems: 'center',
  },
  nutritionBreakdownValue: {
    ...typography.bodySemibold,
  },
  nutritionBreakdownLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.sm,
    gap: 4,
  },
  expandButtonText: {
    ...typography.small,
    color: colors.accent.primary,
  },
  emptyDayCard: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyDayText: {
    ...typography.body,
    color: colors.text.muted,
  },
  shoppingButton: {
    marginTop: spacing.md,
  },
  shoppingButtonText: {
    ...typography.bodyMedium,
    color: colors.accent.primary,
    marginLeft: spacing.sm,
  },
  viewListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: `${colors.success}10`,
    borderRadius: radius.md,
  },
  viewListText: {
    ...typography.smallMedium,
    color: colors.success,
    flex: 1,
  },

  // Move Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.bg.primary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing['3xl'],
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    ...typography.h4,
    color: colors.text.primary,
  },
  moveMealName: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    fontStyle: 'italic',
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  sectionLabel: {
    ...typography.smallMedium,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  dayPicker: {
    marginBottom: spacing.lg,
    marginHorizontal: -spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  dayOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    marginRight: spacing.sm,
  },
  dayOptionActive: {
    backgroundColor: colors.accent.primary,
  },
  dayOptionText: {
    ...typography.smallMedium,
    color: colors.text.secondary,
  },
  dayOptionTextActive: {
    color: '#FFFFFF',
  },
  mealTypePicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  mealTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
  },
  mealTypeOptionActive: {
    backgroundColor: colors.accent.primary,
  },
  mealTypeEmoji: {
    fontSize: 16,
  },
  mealTypeOptionText: {
    ...typography.smallMedium,
    color: colors.text.secondary,
  },
  mealTypeOptionTextActive: {
    color: '#FFFFFF',
  },
  confirmButton: {
    marginTop: spacing.md,
  },
  confirmButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    marginLeft: spacing.sm,
  },

  // Shopping Modal
  shoppingModalContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  shoppingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.default,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  shoppingTitle: {
    ...typography.h4,
    color: colors.text.primary,
  },
  shoppingContent: {
    flex: 1,
    padding: spacing.default,
  },
  totalCard: {
    marginBottom: spacing.lg,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  totalLabel: {
    ...typography.small,
    color: colors.text.tertiary,
  },
  totalValue: {
    ...typography.h3,
    color: colors.accent.primary,
  },
  itemCount: {
    ...typography.small,
    color: colors.text.muted,
  },
  tipsCard: {
    marginBottom: spacing.lg,
    backgroundColor: `${colors.warning}08`,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  tipsTitle: {
    ...typography.smallMedium,
    color: colors.warning,
  },
  tipText: {
    ...typography.small,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  categorySection: {
    marginBottom: spacing.lg,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  categoryName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  categorySubtotal: {
    ...typography.smallMedium,
    color: colors.text.secondary,
  },
  shoppingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    ...typography.body,
    color: colors.text.primary,
  },
  itemNameChecked: {
    textDecorationLine: 'line-through',
    color: colors.text.muted,
  },
  itemQuantity: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  itemPrice: {
    ...typography.smallMedium,
    color: colors.text.secondary,
    minWidth: 60,
    textAlign: 'right',
  },
  emptyShoppingList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.muted,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  cancelButton: {
    flex: 1,
    borderColor: colors.error,
  },
  cancelButtonText: {
    ...typography.bodyMedium,
    color: colors.error,
    marginLeft: spacing.sm,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.success,
  },
  saveButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    marginLeft: spacing.sm,
  },
})
