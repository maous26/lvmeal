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
  ChevronDown,
  ChevronUp,
  Settings2,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { Card, Button } from './ui'
import { colors, spacing, typography, radius } from '../constants/theme'
import { analyzeFood, hasOpenAIApiKey, type AnalyzedFood } from '../services/ai-service'
import { analytics } from '../services/analytics-service'
import { errorReporting } from '../services/error-reporting-service'
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
          <Text style={scanStyles.statusText}>LymIA analyse ton repas...</Text>
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

// Pastel colors for light theme
const PASTEL = {
  bg: '#FAF9F6', // blanc cassé
  card: '#FFFFFF',
  border: '#E8E5DE',
  text: '#2D3436',
  textSecondary: '#636E72',
  protein: '#74B9FF', // bleu pastel
  carbs: '#FFEAA7', // jaune pastel
  fats: '#DDA0DD', // violet pastel
  calories: '#FF7675', // rouge pastel
  green: '#55EFC4', // vert pastel
  greenDark: '#00B894',
}

// Animated food result item (light theme)
function FoodResultItem({
  food,
  isSelected,
  onToggle,
  delay,
}: {
  food: AnalyzedFood
  isSelected: boolean
  onToggle: () => void
  delay: number
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

  const confidenceColor = food.confidence >= 0.8 ? PASTEL.greenDark : food.confidence >= 0.6 ? '#FDCB6E' : '#E17055'

  return (
    <Animated.View
      style={[
        {
          opacity: opacityAnim,
          transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={[resultStyles.foodItem, isSelected && resultStyles.foodItemSelected]}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        {/* Icon */}
        <View style={[resultStyles.foodIcon, { backgroundColor: isSelected ? PASTEL.green : '#F0F0ED' }]}>
          <ChefHat size={20} color={isSelected ? PASTEL.greenDark : PASTEL.textSecondary} />
        </View>

        {/* Info */}
        <View style={resultStyles.foodInfo}>
          <Text style={resultStyles.foodName}>{food.name}</Text>
          <View style={resultStyles.foodMeta}>
            <Text style={resultStyles.foodWeight}>~{food.estimatedWeight}g</Text>
            <View style={[resultStyles.confidenceBadge, { backgroundColor: confidenceColor + '30' }]}>
              <View style={[resultStyles.confidenceDot, { backgroundColor: confidenceColor }]} />
              <Text style={[resultStyles.confidenceText, { color: confidenceColor }]}>
                {Math.round(food.confidence * 100)}%
              </Text>
            </View>
          </View>
        </View>

        {/* Calories */}
        <View style={resultStyles.nutritionBadge}>
          <Text style={resultStyles.caloriesValue}>{Math.round(food.nutrition.calories)}</Text>
          <Text style={resultStyles.caloriesUnit}>kcal</Text>
        </View>

        {/* Checkbox */}
        <View style={[resultStyles.checkbox, isSelected && resultStyles.checkboxSelected]}>
          {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
}

// Global fat adjuster component
function GlobalFatAdjuster({
  fatLevel,
  onFatLevelChange,
}: {
  fatLevel: number
  onFatLevelChange: (level: number) => void
}) {
  const handleDecrease = () => {
    if (fatLevel > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      onFatLevelChange(fatLevel - 1)
    }
  }

  const handleIncrease = () => {
    if (fatLevel < 2) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      onFatLevelChange(fatLevel + 1)
    }
  }

  return (
    <View style={fatAdjusterStyles.container}>
      <View style={fatAdjusterStyles.header}>
        <Droplet size={18} color={PASTEL.fats} />
        <Text style={fatAdjusterStyles.title}>Niveau de matière grasse</Text>
      </View>
      <View style={fatAdjusterStyles.controls}>
        <TouchableOpacity
          style={[fatAdjusterStyles.button, fatLevel === 0 && fatAdjusterStyles.buttonDisabled]}
          onPress={handleDecrease}
          disabled={fatLevel === 0}
        >
          <Minus size={18} color={fatLevel === 0 ? '#CBD5E1' : PASTEL.fats} />
        </TouchableOpacity>

        <View style={fatAdjusterStyles.levelContainer}>
          <Text style={fatAdjusterStyles.levelIcon}>{FAT_LEVELS[fatLevel].icon}</Text>
          <Text style={fatAdjusterStyles.levelLabel}>{FAT_LEVELS[fatLevel].label}</Text>
        </View>

        <TouchableOpacity
          style={[fatAdjusterStyles.button, fatLevel === 2 && fatAdjusterStyles.buttonDisabled]}
          onPress={handleIncrease}
          disabled={fatLevel === 2}
        >
          <Plus size={18} color={fatLevel === 2 ? '#CBD5E1' : PASTEL.fats} />
        </TouchableOpacity>
      </View>
      <Text style={fatAdjusterStyles.hint}>
        {fatLevel === 0 ? 'Cuisson légère, peu de sauce' : fatLevel === 1 ? 'Préparation standard' : 'Riche en huile, sauce, beurre'}
      </Text>
    </View>
  )
}

// Nutrition summary card (light theme)
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
      <View style={summaryStyles.card}>
        <View style={summaryStyles.header}>
          <Sparkles size={18} color={PASTEL.greenDark} />
          <Text style={summaryStyles.title}>Analyse nutritionnelle</Text>
        </View>

        <View style={summaryStyles.grid}>
          {/* Calories - main */}
          <View style={summaryStyles.mainStat}>
            <Flame size={22} color={PASTEL.calories} />
            <Text style={summaryStyles.mainValue}>{Math.round(nutrition.calories)}</Text>
            <Text style={summaryStyles.mainLabel}>kcal</Text>
          </View>

          {/* Macros */}
          <View style={summaryStyles.macros}>
            <View style={summaryStyles.macroItem}>
              <View style={[summaryStyles.macroIcon, { backgroundColor: PASTEL.protein + '40' }]}>
                <Beef size={16} color="#5A9BD5" />
              </View>
              <Text style={summaryStyles.macroValue}>{Math.round(nutrition.proteins)}g</Text>
              <Text style={summaryStyles.macroLabel}>Protéines</Text>
            </View>
            <View style={summaryStyles.macroItem}>
              <View style={[summaryStyles.macroIcon, { backgroundColor: PASTEL.carbs + '60' }]}>
                <Wheat size={16} color="#E8B730" />
              </View>
              <Text style={summaryStyles.macroValue}>{Math.round(nutrition.carbs)}g</Text>
              <Text style={summaryStyles.macroLabel}>Glucides</Text>
            </View>
            <View style={summaryStyles.macroItem}>
              <View style={[summaryStyles.macroIcon, { backgroundColor: PASTEL.fats + '40' }]}>
                <Droplet size={16} color="#BA68C8" />
              </View>
              <Text style={summaryStyles.macroValue}>{Math.round(nutrition.fats)}g</Text>
              <Text style={summaryStyles.macroLabel}>Lipides</Text>
            </View>
          </View>
        </View>

        <Text style={summaryStyles.footer}>
          {foodCount} aliment{foodCount > 1 ? 's' : ''} sélectionné{foodCount > 1 ? 's' : ''}
        </Text>
      </View>
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
  const [mealTitle, setMealTitle] = useState<string | null>(null) // AI-generated meal title
  const [selectedFoods, setSelectedFoods] = useState<Set<number>>(new Set())
  const [globalFatLevel, setGlobalFatLevel] = useState(1) // 0=Light, 1=Normal, 2=Riche
  const [error, setError] = useState<string | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [showDetails, setShowDetails] = useState(false) // Toggle for detailed view vs quick view

  const cameraRef = useRef<CameraView>(null)
  const imageScaleAnim = useRef(new Animated.Value(1)).current
  const imageOpacityAnim = useRef(new Animated.Value(1)).current

  const resetState = () => {
    setCapturedImage(null)
    setAnalyzedFoods([])
    setMealTitle(null)
    setSelectedFoods(new Set())
    setGlobalFatLevel(1)
    setError(null)
    setIsAnalyzing(false)
    setShowResults(false)
    setShowDetails(false)
    imageScaleAnim.setValue(1)
    imageOpacityAnim.setValue(1)
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
        'Configure ta clé API OpenAI dans les paramètres pour utiliser la reconnaissance photo.',
        [{ text: 'OK', onPress: handleClose }]
      )
      return
    }

    setIsAnalyzing(true)
    setError(null)
    const startTime = Date.now()

    // Track scan started
    analytics.track('photo_scan_started')

    try {
      const result = await analyzeFood(base64)
      const durationMs = Date.now() - startTime

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
        setMealTitle(result.mealTitle || null)
        setSelectedFoods(new Set(result.foods.map((_, i) => i)))
        setShowResults(true)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

        // Track success
        analytics.trackAIFeature('photo_scan', true, durationMs, {
          foods_count: result.foods.length,
        })
      } else if (result.foods.length === 0) {
        setError('Aucun aliment détecté dans cette image')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        analytics.trackAIFeature('photo_scan', false, durationMs, {
          error_type: 'no_foods_detected',
        })
      } else {
        setError(result.error || "Erreur lors de l'analyse")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        analytics.trackAIFeature('photo_scan', false, durationMs, {
          error_type: 'analysis_failed',
        })
      }
    } catch (err) {
      const durationMs = Date.now() - startTime
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      errorReporting.captureFeatureError('photo_scan', err)
      analytics.trackAIFeature('photo_scan', false, durationMs, {
        error_type: 'exception',
      })
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

  // Calculate adjusted nutrition for a food item based on global fat level
  const getAdjustedNutrition = (food: AnalyzedFood) => {
    const fatMultiplier = FAT_LEVELS[globalFatLevel].multiplier
    const adjustedFats = Math.round(food.nutrition.fats * fatMultiplier)
    const fatCaloriesDiff = (adjustedFats - food.nutrition.fats) * 9
    return {
      calories: Math.round(food.nutrition.calories + fatCaloriesDiff),
      proteins: Math.round(food.nutrition.proteins),
      carbs: Math.round(food.nutrition.carbs),
      fats: adjustedFats,
      fiber: food.nutrition.fiber,
    }
  }

  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    // Calculate total weight from selected foods
    const totalWeight = Array.from(selectedFoods).reduce(
      (sum, index) => sum + analyzedFoods[index].estimatedWeight,
      0
    )

    // Create a single FoodItem with the meal title and combined nutrition
    const combinedFood: FoodItem = {
      id: `photo-${Date.now()}`,
      name: mealTitle || 'Repas scanné',
      nutrition: totalNutrition,
      servingSize: totalWeight,
      servingUnit: 'g',
      source: 'photo',
    }

    onFoodsDetected([combinedFood])
    handleClose()
  }

  const totalNutrition: NutritionInfo = Array.from(selectedFoods).reduce(
    (acc, index) => {
      const food = analyzedFoods[index]
      const adjusted = getAdjustedNutrition(food)
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
            Pour analyser tes repas avec l'IA, autorise l'accès à la caméra.
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
                    Cadre ton repas dans le viseur
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

            {/* Results - Simplified Quick-Add View */}
            {showResults && !isAnalyzing && (
              <View style={styles.resultsContainer}>
                <ScrollView
                  style={styles.resultsScroll}
                  contentContainerStyle={styles.resultsContent}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Quick Summary Card */}
                  <View style={styles.quickSummaryCard}>
                    <View style={styles.quickSummaryHeader}>
                      <View style={styles.resultsHeaderIcon}>
                        <Sparkles size={20} color="#10B981" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultsTitle}>
                          {mealTitle || 'Repas analysé'}
                        </Text>
                        <Text style={styles.resultsSubtitle}>
                          {analyzedFoods.length} ingrédient{analyzedFoods.length > 1 ? 's' : ''} détecté{analyzedFoods.length > 1 ? 's' : ''}
                        </Text>
                      </View>
                    </View>

                    {/* Quick Nutrition Display */}
                    <View style={styles.quickNutritionGrid}>
                      <View style={styles.quickNutritionMain}>
                        <Flame size={24} color={PASTEL.calories} />
                        <Text style={styles.quickCaloriesValue}>{Math.round(totalNutrition.calories)}</Text>
                        <Text style={styles.quickCaloriesUnit}>kcal</Text>
                      </View>
                      <View style={styles.quickMacroRow}>
                        <View style={styles.quickMacroItem}>
                          <Text style={[styles.quickMacroValue, { color: '#5A9BD5' }]}>{Math.round(totalNutrition.proteins)}g</Text>
                          <Text style={styles.quickMacroLabel}>Prot.</Text>
                        </View>
                        <View style={styles.quickMacroItem}>
                          <Text style={[styles.quickMacroValue, { color: '#E8B730' }]}>{Math.round(totalNutrition.carbs)}g</Text>
                          <Text style={styles.quickMacroLabel}>Gluc.</Text>
                        </View>
                        <View style={styles.quickMacroItem}>
                          <Text style={[styles.quickMacroValue, { color: '#BA68C8' }]}>{Math.round(totalNutrition.fats)}g</Text>
                          <Text style={styles.quickMacroLabel}>Lip.</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Toggle Details Button */}
                  <TouchableOpacity
                    style={styles.toggleDetailsButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      setShowDetails(!showDetails)
                    }}
                    activeOpacity={0.7}
                  >
                    <Settings2 size={16} color={PASTEL.textSecondary} />
                    <Text style={styles.toggleDetailsText}>
                      {showDetails ? 'Masquer les détails' : 'Ajuster les détails'}
                    </Text>
                    {showDetails ? (
                      <ChevronUp size={16} color={PASTEL.textSecondary} />
                    ) : (
                      <ChevronDown size={16} color={PASTEL.textSecondary} />
                    )}
                  </TouchableOpacity>

                  {/* Detailed View (collapsed by default) */}
                  {showDetails && (
                    <>
                      {/* Food items */}
                      {analyzedFoods.map((food, index) => (
                        <FoodResultItem
                          key={index}
                          food={food}
                          isSelected={selectedFoods.has(index)}
                          onToggle={() => toggleFoodSelection(index)}
                          delay={index * 100}
                        />
                      ))}

                      {/* Global fat adjuster */}
                      <GlobalFatAdjuster
                        fatLevel={globalFatLevel}
                        onFatLevelChange={setGlobalFatLevel}
                      />

                      {/* Nutrition summary */}
                      {selectedFoods.size > 0 && (
                        <NutritionSummary
                          nutrition={totalNutrition}
                          foodCount={selectedFoods.size}
                        />
                      )}
                    </>
                  )}

                  <View style={{ height: 120 }} />
                </ScrollView>

                {/* Quick-Add Button Bar */}
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
                          Ajouter rapidement
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
    backgroundColor: PASTEL.card,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: PASTEL.border,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  foodItemSelected: {
    borderColor: PASTEL.greenDark,
    backgroundColor: PASTEL.green + '20',
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
    color: PASTEL.text,
    marginBottom: 4,
  },
  foodMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  foodWeight: {
    fontSize: 13,
    color: PASTEL.textSecondary,
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
    color: PASTEL.calories,
  },
  caloriesUnit: {
    fontSize: 11,
    color: PASTEL.textSecondary,
    marginTop: -2,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: PASTEL.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: PASTEL.card,
  },
  checkboxSelected: {
    backgroundColor: PASTEL.greenDark,
    borderColor: PASTEL.greenDark,
  },
})

// Fat adjuster styles (global)
const fatAdjusterStyles = StyleSheet.create({
  container: {
    backgroundColor: PASTEL.card,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: PASTEL.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: PASTEL.text,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: PASTEL.fats + '30',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  levelContainer: {
    alignItems: 'center',
    minWidth: 80,
  },
  levelIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  levelLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: PASTEL.text,
  },
  hint: {
    fontSize: 12,
    color: PASTEL.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
})

const summaryStyles = StyleSheet.create({
  container: {
    marginTop: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  card: {
    backgroundColor: PASTEL.card,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: PASTEL.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
    color: PASTEL.text,
  },
  grid: {
    flexDirection: 'row',
    gap: 16,
  },
  mainStat: {
    width: 90,
    backgroundColor: PASTEL.calories + '20',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
  },
  mainValue: {
    fontSize: 28,
    fontWeight: '800',
    color: PASTEL.calories,
    marginTop: 4,
  },
  mainLabel: {
    fontSize: 12,
    color: PASTEL.textSecondary,
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
    color: PASTEL.text,
  },
  macroLabel: {
    fontSize: 11,
    color: PASTEL.textSecondary,
    marginTop: 2,
  },
  footer: {
    fontSize: 12,
    color: PASTEL.textSecondary,
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
    backgroundColor: PASTEL.bg,
  },
  imageContainer: {
    height: SCREEN_HEIGHT * 0.32,
    backgroundColor: '#000000',
    overflow: 'hidden',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
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
    backgroundColor: PASTEL.bg,
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
    backgroundColor: PASTEL.green + '40',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: PASTEL.text,
  },
  resultsSubtitle: {
    fontSize: 14,
    color: PASTEL.textSecondary,
    marginTop: 2,
  },
  confirmBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 34,
    backgroundColor: PASTEL.bg,
    borderTopWidth: 1,
    borderTopColor: PASTEL.border,
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
    backgroundColor: PASTEL.card,
  },
  errorText: {
    fontSize: 15,
    color: PASTEL.text,
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

  // Quick Summary Card styles
  quickSummaryCard: {
    backgroundColor: PASTEL.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: PASTEL.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  quickSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  quickNutritionGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  quickNutritionMain: {
    alignItems: 'center',
    backgroundColor: PASTEL.calories + '20',
    borderRadius: 16,
    padding: 16,
    minWidth: 100,
  },
  quickCaloriesValue: {
    fontSize: 32,
    fontWeight: '800',
    color: PASTEL.calories,
    marginTop: 4,
  },
  quickCaloriesUnit: {
    fontSize: 13,
    color: PASTEL.textSecondary,
    marginTop: -2,
  },
  quickMacroRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickMacroItem: {
    alignItems: 'center',
  },
  quickMacroValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  quickMacroLabel: {
    fontSize: 12,
    color: PASTEL.textSecondary,
    marginTop: 2,
  },

  // Toggle Details Button
  toggleDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: PASTEL.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PASTEL.border,
    borderStyle: 'dashed',
  },
  toggleDetailsText: {
    fontSize: 14,
    color: PASTEL.textSecondary,
    fontWeight: '500',
  },
})
