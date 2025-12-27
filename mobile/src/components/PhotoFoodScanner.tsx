import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import {
  Camera,
  X,
  RotateCcw,
  Image as ImageIcon,
  Check,
  AlertCircle,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { Card, Button, Badge } from './ui'
import { colors, spacing, typography, radius } from '../constants/theme'
import { analyzeFood, hasOpenAIApiKey, type AnalyzedFood } from '../services/ai-service'
import type { FoodItem, NutritionInfo } from '../types'

interface PhotoFoodScannerProps {
  visible: boolean
  onClose: () => void
  onFoodsDetected: (foods: FoodItem[]) => void
}

export default function PhotoFoodScanner({
  visible,
  onClose,
  onFoodsDetected,
}: PhotoFoodScannerProps) {
  const [permission, requestPermission] = useCameraPermissions()
  const [facing, setFacing] = useState<CameraType>('back')
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyzedFoods, setAnalyzedFoods] = useState<AnalyzedFood[]>([])
  const [selectedFoods, setSelectedFoods] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const cameraRef = useRef<CameraView>(null)

  const resetState = () => {
    setCapturedImage(null)
    setAnalyzedFoods([])
    setSelectedFoods(new Set())
    setError(null)
    setIsAnalyzing(false)
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  const takePicture = async () => {
    if (!cameraRef.current) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true,
      })

      if (photo?.base64) {
        setCapturedImage(`data:image/jpeg;base64,${photo.base64}`)
        await analyzeImage(photo.base64)
      }
    } catch (err) {
      console.error('Error taking picture:', err)
      setError('Erreur lors de la capture')
    }
  }

  const pickImage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    })

    if (!result.canceled && result.assets[0]?.base64) {
      const imageUri = result.assets[0].uri
      setCapturedImage(imageUri)
      await analyzeImage(result.assets[0].base64)
    }
  }

  const analyzeImage = async (base64: string) => {
    // Check API key first
    const hasKey = await hasOpenAIApiKey()
    if (!hasKey) {
      Alert.alert(
        'Configuration requise',
        'Veuillez configurer votre cle API OpenAI dans les parametres pour utiliser la reconnaissance photo.',
        [{ text: 'OK', onPress: handleClose }]
      )
      return
    }

    setIsAnalyzing(true)
    setError(null)

    try {
      const result = await analyzeFood(base64)

      if (result.success && result.foods.length > 0) {
        setAnalyzedFoods(result.foods)
        // Select all by default
        setSelectedFoods(new Set(result.foods.map((_, i) => i)))
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      } else if (result.foods.length === 0) {
        setError('Aucun aliment detecte dans cette image')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      } else {
        setError(result.error || 'Erreur lors de l\'analyse')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const toggleFoodSelection = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const newSelected = new Set(selectedFoods)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedFoods(newSelected)
  }

  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    const foods: FoodItem[] = Array.from(selectedFoods).map(index => {
      const food = analyzedFoods[index]
      return {
        id: `photo-${Date.now()}-${index}`,
        name: food.name,
        nutrition: {
          calories: food.nutrition.calories,
          proteins: food.nutrition.proteins,
          carbs: food.nutrition.carbs,
          fats: food.nutrition.fats,
          fiber: food.nutrition.fiber,
        },
        servingSize: food.estimatedWeight,
        servingUnit: 'g',
        source: 'photo',
      }
    })

    onFoodsDetected(foods)
    handleClose()
  }

  const totalNutrition: NutritionInfo = Array.from(selectedFoods).reduce(
    (acc, index) => {
      const food = analyzedFoods[index]
      return {
        calories: acc.calories + food.nutrition.calories,
        proteins: acc.proteins + food.nutrition.proteins,
        carbs: acc.carbs + food.nutrition.carbs,
        fats: acc.fats + food.nutrition.fats,
      }
    },
    { calories: 0, proteins: 0, carbs: 0, fats: 0 }
  )

  if (!visible) return null

  // Permission handling
  if (!permission?.granted) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
        <View style={styles.permissionContainer}>
          <Camera size={64} color={colors.text.muted} />
          <Text style={styles.permissionTitle}>Acces camera requis</Text>
          <Text style={styles.permissionText}>
            Pour analyser vos repas, veuillez autoriser l'acces a la camera.
          </Text>
          <Button variant="primary" onPress={requestPermission}>
            <Text style={styles.buttonText}>Autoriser la camera</Text>
          </Button>
          <TouchableOpacity style={styles.closeLink} onPress={handleClose}>
            <Text style={styles.closeLinkText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    )
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        {!capturedImage ? (
          /* Camera View */
          <>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing={facing}
            />
            <View style={styles.overlay}>
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity style={styles.headerButton} onPress={handleClose}>
                  <X size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Scanner photo</Text>
                <TouchableOpacity
                  style={styles.headerButton}
                  onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
                >
                  <RotateCcw size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* Instructions */}
              <View style={styles.instructions}>
                <Text style={styles.instructionText}>
                  Prenez une photo de votre repas
                </Text>
              </View>

              {/* Controls */}
              <View style={styles.controls}>
                <TouchableOpacity style={styles.galleryButton} onPress={pickImage}>
                  <ImageIcon size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
                  <View style={styles.captureInner} />
                </TouchableOpacity>
                <View style={styles.galleryButton} />
              </View>
            </View>
          </>
        ) : (
          /* Analysis View */
          <View style={styles.analysisContainer}>
            {/* Header */}
            <View style={styles.analysisHeader}>
              <TouchableOpacity onPress={resetState}>
                <X size={24} color={colors.text.primary} />
              </TouchableOpacity>
              <Text style={styles.analysisTitle}>Analyse</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.analysisContent}>
              {/* Captured Image */}
              <Image source={{ uri: capturedImage }} style={styles.capturedImage} />

              {/* Loading */}
              {isAnalyzing && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.accent.primary} />
                  <Text style={styles.loadingText}>Analyse en cours...</Text>
                </View>
              )}

              {/* Error */}
              {error && (
                <Card style={styles.errorCard}>
                  <AlertCircle size={24} color={colors.error} />
                  <Text style={styles.errorText}>{error}</Text>
                  <Button variant="outline" size="sm" onPress={resetState}>
                    <Text style={styles.retryText}>Reessayer</Text>
                  </Button>
                </Card>
              )}

              {/* Results */}
              {!isAnalyzing && analyzedFoods.length > 0 && (
                <>
                  <Text style={styles.resultsTitle}>
                    {analyzedFoods.length} aliment{analyzedFoods.length > 1 ? 's' : ''} detecte{analyzedFoods.length > 1 ? 's' : ''}
                  </Text>

                  {analyzedFoods.map((food, index) => {
                    const isSelected = selectedFoods.has(index)
                    return (
                      <TouchableOpacity
                        key={index}
                        style={[styles.foodItem, isSelected && styles.foodItemSelected]}
                        onPress={() => toggleFoodSelection(index)}
                      >
                        <View style={styles.foodInfo}>
                          <Text style={styles.foodName}>{food.name}</Text>
                          <Text style={styles.foodMeta}>
                            ~{food.estimatedWeight}g | Confiance: {Math.round(food.confidence * 100)}%
                          </Text>
                        </View>
                        <View style={styles.foodNutrition}>
                          <Text style={styles.foodCalories}>{food.nutrition.calories}</Text>
                          <Text style={styles.foodCaloriesUnit}>kcal</Text>
                        </View>
                        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                          {isSelected && <Check size={14} color="#FFFFFF" />}
                        </View>
                      </TouchableOpacity>
                    )
                  })}

                  {/* Total */}
                  {selectedFoods.size > 0 && (
                    <Card style={styles.totalCard}>
                      <Text style={styles.totalTitle}>Total selectionne</Text>
                      <View style={styles.totalRow}>
                        <View style={styles.totalItem}>
                          <Text style={[styles.totalValue, { color: colors.nutrients.calories }]}>
                            {totalNutrition.calories}
                          </Text>
                          <Text style={styles.totalLabel}>kcal</Text>
                        </View>
                        <View style={styles.totalItem}>
                          <Text style={[styles.totalValue, { color: colors.nutrients.proteins }]}>
                            {totalNutrition.proteins}g
                          </Text>
                          <Text style={styles.totalLabel}>Prot.</Text>
                        </View>
                        <View style={styles.totalItem}>
                          <Text style={[styles.totalValue, { color: colors.nutrients.carbs }]}>
                            {totalNutrition.carbs}g
                          </Text>
                          <Text style={styles.totalLabel}>Gluc.</Text>
                        </View>
                        <View style={styles.totalItem}>
                          <Text style={[styles.totalValue, { color: colors.nutrients.fats }]}>
                            {totalNutrition.fats}g
                          </Text>
                          <Text style={styles.totalLabel}>Lip.</Text>
                        </View>
                      </View>
                    </Card>
                  )}
                </>
              )}
            </ScrollView>

            {/* Confirm Button */}
            {selectedFoods.size > 0 && (
              <View style={styles.confirmBar}>
                <Button variant="primary" size="lg" fullWidth onPress={handleConfirm}>
                  <Check size={20} color="#FFFFFF" />
                  <Text style={styles.buttonText}>
                    Ajouter {selectedFoods.size} aliment{selectedFoods.size > 1 ? 's' : ''}
                  </Text>
                </Button>
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: spacing.default,
    paddingBottom: spacing.md,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h4,
    color: '#FFFFFF',
  },
  instructions: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  instructionText: {
    ...typography.body,
    color: '#FFFFFF',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 50,
    paddingHorizontal: spacing.xl,
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    padding: 4,
  },
  captureInner: {
    flex: 1,
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: colors.accent.primary,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg.primary,
    padding: spacing.xl,
    gap: spacing.md,
  },
  permissionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  permissionText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  buttonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    marginLeft: spacing.sm,
  },
  closeLink: {
    marginTop: spacing.lg,
  },
  closeLinkText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  analysisContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  analysisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.default,
    paddingTop: 60,
  },
  analysisTitle: {
    ...typography.h4,
    color: colors.text.primary,
  },
  analysisContent: {
    flex: 1,
    padding: spacing.default,
  },
  capturedImage: {
    width: '100%',
    height: 200,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  errorCard: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    textAlign: 'center',
  },
  retryText: {
    ...typography.bodyMedium,
    color: colors.accent.primary,
  },
  resultsTitle: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  foodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  foodItemSelected: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.accent.light,
  },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  foodMeta: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  foodNutrition: {
    alignItems: 'flex-end',
    marginRight: spacing.md,
  },
  foodCalories: {
    ...typography.bodySemibold,
    color: colors.nutrients.calories,
  },
  foodCaloriesUnit: {
    ...typography.caption,
    color: colors.text.muted,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.accent.primary,
    borderColor: colors.accent.primary,
  },
  totalCard: {
    marginTop: spacing.md,
  },
  totalTitle: {
    ...typography.smallMedium,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  totalItem: {
    alignItems: 'center',
  },
  totalValue: {
    ...typography.h4,
    fontWeight: '700',
  },
  totalLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  confirmBar: {
    padding: spacing.default,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
})
