import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  LayoutAnimation,
  UIManager,
  Platform,
  Modal,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { ChevronLeft, ChevronRight, Plus, X, ChevronDown, Minus, Zap } from 'lucide-react-native'

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}
import * as Haptics from 'expo-haptics'
import { Alert } from 'react-native'

import { Card, ProgressBar } from '../components/ui'
import { colors, fonts, spacing, typography, radius } from '../constants/theme'
import { useUserStore } from '../stores/user-store'
import { useMealsStore } from '../stores/meals-store'
import { formatNumber, getRelativeDate, getDateKey } from '../lib/utils'
import type { MealType, MealItem, FoodItem } from '../types'

// Types for edit modal
interface EditingItem {
  mealId: string
  item: MealItem
  mealType: MealType
}

// Meal template type
interface MealTemplate {
  id: string
  name: string
  icon: string
  mealType: MealType
  items: { food: FoodItem; quantity: number }[]
}

// Predefined meal templates
const MEAL_TEMPLATES: MealTemplate[] = [
  // Breakfast templates
  {
    id: 'breakfast_classic',
    name: 'Petit-dej classique',
    icon: '🥐',
    mealType: 'breakfast',
    items: [
      { food: { id: 'tpl_croissant', name: 'Croissant', nutrition: { calories: 230, proteins: 5, carbs: 26, fats: 12 }, servingSize: 1, servingUnit: 'piece', source: 'manual' }, quantity: 1 },
      { food: { id: 'tpl_coffee', name: 'Cafe au lait', nutrition: { calories: 60, proteins: 3, carbs: 5, fats: 3 }, servingSize: 200, servingUnit: 'ml', source: 'manual' }, quantity: 1 },
    ],
  },
  {
    id: 'breakfast_healthy',
    name: 'Petit-dej healthy',
    icon: '🥣',
    mealType: 'breakfast',
    items: [
      { food: { id: 'tpl_oats', name: 'Flocons d\'avoine', nutrition: { calories: 150, proteins: 5, carbs: 27, fats: 3 }, servingSize: 40, servingUnit: 'g', source: 'manual' }, quantity: 1 },
      { food: { id: 'tpl_banana', name: 'Banane', nutrition: { calories: 90, proteins: 1, carbs: 23, fats: 0 }, servingSize: 1, servingUnit: 'piece', source: 'manual' }, quantity: 1 },
      { food: { id: 'tpl_yogurt', name: 'Yaourt nature', nutrition: { calories: 60, proteins: 5, carbs: 7, fats: 1 }, servingSize: 125, servingUnit: 'g', source: 'manual' }, quantity: 1 },
    ],
  },
  {
    id: 'breakfast_protein',
    name: 'Petit-dej proteine',
    icon: '🍳',
    mealType: 'breakfast',
    items: [
      { food: { id: 'tpl_eggs', name: 'Oeufs brouilles', nutrition: { calories: 180, proteins: 13, carbs: 2, fats: 14 }, servingSize: 2, servingUnit: 'oeufs', source: 'manual' }, quantity: 1 },
      { food: { id: 'tpl_bread', name: 'Pain complet', nutrition: { calories: 80, proteins: 4, carbs: 15, fats: 1 }, servingSize: 1, servingUnit: 'tranche', source: 'manual' }, quantity: 2 },
    ],
  },
  // Lunch templates
  {
    id: 'lunch_salad',
    name: 'Salade composee',
    icon: '🥗',
    mealType: 'lunch',
    items: [
      { food: { id: 'tpl_salad_mix', name: 'Salade verte', nutrition: { calories: 15, proteins: 1, carbs: 2, fats: 0 }, servingSize: 100, servingUnit: 'g', source: 'manual' }, quantity: 1 },
      { food: { id: 'tpl_chicken', name: 'Poulet grille', nutrition: { calories: 165, proteins: 31, carbs: 0, fats: 4 }, servingSize: 100, servingUnit: 'g', source: 'manual' }, quantity: 1 },
      { food: { id: 'tpl_olive_oil', name: 'Huile d\'olive', nutrition: { calories: 90, proteins: 0, carbs: 0, fats: 10 }, servingSize: 10, servingUnit: 'ml', source: 'manual' }, quantity: 1 },
    ],
  },
  {
    id: 'lunch_bowl',
    name: 'Buddha bowl',
    icon: '🍚',
    mealType: 'lunch',
    items: [
      { food: { id: 'tpl_rice', name: 'Riz complet', nutrition: { calories: 130, proteins: 3, carbs: 28, fats: 1 }, servingSize: 100, servingUnit: 'g', source: 'manual' }, quantity: 1 },
      { food: { id: 'tpl_chickpeas', name: 'Pois chiches', nutrition: { calories: 120, proteins: 7, carbs: 20, fats: 2 }, servingSize: 80, servingUnit: 'g', source: 'manual' }, quantity: 1 },
      { food: { id: 'tpl_avocado', name: 'Avocat', nutrition: { calories: 160, proteins: 2, carbs: 9, fats: 15 }, servingSize: 100, servingUnit: 'g', source: 'manual' }, quantity: 0.5 },
    ],
  },
  // Snack templates
  {
    id: 'snack_fruit',
    name: 'Fruits frais',
    icon: '🍎',
    mealType: 'snack',
    items: [
      { food: { id: 'tpl_apple', name: 'Pomme', nutrition: { calories: 52, proteins: 0, carbs: 14, fats: 0 }, servingSize: 1, servingUnit: 'piece', source: 'manual' }, quantity: 1 },
    ],
  },
  {
    id: 'snack_nuts',
    name: 'Mix energetique',
    icon: '🥜',
    mealType: 'snack',
    items: [
      { food: { id: 'tpl_almonds', name: 'Amandes', nutrition: { calories: 170, proteins: 6, carbs: 6, fats: 15 }, servingSize: 30, servingUnit: 'g', source: 'manual' }, quantity: 1 },
      { food: { id: 'tpl_dried_fruit', name: 'Fruits secs', nutrition: { calories: 80, proteins: 1, carbs: 20, fats: 0 }, servingSize: 25, servingUnit: 'g', source: 'manual' }, quantity: 1 },
    ],
  },
  // Dinner templates
  {
    id: 'dinner_fish',
    name: 'Poisson & legumes',
    icon: '🐟',
    mealType: 'dinner',
    items: [
      { food: { id: 'tpl_salmon', name: 'Saumon', nutrition: { calories: 200, proteins: 22, carbs: 0, fats: 12 }, servingSize: 120, servingUnit: 'g', source: 'manual' }, quantity: 1 },
      { food: { id: 'tpl_veggies', name: 'Legumes vapeur', nutrition: { calories: 50, proteins: 2, carbs: 10, fats: 0 }, servingSize: 150, servingUnit: 'g', source: 'manual' }, quantity: 1 },
    ],
  },
  {
    id: 'dinner_pasta',
    name: 'Pates bolognaise',
    icon: '🍝',
    mealType: 'dinner',
    items: [
      { food: { id: 'tpl_pasta', name: 'Pates', nutrition: { calories: 180, proteins: 7, carbs: 36, fats: 1 }, servingSize: 80, servingUnit: 'g', source: 'manual' }, quantity: 1 },
      { food: { id: 'tpl_bolo', name: 'Sauce bolognaise', nutrition: { calories: 150, proteins: 10, carbs: 8, fats: 9 }, servingSize: 100, servingUnit: 'g', source: 'manual' }, quantity: 1 },
    ],
  },
]

