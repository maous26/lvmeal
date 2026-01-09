/**
 * AddProductModal - Modal for adding a new product to local OFF database
 *
 * When a barcode scan doesn't find a product in Open Food Facts,
 * this modal allows the user to manually enter the product information.
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native'
import { X, Check, Package, Scale, Info } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { colors, spacing, typography, radius } from '../constants/theme'
import { useLocalOffStore, type LocalOffProduct } from '../stores/local-off-store'
import { analytics } from '../services/analytics-service'
import type { FoodItem } from '../types'

interface AddProductModalProps {
  visible: boolean
  barcode: string
  onClose: () => void
  onProductAdded: (food: FoodItem) => void
}

interface FormData {
  productName: string
  brand: string
  calories: string
  proteins: string
  carbs: string
  fats: string
  fiber: string
  sugar: string
  servingSize: string
}

const initialFormData: FormData = {
  productName: '',
  brand: '',
  calories: '',
  proteins: '',
  carbs: '',
  fats: '',
  fiber: '',
  sugar: '',
  servingSize: '100',
}

export default function AddProductModal({
  visible,
  barcode,
  onClose,
  onProductAdded,
}: AddProductModalProps) {
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const addProduct = useLocalOffStore((state) => state.addProduct)

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {}

    if (!formData.productName.trim()) {
      newErrors.productName = 'Nom du produit requis'
    }

    if (!formData.calories.trim() || isNaN(Number(formData.calories))) {
      newErrors.calories = 'Calories requises (nombre)'
    }

    if (!formData.proteins.trim() || isNaN(Number(formData.proteins))) {
      newErrors.proteins = 'Proteines requises (nombre)'
    }

    if (!formData.carbs.trim() || isNaN(Number(formData.carbs))) {
      newErrors.carbs = 'Glucides requis (nombre)'
    }

    if (!formData.fats.trim() || isNaN(Number(formData.fats))) {
      newErrors.fats = 'Lipides requis (nombre)'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (!validateForm()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    // Create the local OFF product
    const newProduct: Omit<LocalOffProduct, 'addedAt' | 'addedBy' | 'source'> = {
      code: barcode,
      product_name: formData.productName.trim(),
      product_name_fr: formData.productName.trim(),
      brands: formData.brand.trim() || undefined,
      nutriments: {
        'energy-kcal_100g': Number(formData.calories),
        proteins_100g: Number(formData.proteins),
        carbohydrates_100g: Number(formData.carbs),
        fat_100g: Number(formData.fats),
        fiber_100g: formData.fiber ? Number(formData.fiber) : undefined,
        sugars_100g: formData.sugar ? Number(formData.sugar) : undefined,
      },
      serving_size: formData.servingSize || '100',
    }

    // Add to local store
    addProduct(newProduct)

    // Track analytics
    analytics.track('feature_used', {
      feature: 'local_product_added',
      barcode,
      product_name: newProduct.product_name,
      has_brand: !!newProduct.brands,
    })

    // Create FoodItem to return
    const foodItem: FoodItem = {
      id: `local-off-${barcode}`,
      name: formData.brand
        ? `${formData.productName.trim()} - ${formData.brand.trim()}`
        : formData.productName.trim(),
      brand: formData.brand.trim() || undefined,
      nutrition: {
        calories: Number(formData.calories),
        proteins: Number(formData.proteins),
        carbs: Number(formData.carbs),
        fats: Number(formData.fats),
        fiber: formData.fiber ? Number(formData.fiber) : undefined,
        sugar: formData.sugar ? Number(formData.sugar) : undefined,
      },
      servingSize: Number(formData.servingSize) || 100,
      servingUnit: 'g',
      source: 'openfoodfacts',
      barcode,
    }

    // Reset form
    setFormData(initialFormData)
    setErrors({})

    // Notify parent
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    onProductAdded(foodItem)
  }

  const handleClose = () => {
    setFormData(initialFormData)
    setErrors({})
    onClose()
  }

  if (!visible) return null

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={handleClose}>
            <X size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nouveau Produit</Text>
          <TouchableOpacity style={styles.headerButton} onPress={handleSubmit}>
            <Check size={24} color={colors.accent.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Barcode Info */}
          <View style={styles.barcodeInfo}>
            <Package size={20} color={colors.text.secondary} />
            <Text style={styles.barcodeText}>Code-barres: {barcode}</Text>
          </View>

          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <Info size={16} color={colors.accent.primary} />
            <Text style={styles.infoBannerText}>
              Ce produit n'existe pas dans Open Food Facts. Renseignez ses informations nutritionnelles pour pouvoir le scanner a nouveau.
            </Text>
          </View>

          {/* Product Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nom du produit *</Text>
            <TextInput
              style={[styles.input, errors.productName && styles.inputError]}
              value={formData.productName}
              onChangeText={(v) => updateField('productName', v)}
              placeholder="Ex: Yaourt nature bio"
              placeholderTextColor={colors.text.muted}
              autoCapitalize="sentences"
            />
            {errors.productName && (
              <Text style={styles.errorText}>{errors.productName}</Text>
            )}
          </View>

          {/* Brand */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Marque (optionnel)</Text>
            <TextInput
              style={styles.input}
              value={formData.brand}
              onChangeText={(v) => updateField('brand', v)}
              placeholder="Ex: Danone"
              placeholderTextColor={colors.text.muted}
              autoCapitalize="words"
            />
          </View>

          {/* Nutrition Section */}
          <View style={styles.sectionHeader}>
            <Scale size={18} color={colors.text.secondary} />
            <Text style={styles.sectionTitle}>Valeurs nutritionnelles (pour 100g)</Text>
          </View>

          {/* Calories */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Calories (kcal) *</Text>
            <TextInput
              style={[styles.input, errors.calories && styles.inputError]}
              value={formData.calories}
              onChangeText={(v) => updateField('calories', v)}
              placeholder="Ex: 120"
              placeholderTextColor={colors.text.muted}
              keyboardType="numeric"
            />
            {errors.calories && (
              <Text style={styles.errorText}>{errors.calories}</Text>
            )}
          </View>

          {/* Macros Row */}
          <View style={styles.macrosRow}>
            <View style={styles.macroInput}>
              <Text style={styles.label}>Proteines (g) *</Text>
              <TextInput
                style={[styles.input, errors.proteins && styles.inputError]}
                value={formData.proteins}
                onChangeText={(v) => updateField('proteins', v)}
                placeholder="0"
                placeholderTextColor={colors.text.muted}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.macroInput}>
              <Text style={styles.label}>Glucides (g) *</Text>
              <TextInput
                style={[styles.input, errors.carbs && styles.inputError]}
                value={formData.carbs}
                onChangeText={(v) => updateField('carbs', v)}
                placeholder="0"
                placeholderTextColor={colors.text.muted}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.macroInput}>
              <Text style={styles.label}>Lipides (g) *</Text>
              <TextInput
                style={[styles.input, errors.fats && styles.inputError]}
                value={formData.fats}
                onChangeText={(v) => updateField('fats', v)}
                placeholder="0"
                placeholderTextColor={colors.text.muted}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Optional Nutrition */}
          <View style={styles.macrosRow}>
            <View style={styles.macroInput}>
              <Text style={styles.label}>Fibres (g)</Text>
              <TextInput
                style={styles.input}
                value={formData.fiber}
                onChangeText={(v) => updateField('fiber', v)}
                placeholder="0"
                placeholderTextColor={colors.text.muted}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.macroInput}>
              <Text style={styles.label}>Sucres (g)</Text>
              <TextInput
                style={styles.input}
                value={formData.sugar}
                onChangeText={(v) => updateField('sugar', v)}
                placeholder="0"
                placeholderTextColor={colors.text.muted}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.macroInput}>
              <Text style={styles.label}>Portion (g)</Text>
              <TextInput
                style={styles.input}
                value={formData.servingSize}
                onChangeText={(v) => updateField('servingSize', v)}
                placeholder="100"
                placeholderTextColor={colors.text.muted}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitButtonText}>Enregistrer le produit</Text>
          </TouchableOpacity>

          {/* Help Text */}
          <Text style={styles.helpText}>
            Les informations nutritionnelles se trouvent generalement sur l'emballage du produit.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.default,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h4,
    color: colors.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.default,
    paddingBottom: spacing['4xl'],
  },
  barcodeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg.secondary,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  barcodeText: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.accent.light,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  infoBannerText: {
    ...typography.small,
    color: colors.text.primary,
    flex: 1,
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.smallMedium,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text.primary,
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
  },
  macrosRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  macroInput: {
    flex: 1,
  },
  submitButton: {
    backgroundColor: colors.accent.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  submitButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  helpText: {
    ...typography.small,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
})
