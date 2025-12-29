import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Image,
  ScrollView,
  Alert,
  Dimensions,
  Animated,
  Easing,
} from 'react-native'
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import {
  Camera,
  X,
  RotateCcw,
  Image as ImageIcon,
  Check,
  AlertCircle,
  Sparkles,
  Zap,
  ChefHat,
  Flame,
  Beef,
  Wheat,
  Droplet,
  Minus,
  Plus,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { Card, Button } from './ui'
import { colors, spacing, typography, radius } from '../constants/theme'
import { analyzeFood, hasOpenAIApiKey, type AnalyzedFood } from '../services/ai-service'
import type { FoodItem, NutritionInfo } from '../types'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

interface PhotoFoodScannerProps {
  visible: boolean
  onClose: () => void
  onFoodsDetected: (foods: FoodItem[]) => void
}

// Scanning animation component
function ScanningOverlay({ isAnalyzing }: { isAnalyzing: boolean }) {
  const scanLineAnim = useRef(new Animated.Value(0)).current
  const pulseAnim = useRef(new Animated.Value(1)).current
  const rotateAnim = useRef(new Animated.Value(0)).current
  const shimmerAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (isAnalyzing) {
      // Scan line animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start()

      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start()

      // Rotate animation
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start()

      // Shimmer animation
      Animated.loop(
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start()
    }
  }, [isAnalyzing])

  if (!isAnalyzing) return null

  const scanLineTranslate = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 300],
  })

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
  })

  return (
    <View style={scanStyles.container}>
      {/* Scan line */}
      <Animated.View
        style={[
          scanStyles.scanLine,
          { transform: [{ translateY: scanLineTranslate }] },
        ]}
      >
        <LinearGradient
          colors={['transparent', '#10B98180', '#10B981', '#10B98180', 'transparent']}
          style={scanStyles.scanLineGradient}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
        />
      </Animated.View>

      {/* Corner brackets */}
      <View style={[scanStyles.corner, scanStyles.topLeft]} />
      <View style={[scanStyles.corner, scanStyles.topRight]} />
      <View style={[scanStyles.corner, scanStyles.bottomLeft]} />
      <View style={[scanStyles.corner, scanStyles.bottomRight]} />

      {/* Center AI indicator */}
      <Animated.View
        style={[
          scanStyles.aiIndicator,
          { transform: [{ scale: pulseAnim }] },
        ]}
      >
        <Animated.View style={{ transform: [{ rotate }] }}>
          <LinearGradient
            colors={['#10B981', '#3B82F6', '#8B5CF6']}
            style={scanStyles.aiGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Sparkles size={28} color="#FFFFFF" />
          </LinearGradient>
        </Animated.View>
      </Animated.View>

      {/* Shimmer effect */}
      <Animated.View
        style={[
          scanStyles.shimmer,
          { transform: [{ translateX: shimmerTranslate }] },
        ]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.1)', 'transparent']}
          style={scanStyles.shimmerGradient}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
        />
      </Animated.View>

      {/* Status text */}
      <View style={scanStyles.statusContainer}>
        <BlurView intensity={40} tint="dark" style={scanStyles.statusBlur}>
          <Zap size={16} color="#10B981" />
          <Text style={scanStyles.statusText}>LymIA analyse votre repas...</Text>
        </BlurView>
      </View>
    </View>
  )
}

// Fat level labels
const FAT_LEVELS = [
  { label: 'Light', multiplier: 0.5, icon: '🥗' },
  { label: 'Normal', multiplier: 1.0, icon: '🍽️' },
  { label: 'Riche', multiplier: 1.5, icon: '🧈' },
]