const mealConfig: Record<MealType, { label: string; icon: string; color: string }> = {
  breakfast: { label: 'Petit-déjeuner', icon: '☀️', color: colors.warning },
  lunch: { label: 'Déjeuner', icon: '🍽️', color: colors.accent.primary },
  snack: { label: 'Collation', icon: '🍎', color: colors.success },
  dinner: { label: 'Dîner', icon: '🌙', color: colors.secondary.primary },
}

const mealOrder: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner']

export default function MealsScreen() {
  const navigation = useNavigation()
  const { nutritionGoals } = useUserStore()
  const { currentDate, setCurrentDate, getTodayData, getMealsByType, removeItemFromMeal, addMeal } = useMealsStore()

  // Track collapsed meal sections (expanded by default - empty set means nothing collapsed)
  const [collapsedSections, setCollapsedSections] = useState<Set<MealType>>(new Set())

  // Edit modal state
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null)
  const [editQuantity, setEditQuantity] = useState(1)

  // Templates modal state
  const [showTemplates, setShowTemplates] = useState(false)
  const [selectedTemplateType, setSelectedTemplateType] = useState<MealType | null>(null)

  // Reset to today's date when screen mounts
  useEffect(() => {
    const today = getDateKey()
    if (currentDate !== today) {
      setCurrentDate(today)
    }
  }, [])

  const todayData = getTodayData()
  const totals = todayData.totalNutrition
  const goals = nutritionGoals || { calories: 2000, proteins: 100, carbs: 250, fats: 67 }

  const changeDate = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const current = new Date(currentDate)
    current.setDate(current.getDate() + delta)
    setCurrentDate(getDateKey(current))
  }

  const handleAddMeal = (type: MealType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    // @ts-ignore - Navigation typing - Navigate to root AddMeal screen
    navigation.getParent()?.navigate('AddMeal', { type })
  }

  const handleRemoveItem = (mealId: string, itemId: string, itemName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert(
      'Supprimer l\'aliment',
      `Retirer "${itemName}" de ce repas ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            removeItemFromMeal(mealId, itemId)
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          },
        },
      ]
    )
  }

  const toggleSectionCollapsed = (mealType: MealType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setCollapsedSections(prev => {
      const next = new Set(prev)
      if (next.has(mealType)) {
        next.delete(mealType)
      } else {
        next.add(mealType)
      }
      return next
    })
  }

  // Open edit modal for an item
  const handleEditItem = (mealId: string, item: MealItem, mealType: MealType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setEditingItem({ mealId, item, mealType })
    setEditQuantity(item.quantity)
  }

  // Update item quantity
  const handleUpdateQuantity = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setEditQuantity(prev => Math.max(0.25, Math.round((prev + delta) * 4) / 4))
  }

  // Save edited item
  const handleSaveEdit = () => {
    if (!editingItem) return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    // Get current meal and update the item
    const { dailyData } = useMealsStore.getState()
    const dayData = dailyData[currentDate]
    if (!dayData) return

    const meal = dayData.meals.find(m => m.id === editingItem.mealId)
    if (!meal) return

    const updatedItems = meal.items.map(i =>
      i.id === editingItem.item.id
        ? { ...i, quantity: editQuantity }
        : i
    )

    useMealsStore.getState().updateMeal(editingItem.mealId, updatedItems)
    setEditingItem(null)
  }

  // Duplicate item to another meal type
  const handleDuplicateItem = (item: MealItem, targetMealType: MealType) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    addMeal(targetMealType, [{ ...item, id: `${item.id}_copy_${Date.now()}` }])
    setEditingItem(null)
  }

  // Close edit modal
  const handleCloseEdit = () => {
    setEditingItem(null)
  }

  // Open templates modal for a specific meal type
  const handleOpenTemplates = (type: MealType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedTemplateType(type)
    setShowTemplates(true)
  }

  // Apply a template - add all items to the meal
  const handleApplyTemplate = (template: MealTemplate) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    const items: MealItem[] = template.items.map((item, idx) => ({
      id: `${template.id}_${idx}_${Date.now()}`,
      food: item.food,
      quantity: item.quantity,
    }))
    addMeal(template.mealType, items)
    setShowTemplates(false)
    setSelectedTemplateType(null)
  }

  // Get templates for a specific meal type
  const getTemplatesForType = (type: MealType) => {
    return MEAL_TEMPLATES.filter(t => t.mealType === type)
  }

  // Calculate total calories for a template
  const getTemplateCalories = (template: MealTemplate) => {
    return template.items.reduce(
      (sum, item) => sum + Math.round(item.food.nutrition.calories * item.quantity),
      0
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Repas</Text>
      </View>

      {/* Date Selector */}
      <View style={styles.dateSelector}>
        <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateButton}>
          <ChevronLeft size={24} color={colors.text.secondary} />
        </TouchableOpacity>
        <Text style={styles.dateText}>{getRelativeDate(currentDate)}</Text>
        <TouchableOpacity onPress={() => changeDate(1)} style={styles.dateButton}>
          <ChevronRight size={24} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      {/* Daily Summary */}
      <Card style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Consommé</Text>
            <Text style={[styles.summaryValue, { color: colors.nutrients.calories }]}>
              {formatNumber(totals.calories)}
            </Text>
            <Text style={styles.summaryUnit}>kcal</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Restant</Text>
            <Text style={[styles.summaryValue, { color: colors.success }]}>
              {formatNumber(Math.max(0, goals.calories - totals.calories))}
            </Text>
            <Text style={styles.summaryUnit}>kcal</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Objectif</Text>
            <Text style={[styles.summaryValue, { color: colors.text.primary }]}>
              {formatNumber(goals.calories)}
            </Text>
            <Text style={styles.summaryUnit}>kcal</Text>
          </View>
        </View>
        <ProgressBar
          value={totals.calories}
          max={goals.calories}
          color={colors.accent.primary}
          style={styles.summaryProgress}
        />
      </Card>

      {/* Meals List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {mealOrder.map((type) => {
          const config = mealConfig[type]
          const meals = getMealsByType(currentDate, type)
          const totalCalories = meals.reduce(
            (sum, meal) => sum + meal.totalNutrition.calories,
            0
          )
          const hasMeals = meals.length > 0
          const isCollapsed = collapsedSections.has(type)
          const totalItems = meals.reduce((sum, m) => sum + m.items.length, 0)

          return (
            <Card key={type} style={styles.mealCard}>
              {/* Clickable header to expand/collapse */}
              <TouchableOpacity
                style={styles.mealHeader}
                onPress={() => hasMeals && toggleSectionCollapsed(type)}
                activeOpacity={hasMeals ? 0.7 : 1}
              >
                <View style={styles.mealInfo}>
                  <Text style={styles.mealIcon}>{config.icon}</Text>
                  <View>
                    <Text style={styles.mealLabel}>{config.label}</Text>
                    {hasMeals && (
                      <Text style={styles.mealItems}>
                        {totalItems} aliment{totalItems > 1 ? 's' : ''}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.mealRight}>
                  {hasMeals ? (
                    <View style={styles.mealRightContent}>
                      <Text style={[styles.mealCalories, { color: config.color }]}>
                        {formatNumber(totalCalories)} kcal
                      </Text>
                      <View style={[styles.chevronContainer, !isCollapsed && styles.chevronRotated]}>
                        <ChevronDown size={18} color={colors.text.tertiary} />
                      </View>
                    </View>
                  ) : (
                    <View style={styles.mealButtonsRow}>
                      <TouchableOpacity
                        style={[styles.templateButton, { backgroundColor: `${config.color}10` }]}
                        onPress={() => handleOpenTemplates(type)}
                      >
                        <Zap size={16} color={config.color} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.addButton, { backgroundColor: `${config.color}15` }]}
                        onPress={() => handleAddMeal(type)}
                      >
                        <Plus size={20} color={config.color} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </TouchableOpacity>

              {/* Collapsible content */}
              {hasMeals && !isCollapsed && (
                <View style={styles.mealContent}>
                  {meals.map((meal) => (
                    <View key={meal.id} style={styles.mealItemsList}>
                      {meal.items.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={styles.foodItem}
                          onPress={() => handleEditItem(meal.id, item, type)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.foodItemInfo}>
                            <View style={styles.foodNameRow}>
                              <Text style={styles.foodName} numberOfLines={1}>
                                {item.food.name}
                              </Text>
                              <Text style={styles.foodQuantity}>
                                x{item.quantity}
                              </Text>
                            </View>
                            <Text style={styles.foodCalories}>
                              {Math.round(item.food.nutrition.calories * item.quantity)} kcal
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.deleteItemButton}
                            onPress={() => handleRemoveItem(meal.id, item.id, item.food.name)}
                          >
                            <X size={16} color={colors.error} />
                          </TouchableOpacity>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                  <TouchableOpacity
                    style={styles.addMoreButton}
                    onPress={() => handleAddMeal(type)}
                  >
                    <Plus size={16} color={colors.accent.primary} />
                    <Text style={styles.addMoreText}>Ajouter un aliment</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Card>
          )
        })}
      </ScrollView>

      {/* Edit Item Modal */}
      <Modal
        visible={editingItem !== null}
        transparent
        animationType="slide"
        onRequestClose={handleCloseEdit}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleCloseEdit}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            {editingItem && (
              <>
                {/* Header */}
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Modifier</Text>
                  <TouchableOpacity onPress={handleCloseEdit}>
                    <X size={24} color={colors.text.secondary} />
                  </TouchableOpacity>
                </View>

                {/* Food name */}
                <Text style={styles.modalFoodName}>{editingItem.item.food.name}</Text>
                <Text style={styles.modalFoodServing}>
                  Portion: {editingItem.item.food.servingSize}{editingItem.item.food.servingUnit}
                </Text>

                {/* Quantity selector */}
                <View style={styles.quantitySection}>
                  <Text style={styles.quantityLabel}>Quantite</Text>
                  <View style={styles.quantityControls}>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => handleUpdateQuantity(-0.25)}
                    >
                      <Minus size={20} color={colors.text.primary} />
                    </TouchableOpacity>
                    <View style={styles.quantityValue}>
                      <Text style={styles.quantityText}>{editQuantity}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => handleUpdateQuantity(0.25)}
                    >
                      <Plus size={20} color={colors.text.primary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Nutrition preview */}
                <View style={styles.nutritionPreview}>
                  <View style={styles.nutritionItem}>
                    <Text style={styles.nutritionValue}>
                      {Math.round(editingItem.item.food.nutrition.calories * editQuantity)}
                    </Text>
                    <Text style={styles.nutritionLabel}>kcal</Text>
                  </View>
                  <View style={styles.nutritionItem}>
                    <Text style={styles.nutritionValue}>
                      {Math.round(editingItem.item.food.nutrition.proteins * editQuantity)}g
                    </Text>
                    <Text style={styles.nutritionLabel}>Prot</Text>
                  </View>
                  <View style={styles.nutritionItem}>
                    <Text style={styles.nutritionValue}>
                      {Math.round(editingItem.item.food.nutrition.carbs * editQuantity)}g
                    </Text>
                    <Text style={styles.nutritionLabel}>Gluc</Text>
                  </View>
                  <View style={styles.nutritionItem}>
                    <Text style={styles.nutritionValue}>
                      {Math.round(editingItem.item.food.nutrition.fats * editQuantity)}g
                    </Text>
                    <Text style={styles.nutritionLabel}>Lip</Text>
                  </View>
                </View>

                {/* Duplicate to other meal */}
                <View style={styles.duplicateSection}>
                  <Text style={styles.duplicateLabel}>Dupliquer vers</Text>
                  <View style={styles.duplicateButtons}>
                    {mealOrder
                      .filter(t => t !== editingItem.mealType)
                      .map(t => (
                        <TouchableOpacity
                          key={t}
                          style={styles.duplicateButton}
                          onPress={() => handleDuplicateItem(editingItem.item, t)}
                        >
                          <Text style={styles.duplicateIcon}>{mealConfig[t].icon}</Text>
                          <Text style={styles.duplicateText}>{mealConfig[t].label}</Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={handleCloseEdit}
                  >
                    <Text style={styles.cancelButtonText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSaveEdit}
                  >
                    <Text style={styles.saveButtonText}>Enregistrer</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Templates Modal */}
      <Modal
        visible={showTemplates}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTemplates(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowTemplates(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.templatesModalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.templatesHeaderLeft}>
                <Zap size={20} color={colors.accent.primary} />
                <Text style={styles.modalTitle}>Repas rapides</Text>
              </View>
              <TouchableOpacity onPress={() => setShowTemplates(false)}>
                <X size={24} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            {/* Meal type tabs */}
            <View style={styles.templatesTabs}>
              {mealOrder.map((type) => {
                const config = mealConfig[type]
                const isSelected = selectedTemplateType === type
                return (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.templateTab,
                      isSelected && { backgroundColor: `${config.color}20`, borderColor: config.color }
                    ]}
                    onPress={() => setSelectedTemplateType(type)}
                  >
                    <Text style={styles.templateTabIcon}>{config.icon}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* Templates list */}
            <ScrollView style={styles.templatesList} showsVerticalScrollIndicator={false}>
              {selectedTemplateType && getTemplatesForType(selectedTemplateType).map((template) => (
                <TouchableOpacity
                  key={template.id}
                  style={styles.templateCard}
                  onPress={() => handleApplyTemplate(template)}
                >
                  <View style={styles.templateCardHeader}>
                    <Text style={styles.templateIcon}>{template.icon}</Text>
                    <View style={styles.templateInfo}>
                      <Text style={styles.templateName}>{template.name}</Text>
                      <Text style={styles.templateCalories}>
                        {getTemplateCalories(template)} kcal
                      </Text>
                    </View>
                    <View style={styles.templateAddBadge}>
                      <Plus size={16} color={colors.accent.primary} />
                    </View>
                  </View>
                  <View style={styles.templateItems}>
                    {template.items.map((item, idx) => (
                      <Text key={idx} style={styles.templateItemText}>
                        {item.quantity > 1 ? `${item.quantity}x ` : ''}{item.food.name}
                      </Text>
                    ))}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  header: {
    padding: spacing.default,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    fontFamily: fonts.serif.bold,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.default,
    paddingBottom: spacing.default,
  },
  dateButton: {
    padding: spacing.sm,
  },
  dateText: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    marginHorizontal: spacing.lg,
  },
  summaryCard: {
    marginHorizontal: spacing.default,
    marginBottom: spacing.default,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  summaryValue: {
    ...typography.h4,
    fontWeight: '700',
  },
  summaryUnit: {
    ...typography.caption,
    color: colors.text.muted,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.border.light,
  },
  summaryProgress: {
    marginTop: spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.default,
    paddingTop: 0,
    paddingBottom: spacing['3xl'],
  },
  mealCard: {
    marginBottom: spacing.md,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mealInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  mealIcon: {
    fontSize: 32,
  },
  mealLabel: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  mealItems: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  mealRight: {
    alignItems: 'flex-end',
  },
  mealButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  templateButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealCalories: {
    ...typography.bodySemibold,
  },
  mealRightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chevronContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronRotated: {
    transform: [{ rotate: '180deg' }],
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealContent: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  mealItemsList: {
    marginBottom: spacing.sm,
  },
  foodItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginVertical: 2,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.sm,
  },
  foodItemInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  foodName: {
    ...typography.small,
    color: colors.text.secondary,
    flex: 1,
  },
  foodNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.md,
    gap: spacing.xs,
  },
  foodQuantity: {
    ...typography.caption,
    color: colors.text.tertiary,
    backgroundColor: colors.bg.tertiary,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  foodCalories: {
    ...typography.smallMedium,
    color: colors.text.tertiary,
  },
  deleteItemButton: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: `${colors.error}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    backgroundColor: colors.accent.light,
    borderRadius: radius.md,
  },
  addMoreText: {
    ...typography.smallMedium,
    color: colors.accent.primary,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.bg.primary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
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
  modalFoodName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  modalFoodServing: {
    ...typography.small,
    color: colors.text.tertiary,
    marginBottom: spacing.lg,
  },
  quantitySection: {
    marginBottom: spacing.lg,
  },
  quantityLabel: {
    ...typography.smallMedium,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  quantityButton: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.bg.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityValue: {
    minWidth: 60,
    alignItems: 'center',
  },
  quantityText: {
    ...typography.h3,
    color: colors.text.primary,
  },
  nutritionPreview: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  nutritionItem: {
    alignItems: 'center',
  },
  nutritionValue: {
    ...typography.bodySemibold,
    color: colors.text.primary,
  },
  nutritionLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  duplicateSection: {
    marginBottom: spacing.lg,
  },
  duplicateLabel: {
    ...typography.smallMedium,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  duplicateButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  duplicateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
  },
  duplicateIcon: {
    fontSize: 16,
  },
  duplicateText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.bg.secondary,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
  },
  saveButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.accent.primary,
    alignItems: 'center',
  },
  saveButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
  },
  // Templates modal styles
  templatesModalContent: {
    backgroundColor: colors.bg.primary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
    maxHeight: '80%',
  },
  templatesHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  templatesTabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  templateTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
    alignItems: 'center',
  },
  templateTabIcon: {
    fontSize: 20,
  },
  templatesList: {
    flex: 1,
  },
  templateCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  templateCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  templateIcon: {
    fontSize: 28,
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  templateCalories: {
    ...typography.small,
    color: colors.text.tertiary,
  },
  templateAddBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  templateItems: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  templateItemText: {
    ...typography.caption,
    color: colors.text.secondary,
    backgroundColor: colors.bg.tertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
})