// Animated food result item with fat adjuster
function FoodResultItem({
  food,
  isSelected,
  onToggle,
  delay,
  fatLevel,
  onFatLevelChange,
}: {
  food: AnalyzedFood
  isSelected: boolean
  onToggle: () => void
  delay: number
  fatLevel: number
  onFatLevelChange: (level: number) => void
}) {
  const slideAnim = useRef(new Animated.Value(50)).current
  const opacityAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.9)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 400,
        delay,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  const confidenceColor = food.confidence >= 0.8 ? '#10B981' : food.confidence >= 0.6 ? '#F59E0B' : '#EF4444'

  // Calculate adjusted nutrition based on fat level
  const fatMultiplier = FAT_LEVELS[fatLevel].multiplier
  const adjustedFats = Math.round(food.nutrition.fats * fatMultiplier)
  const fatCaloriesDiff = (adjustedFats - food.nutrition.fats) * 9 // 9 kcal per gram of fat
  const adjustedCalories = food.nutrition.calories + fatCaloriesDiff

  const handleFatDecrease = () => {
    if (fatLevel > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      onFatLevelChange(fatLevel - 1)
    }
  }

  const handleFatIncrease = () => {
    if (fatLevel < 2) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      onFatLevelChange(fatLevel + 1)
    }
  }

  return (
    <Animated.View
      style={[
        {
          opacity: opacityAnim,
          transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
        },
      ]}
    >
      <View style={[resultStyles.foodItem, isSelected && resultStyles.foodItemSelected]}>
        {/* Top row: selection */}
        <TouchableOpacity
          style={resultStyles.foodMainRow}
          onPress={onToggle}
          activeOpacity={0.7}
        >
          {/* Icon */}
          <View style={[resultStyles.foodIcon, { backgroundColor: isSelected ? colors.accent.primary : colors.bg.tertiary }]}>
            <ChefHat size={20} color={isSelected ? '#FFFFFF' : colors.text.secondary} />
          </View>

          {/* Info */}
          <View style={resultStyles.foodInfo}>
            <Text style={resultStyles.foodName}>{food.name}</Text>
            <View style={resultStyles.foodMeta}>
              <Text style={resultStyles.foodWeight}>~{food.estimatedWeight}g</Text>
              <View style={[resultStyles.confidenceBadge, { backgroundColor: confidenceColor + '20' }]}>
                <View style={[resultStyles.confidenceDot, { backgroundColor: confidenceColor }]} />
                <Text style={[resultStyles.confidenceText, { color: confidenceColor }]}>
                  {Math.round(food.confidence * 100)}%
                </Text>
              </View>
            </View>
          </View>

          {/* Calories */}
          <View style={resultStyles.nutritionBadge}>
            <Text style={resultStyles.caloriesValue}>{adjustedCalories}</Text>
            <Text style={resultStyles.caloriesUnit}>kcal</Text>
          </View>

          {/* Checkbox */}
          <View style={[resultStyles.checkbox, isSelected && resultStyles.checkboxSelected]}>
            {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
          </View>
        </TouchableOpacity>

        {/* Macros row */}
        <View style={resultStyles.macrosRow}>
          <View style={resultStyles.macroChip}>
            <Beef size={12} color="#3B82F6" />
            <Text style={[resultStyles.macroText, { color: '#3B82F6' }]}>{food.nutrition.proteins}g</Text>
          </View>
          <View style={resultStyles.macroChip}>
            <Wheat size={12} color="#F59E0B" />
            <Text style={[resultStyles.macroText, { color: '#F59E0B' }]}>{food.nutrition.carbs}g</Text>
          </View>
          <View style={[resultStyles.macroChip, resultStyles.fatChipHighlight]}>
            <Droplet size={12} color="#8B5CF6" />
            <Text style={[resultStyles.macroText, { color: '#8B5CF6' }]}>{adjustedFats}g</Text>
          </View>

          {/* Fat adjuster */}
          <View style={resultStyles.fatAdjuster}>
            <TouchableOpacity
              style={[resultStyles.fatButton, fatLevel === 0 && resultStyles.fatButtonDisabled]}
              onPress={handleFatDecrease}
              disabled={fatLevel === 0}
            >
              <Minus size={14} color={fatLevel === 0 ? '#475569' : '#8B5CF6'} />
            </TouchableOpacity>
            <View style={resultStyles.fatLevelBadge}>
              <Text style={resultStyles.fatLevelIcon}>{FAT_LEVELS[fatLevel].icon}</Text>
              <Text style={resultStyles.fatLevelText}>{FAT_LEVELS[fatLevel].label}</Text>
            </View>
            <TouchableOpacity
              style={[resultStyles.fatButton, fatLevel === 2 && resultStyles.fatButtonDisabled]}
              onPress={handleFatIncrease}
              disabled={fatLevel === 2}
            >
              <Plus size={14} color={fatLevel === 2 ? '#475569' : '#8B5CF6'} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Animated.View>
  )
}

// Nutrition summary card
function NutritionSummary({ nutrition, foodCount }: { nutrition: NutritionInfo; foodCount: number }) {
  const slideAnim = useRef(new Animated.Value(30)).current
  const opacityAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        delay: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start()
  }, [nutrition.calories])

  return (
    <Animated.View
      style={[
        summaryStyles.container,
        { opacity: opacityAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <LinearGradient
        colors={['#1E293B', '#0F172A']}
        style={summaryStyles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={summaryStyles.header}>
          <Sparkles size={18} color="#10B981" />
          <Text style={summaryStyles.title}>Analyse nutritionnelle</Text>
        </View>

        <View style={summaryStyles.grid}>
          {/* Calories - main */}
          <View style={summaryStyles.mainStat}>
            <LinearGradient
              colors={['#F97316', '#EA580C']}
              style={summaryStyles.mainStatGradient}
            >
              <Flame size={24} color="#FFFFFF" />
              <Text style={summaryStyles.mainValue}>{nutrition.calories}</Text>
              <Text style={summaryStyles.mainLabel}>kcal</Text>
            </LinearGradient>
          </View>

          {/* Macros */}
          <View style={summaryStyles.macros}>
            <View style={summaryStyles.macroItem}>
              <View style={[summaryStyles.macroIcon, { backgroundColor: '#3B82F620' }]}>
                <Beef size={16} color="#3B82F6" />
              </View>
              <Text style={summaryStyles.macroValue}>{nutrition.proteins}g</Text>
              <Text style={summaryStyles.macroLabel}>Protéines</Text>
            </View>
            <View style={summaryStyles.macroItem}>
              <View style={[summaryStyles.macroIcon, { backgroundColor: '#F59E0B20' }]}>
                <Wheat size={16} color="#F59E0B" />
              </View>
              <Text style={summaryStyles.macroValue}>{nutrition.carbs}g</Text>
              <Text style={summaryStyles.macroLabel}>Glucides</Text>
            </View>
            <View style={summaryStyles.macroItem}>
              <View style={[summaryStyles.macroIcon, { backgroundColor: '#8B5CF620' }]}>
                <Droplet size={16} color="#8B5CF6" />
              </View>
              <Text style={summaryStyles.macroValue}>{nutrition.fats}g</Text>
              <Text style={summaryStyles.macroLabel}>Lipides</Text>
            </View>
          </View>
        </View>

        <Text style={summaryStyles.footer}>
          {foodCount} aliment{foodCount > 1 ? 's' : ''} sélectionné{foodCount > 1 ? 's' : ''}
        </Text>
      </LinearGradient>
    </Animated.View>
  )
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
  const [fatLevels, setFatLevels] = useState<Map<number, number>>(new Map()) // index -> fat level (0-2)
  const [error, setError] = useState<string | null>(null)
  const [showResults, setShowResults] = useState(false)

  const cameraRef = useRef<CameraView>(null)
  const imageScaleAnim = useRef(new Animated.Value(1)).current
  const imageOpacityAnim = useRef(new Animated.Value(1)).current

  const resetState = () => {
    setCapturedImage(null)
    setAnalyzedFoods([])
    setSelectedFoods(new Set())
    setFatLevels(new Map())
    setError(null)
    setIsAnalyzing(false)
    setShowResults(false)
    imageScaleAnim.setValue(1)
    imageOpacityAnim.setValue(1)
  }

  // Get fat level for a food item (default to 1 = Normal)
  const getFatLevel = (index: number) => fatLevels.get(index) ?? 1

  // Set fat level for a food item
  const setFatLevel = (index: number, level: number) => {
    setFatLevels(prev => {
      const newMap = new Map(prev)
      newMap.set(index, level)
      return newMap
    })
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
    const hasKey = await hasOpenAIApiKey()
    if (!hasKey) {
      Alert.alert(
        'Configuration requise',
        'Veuillez configurer votre clé API OpenAI dans les paramètres pour utiliser la reconnaissance photo.',
        [{ text: 'OK', onPress: handleClose }]
      )
      return
    }

    setIsAnalyzing(true)
    setError(null)

    try {
      const result = await analyzeFood(base64)

      if (result.success && result.foods.length > 0) {
        // Animate image transition
        Animated.parallel([
          Animated.timing(imageScaleAnim, {
            toValue: 0.6,
            duration: 500,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start()

        setAnalyzedFoods(result.foods)
        setSelectedFoods(new Set(result.foods.map((_, i) => i)))
        setShowResults(true)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      } else if (result.foods.length === 0) {
        setError('Aucun aliment détecté dans cette image')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      } else {
        setError(result.error || "Erreur lors de l'analyse")
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

  // Calculate adjusted nutrition for a food item based on fat level
  const getAdjustedNutrition = (food: AnalyzedFood, index: number) => {
    const fatLevel = getFatLevel(index)
    const fatMultiplier = FAT_LEVELS[fatLevel].multiplier
    const adjustedFats = Math.round(food.nutrition.fats * fatMultiplier)
    const fatCaloriesDiff = (adjustedFats - food.nutrition.fats) * 9
    return {
      calories: food.nutrition.calories + fatCaloriesDiff,
      proteins: food.nutrition.proteins,
      carbs: food.nutrition.carbs,
      fats: adjustedFats,
      fiber: food.nutrition.fiber,
    }
  }

  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    const foods: FoodItem[] = Array.from(selectedFoods).map(index => {
      const food = analyzedFoods[index]
      const adjustedNutrition = getAdjustedNutrition(food, index)
      return {
        id: `photo-${Date.now()}-${index}`,
        name: food.name,
        nutrition: adjustedNutrition,
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
      const adjusted = getAdjustedNutrition(food, index)
      return {
        calories: acc.calories + adjusted.calories,
        proteins: acc.proteins + adjusted.proteins,
        carbs: acc.carbs + adjusted.carbs,
        fats: acc.fats + adjusted.fats,
      }
    },
    { calories: 0, proteins: 0, carbs: 0, fats: 0 }
  )

  if (!visible) return null

  // Permission handling
  if (!permission?.granted) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
        <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.permissionContainer}>
          <View style={styles.permissionIcon}>
            <Camera size={48} color="#10B981" />
          </View>
          <Text style={styles.permissionTitle}>Accès caméra requis</Text>
          <Text style={styles.permissionText}>
            Pour analyser vos repas avec l'IA, autorisez l'accès à la caméra.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <LinearGradient
              colors={['#10B981', '#059669']}
              style={styles.permissionButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Camera size={20} color="#FFFFFF" />
              <Text style={styles.permissionButtonText}>Autoriser la caméra</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeLink} onPress={handleClose}>
            <Text style={styles.closeLinkText}>Fermer</Text>
          </TouchableOpacity>
        </LinearGradient>
      </Modal>
    )
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        {!capturedImage ? (
          /* Camera View */
          <>
            <CameraView ref={cameraRef} style={styles.camera} facing={facing} />
            <View style={styles.overlay}>
              {/* Header */}
              <BlurView intensity={30} tint="dark" style={styles.header}>
                <TouchableOpacity style={styles.headerButton} onPress={handleClose}>
                  <X size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                  <Sparkles size={18} color="#10B981" />
                  <Text style={styles.headerTitle}>Photo IA</Text>
                </View>
                <TouchableOpacity
                  style={styles.headerButton}
                  onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
                >
                  <RotateCcw size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </BlurView>

              {/* Viewfinder frame */}
              <View style={styles.viewfinder}>
                <View style={[styles.viewfinderCorner, styles.topLeft]} />
                <View style={[styles.viewfinderCorner, styles.topRight]} />
                <View style={[styles.viewfinderCorner, styles.bottomLeft]} />
                <View style={[styles.viewfinderCorner, styles.bottomRight]} />
              </View>

              {/* Instructions */}
              <View style={styles.instructions}>
                <BlurView intensity={50} tint="dark" style={styles.instructionBlur}>
                  <Text style={styles.instructionText}>
                    Cadrez votre repas dans le viseur
                  </Text>
                </BlurView>
              </View>

              {/* Controls */}
              <View style={styles.controls}>
                <TouchableOpacity style={styles.galleryButton} onPress={pickImage}>
                  <BlurView intensity={40} tint="dark" style={styles.galleryBlur}>
                    <ImageIcon size={24} color="#FFFFFF" />
                  </BlurView>
                </TouchableOpacity>

                <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    style={styles.captureGradient}
                  >
                    <View style={styles.captureInner}>
                      <Camera size={28} color="#10B981" />
                    </View>
                  </LinearGradient>
                </TouchableOpacity>

                <View style={styles.galleryButton} />
              </View>
            </View>
          </>
        ) : (
          /* Analysis View */
          <View style={styles.analysisContainer}>
            {/* Captured Image with overlay */}
            <View style={styles.imageContainer}>
              <Animated.Image
                source={{ uri: capturedImage }}
                style={[
                  styles.capturedImage,
                  {
                    transform: [{ scale: imageScaleAnim }],
                    opacity: imageOpacityAnim,
                  },
                ]}
                resizeMode="cover"
              />

              {/* Scanning overlay */}
              <ScanningOverlay isAnalyzing={isAnalyzing} />

              {/* Close button */}
              <TouchableOpacity style={styles.closeButton} onPress={resetState}>
                <BlurView intensity={40} tint="dark" style={styles.closeButtonBlur}>
                  <X size={20} color="#FFFFFF" />
                </BlurView>
              </TouchableOpacity>
            </View>

            {/* Results */}
            {showResults && !isAnalyzing && (
              <View style={styles.resultsContainer}>
                <ScrollView
                  style={styles.resultsScroll}
                  contentContainerStyle={styles.resultsContent}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Header */}
                  <View style={styles.resultsHeader}>
                    <View style={styles.resultsHeaderIcon}>
                      <Sparkles size={20} color="#10B981" />
                    </View>
                    <View>
                      <Text style={styles.resultsTitle}>
                        {analyzedFoods.length} aliment{analyzedFoods.length > 1 ? 's' : ''} détecté{analyzedFoods.length > 1 ? 's' : ''}
                      </Text>
                      <Text style={styles.resultsSubtitle}>Sélectionnez les éléments à ajouter</Text>
                    </View>
                  </View>

                  {/* Food items */}
                  {analyzedFoods.map((food, index) => (
                    <FoodResultItem
                      key={index}
                      food={food}
                      isSelected={selectedFoods.has(index)}
                      onToggle={() => toggleFoodSelection(index)}
                      delay={index * 100}
                      fatLevel={getFatLevel(index)}
                      onFatLevelChange={(level) => setFatLevel(index, level)}
                    />
                  ))}

                  {/* Nutrition summary */}
                  {selectedFoods.size > 0 && (
                    <NutritionSummary
                      nutrition={totalNutrition}
                      foodCount={selectedFoods.size}
                    />
                  )}

                  <View style={{ height: 100 }} />
                </ScrollView>

                {/* Confirm button */}
                {selectedFoods.size > 0 && (
                  <View style={styles.confirmBar}>
                    <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                      <LinearGradient
                        colors={['#10B981', '#059669']}
                        style={styles.confirmGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        <Check size={22} color="#FFFFFF" strokeWidth={3} />
                        <Text style={styles.confirmText}>
                          Ajouter {selectedFoods.size} aliment{selectedFoods.size > 1 ? 's' : ''}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Error */}
            {error && !isAnalyzing && (
              <View style={styles.errorContainer}>
                <BlurView intensity={60} tint="dark" style={styles.errorBlur}>
                  <AlertCircle size={32} color="#EF4444" />
                  <Text style={styles.errorText}>{error}</Text>
                  <TouchableOpacity style={styles.retryButton} onPress={resetState}>
                    <Text style={styles.retryText}>Réessayer</Text>
                  </TouchableOpacity>
                </BlurView>
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  )
}

const scanStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanLine: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 3,
  },
  scanLineGradient: {
    flex: 1,
    borderRadius: 2,
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#10B981',
  },
  topLeft: {
    top: 40,
    left: 20,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: 40,
    right: 20,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 40,
    left: 20,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 40,
    right: 20,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 12,
  },
  aiIndicator: {
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: 'hidden',
  },
  aiGradient: {
    width: 70,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 100,
  },
  shimmerGradient: {
    flex: 1,
  },
  statusContainer: {
    position: 'absolute',
    bottom: 60,
    alignSelf: 'center',
  },
  statusBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
    overflow: 'hidden',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
})

const resultStyles = StyleSheet.create({
  foodItem: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  foodItemSelected: {
    borderColor: '#10B981',
    backgroundColor: '#10B98110',
  },
  foodMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    paddingBottom: 10,
  },
  foodIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  foodMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  foodWeight: {
    fontSize: 13,
    color: '#94A3B8',
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  confidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '600',
  },
  nutritionBadge: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  caloriesValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F97316',
  },
  caloriesUnit: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: -2,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#475569',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  // Macros row styles
  macrosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    gap: 8,
  },
  macroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  macroText: {
    fontSize: 12,
    fontWeight: '600',
  },
  fatChipHighlight: {
    backgroundColor: '#8B5CF615',
    borderWidth: 1,
    borderColor: '#8B5CF630',
  },
  // Fat adjuster styles
  fatAdjuster: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 2,
    gap: 2,
  },
  fatButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E293B',
  },
  fatButtonDisabled: {
    opacity: 0.4,
  },
  fatLevelBadge: {
    alignItems: 'center',
    paddingHorizontal: 6,
    minWidth: 50,
  },
  fatLevelIcon: {
    fontSize: 14,
  },
  fatLevelText: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '500',
  },
})

const summaryStyles = StyleSheet.create({
  container: {
    marginTop: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  gradient: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  grid: {
    flexDirection: 'row',
    gap: 16,
  },
  mainStat: {
    width: 100,
    borderRadius: 16,
    overflow: 'hidden',
  },
  mainStatGradient: {
    padding: 16,
    alignItems: 'center',
  },
  mainValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
  },
  mainLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: -2,
  },
  macros: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  macroItem: {
    alignItems: 'center',
  },
  macroIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  macroValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  macroLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  footer: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 16,
  },
})

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
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    overflow: 'hidden',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  viewfinder: {
    position: 'absolute',
    top: '20%',
    left: 30,
    right: 30,
    bottom: '30%',
  },
  viewfinderCorner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#10B981',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  instructions: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  instructionBlur: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    overflow: 'hidden',
  },
  instructionText: {
    fontSize: 15,
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '500',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 50,
    paddingHorizontal: 40,
  },
  galleryButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    overflow: 'hidden',
  },
  galleryBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    padding: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  captureGradient: {
    flex: 1,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  captureInner: {
    flex: 1,
    width: '100%',
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  permissionIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#10B98120',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  permissionButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  permissionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 16,
    gap: 10,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeLink: {
    marginTop: 24,
    padding: 12,
  },
  closeLinkText: {
    fontSize: 15,
    color: '#64748B',
  },
  analysisContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  imageContainer: {
    height: SCREEN_HEIGHT * 0.35,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  capturedImage: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  closeButtonBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
  },
  resultsScroll: {
    flex: 1,
  },
  resultsContent: {
    padding: 20,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  resultsHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#10B98120',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  resultsSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  confirmBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 34,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  confirmButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  confirmGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  confirmText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  errorContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
  },
  errorBlur: {
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  errorText: {
    fontSize: 15,
    color: '#F8FAFC',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#EF444420',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 4,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
})
