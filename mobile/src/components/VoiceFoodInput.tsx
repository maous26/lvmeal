import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Animated,
  Easing,
} from 'react-native'
import { X, Check, Edit2, AlertCircle, Mic, MicOff } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import Constants from 'expo-constants'

// Check if running in Expo Go (native modules not available)
// appOwnership: 'expo' = Expo Go, 'standalone' or null = production build
const isExpoGo = Constants.appOwnership === 'expo'

console.log('[VoiceFoodInput] appOwnership:', Constants.appOwnership)
console.log('[VoiceFoodInput] isExpoGo:', isExpoGo)

// Conditionally import expo-speech-recognition
let ExpoSpeechRecognitionModule: any = null
let useSpeechRecognitionEvent: (event: string, callback: (e: any) => void) => void = () => {}

// Always try to load the module in production builds
if (!isExpoGo) {
  try {
    const speechModule = require('expo-speech-recognition')
    ExpoSpeechRecognitionModule = speechModule.ExpoSpeechRecognitionModule
    useSpeechRecognitionEvent = speechModule.useSpeechRecognitionEvent
    console.log('[VoiceFoodInput] Speech module loaded:', !!ExpoSpeechRecognitionModule)
  } catch (e) {
    console.warn('[VoiceFoodInput] expo-speech-recognition not available:', e)
  }
} else {
  console.log('[VoiceFoodInput] Skipping speech module load (Expo Go)')
}

import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Card, Button, Badge } from './ui'
import { colors, spacing, typography, radius } from '../constants/theme'
import { analyzeFoodDescription, hasOpenAIApiKey, type AnalyzedFood } from '../services/ai-service'
import { analytics } from '../services/analytics-service'
import { errorReporting } from '../services/error-reporting-service'
import type { FoodItem, NutritionInfo } from '../types'

interface VoiceFoodInputProps {
  visible: boolean
  onClose: () => void
  onFoodsDetected: (foods: FoodItem[]) => void
}

export default function VoiceFoodInput({
  visible,
  onClose,
  onFoodsDetected,
}: VoiceFoodInputProps) {
  const insets = useSafeAreaInsets()
  const [transcript, setTranscript] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [analyzedFoods, setAnalyzedFoods] = useState<AnalyzedFood[]>([])
  const [selectedFoods, setSelectedFoods] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [partialTranscript, setPartialTranscript] = useState('')
  const [speechAvailable, setSpeechAvailable] = useState<boolean | null>(null)

  // Animation for progress bar
  const progressAnim = useRef(new Animated.Value(0)).current
  const pulseAnim = useRef(new Animated.Value(1)).current

  // Animate progress bar when analyzing
  useEffect(() => {
    if (isAnalyzing) {
      // Reset and start progress animation
      progressAnim.setValue(0)
      Animated.timing(progressAnim, {
        toValue: 0.9,
        duration: 3000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start()

      // Pulse animation for the icon
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      )
      pulse.start()

      return () => pulse.stop()
    } else {
      // Complete the progress bar
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start()
    }
  }, [isAnalyzing])

  // Check speech recognition availability on mount
  useEffect(() => {
    checkSpeechAvailability()
  }, [])

  const checkSpeechAvailability = () => {
    console.log('[VoiceFoodInput] checkSpeechAvailability called')
    console.log('[VoiceFoodInput] isExpoGo:', isExpoGo)
    console.log('[VoiceFoodInput] ExpoSpeechRecognitionModule:', !!ExpoSpeechRecognitionModule)

    // In Expo Go, speech recognition is not available
    if (isExpoGo || !ExpoSpeechRecognitionModule) {
      console.log('[VoiceFoodInput] Speech not available: isExpoGo or no module')
      setSpeechAvailable(false)
      return
    }
    try {
      const available = ExpoSpeechRecognitionModule.isRecognitionAvailable()
      console.log('[VoiceFoodInput] isRecognitionAvailable:', available)
      setSpeechAvailable(available)
    } catch (e) {
      console.log('[VoiceFoodInput] isRecognitionAvailable error:', e)
      setSpeechAvailable(false)
    }
  }

  // Speech recognition event handlers
  useSpeechRecognitionEvent('start', () => {
    setIsListening(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  })

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false)
  })

  useSpeechRecognitionEvent('result', (event) => {
    if (event.isFinal) {
      const finalText = event.results[0]?.transcript || ''
      setTranscript((prev) => (prev ? `${prev} ${finalText}` : finalText))
      setPartialTranscript('')
    } else {
      setPartialTranscript(event.results[0]?.transcript || '')
    }
  })

  useSpeechRecognitionEvent('error', (event) => {
    console.log('[VoiceFoodInput] Speech error:', event.error)
    setIsListening(false)
    if (event.error !== 'no-speech') {
      setError(`Erreur de reconnaissance: ${event.message || event.error}`)
    }
  })

  const resetState = () => {
    setTranscript('')
    setPartialTranscript('')
    setIsAnalyzing(false)
    setIsEditing(false)
    setIsListening(false)
    setAnalyzedFoods([])
    setSelectedFoods(new Set())
    setError(null)
  }

  const handleClose = () => {
    if (isListening) {
      ExpoSpeechRecognitionModule.stop()
    }
    resetState()
    onClose()
  }

  // Start/stop voice recognition
  const toggleListening = useCallback(async () => {
    if (isListening) {
      await ExpoSpeechRecognitionModule.stop()
      setIsListening(false)
    } else {
      try {
        // Request permissions if needed
        const permissionResult = await ExpoSpeechRecognitionModule.requestPermissionsAsync()
        if (!permissionResult.granted) {
          Alert.alert(
            'Permission requise',
            'Autorisez l\'accès au microphone pour utiliser la saisie vocale.',
            [{ text: 'OK' }]
          )
          return
        }

        // Start recognition with French language
        ExpoSpeechRecognitionModule.start({
          lang: 'fr-FR',
          interimResults: true,
          continuous: true,
        })
      } catch (err) {
        console.log('[VoiceFoodInput] Start error:', err)
        setError('Impossible de démarrer la reconnaissance vocale')
      }
    }
  }, [isListening])

  const isDevMode = !speechAvailable

  const handleAnalyze = async () => {
    if (!transcript.trim()) {
      Alert.alert('Texte vide', 'Décris ton repas')
      return
    }

    // Check API key first
    const hasKey = await hasOpenAIApiKey()
    if (!hasKey) {
      Alert.alert(
        'Configuration requise',
        'Configure ta clé API OpenAI dans les paramètres pour utiliser l\'analyse vocale.',
        [{ text: 'OK' }]
      )
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setIsAnalyzing(true)
    setError(null)
    setIsEditing(false)
    const startTime = Date.now()

    // Track voice input started
    analytics.track('voice_input_started')

    try {
      const result = await analyzeFoodDescription(transcript)
      const durationMs = Date.now() - startTime

      if (result.success && result.foods.length > 0) {
        setAnalyzedFoods(result.foods)
        setSelectedFoods(new Set(result.foods.map((_, i) => i)))
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        analytics.trackAIFeature('voice_input', true, durationMs, {
          foods_count: result.foods.length,
        })
      } else if (result.foods.length === 0) {
        setError('Aucun aliment identifié dans ta description')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        analytics.trackAIFeature('voice_input', false, durationMs, {
          error_type: 'no_foods_detected',
        })
      } else {
        setError(result.error || 'Erreur lors de l\'analyse')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        analytics.trackAIFeature('voice_input', false, durationMs, {
          error_type: 'analysis_failed',
        })
      }
    } catch (err) {
      const durationMs = Date.now() - startTime
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      errorReporting.captureFeatureError('voice_input', err)
      analytics.trackAIFeature('voice_input', false, durationMs, {
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

  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    const foods: FoodItem[] = Array.from(selectedFoods).map(index => {
      const food = analyzedFoods[index]
      return {
        id: `voice-${Date.now()}-${index}`,
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
        source: 'voice',
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

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <X size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Saisie vocale</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="always"
        >
          {/* Voice Input Section - Only show if speech is available */}
          {!isEditing && analyzedFoods.length === 0 && speechAvailable !== false && (
            <View style={styles.voiceSection}>
              {/* Dev mode banner - only show if speech not available */}
              {isDevMode && speechAvailable === false && (
                <View style={styles.devBanner}>
                  <Text style={styles.devBannerIcon}>🧪</Text>
                  <View style={styles.devBannerContent}>
                    <Text style={styles.devBannerTitle}>Mode développement</Text>
                    <Text style={styles.devBannerText}>
                      La reconnaissance vocale nécessite un build natif. Utilise la saisie texte.
                    </Text>
                  </View>
                </View>
              )}

              {/* Real voice input when available */}
              {speechAvailable ? (
                <>
                  <TouchableOpacity
                    style={[
                      styles.voiceButton,
                      isListening && styles.voiceButtonActive,
                    ]}
                    onPress={toggleListening}
                    disabled={isAnalyzing}
                  >
                    {isListening ? (
                      <MicOff size={48} color="#FFFFFF" />
                    ) : (
                      <Mic size={48} color={colors.accent.primary} />
                    )}
                  </TouchableOpacity>

                  {isListening && (
                    <View style={styles.listeningIndicator}>
                      <View style={styles.listeningDot} />
                      <Text style={styles.listeningText}>Écoute en cours...</Text>
                    </View>
                  )}

                  {/* Live transcript display */}
                  {(transcript || partialTranscript) && (
                    <View style={styles.liveTranscript}>
                      <Text style={styles.liveTranscriptText}>
                        {transcript}
                        {partialTranscript && (
                          <Text style={styles.partialTranscriptText}> {partialTranscript}</Text>
                        )}
                      </Text>
                    </View>
                  )}

                  <Text style={styles.voiceInstructions}>
                    {isListening ? 'Parle maintenant' : 'Appuie pour parler'}
                  </Text>

                  {transcript && !isListening && (
                    <View style={styles.actionButtonsContainer}>
                      <TouchableOpacity
                        style={styles.analyzeButton}
                        onPress={handleAnalyze}
                        activeOpacity={0.8}
                      >
                        <Check size={20} color="#FFFFFF" />
                        <Text style={styles.analyzeButtonText}>Analyser mon repas</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => setIsEditing(true)}
                        activeOpacity={0.8}
                      >
                        <Edit2 size={16} color={colors.accent.primary} />
                        <Text style={styles.editButtonText}>Modifier le texte</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              ) : (
                <>
                  {/* Fallback to text input when speech not available */}
                  <TouchableOpacity
                    style={styles.voiceButton}
                    onPress={() => setIsEditing(true)}
                    disabled={isAnalyzing}
                  >
                    <Edit2 size={48} color={colors.accent.primary} />
                  </TouchableOpacity>

                  <Text style={styles.voiceInstructions}>
                    Décris ton repas
                  </Text>
                </>
              )}

              <Text style={styles.exampleText}>
                Ex: "J'ai mangé un sandwich poulet avec une salade et un café"
              </Text>
            </View>
          )}

          {/* Transcript Editor - Show when editing mode OR speech not available */}
          {(isEditing || speechAvailable === false) && (
            <View style={styles.transcriptSection}>
              <Text style={styles.sectionTitle}>Description du repas</Text>
              <TextInput
                style={styles.transcriptInput}
                value={transcript}
                onChangeText={setTranscript}
                placeholder="Ex: J'ai mange un sandwich au poulet avec une salade et un jus d'orange..."
                placeholderTextColor={colors.text.muted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                autoFocus={isEditing || speechAvailable === false}
                returnKeyType="done"
                blurOnSubmit={true}
              />
              {/* Bouton Analyser visible dans la section texte */}
              {transcript.trim() && !isAnalyzing && analyzedFoods.length === 0 && (
                <TouchableOpacity
                  style={styles.analyzeButton}
                  onPress={handleAnalyze}
                  activeOpacity={0.8}
                >
                  <Check size={20} color="#FFFFFF" />
                  <Text style={styles.analyzeButtonText}>Analyser mon repas</Text>
                </TouchableOpacity>
              )}
              {/* Bouton pour valider la modification et revenir (mode vocal) */}
              {isEditing && speechAvailable && (
                <TouchableOpacity
                  style={styles.validateEditButton}
                  onPress={() => setIsEditing(false)}
                >
                  <Check size={18} color={colors.accent.primary} />
                  <Text style={styles.validateEditText}>Valider la modification</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Error */}
          {error && (
            <Card style={styles.errorCard}>
              <AlertCircle size={24} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
              <Button
                variant="outline"
                size="sm"
                onPress={() => {
                  setError(null)
                  setIsEditing(true)
                }}
              >
                <Text style={styles.retryText}>Modifier</Text>
              </Button>
            </Card>
          )}

          {/* Results */}
          {analyzedFoods.length > 0 && (
            <>
              <View style={styles.transcriptPreview}>
                <Text style={styles.transcriptPreviewLabel}>Ta description:</Text>
                <Text style={styles.transcriptPreviewText}>{transcript}</Text>
                <TouchableOpacity
                  onPress={() => {
                    setAnalyzedFoods([])
                    setIsEditing(true)
                  }}
                >
                  <Text style={styles.editLink}>Modifier</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.resultsTitle}>
                {analyzedFoods.length} aliment{analyzedFoods.length > 1 ? 's' : ''} identifie{analyzedFoods.length > 1 ? 's' : ''}
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

        {/* Bottom Action Bar - Always visible */}
        <View style={[styles.confirmBar, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
          {isAnalyzing ? (
            /* Loading during analysis - Pro animated progress */
            <View style={styles.analysisContainer}>
              <View style={styles.analysisHeader}>
                <Animated.View style={[styles.analysisIconContainer, { transform: [{ scale: pulseAnim }] }]}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </Animated.View>
                <View style={styles.analysisTextContainer}>
                  <Text style={styles.analysisTitle}>Analyse IA en cours</Text>
                  <Text style={styles.analysisSubtitle}>Identification des aliments...</Text>
                </View>
              </View>
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBg}>
                  <Animated.View
                    style={[
                      styles.progressBarFill,
                      {
                        width: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          ) : analyzedFoods.length > 0 ? (
            /* After analysis - Add button */
            <Button
              variant="success"
              size="lg"
              fullWidth
              onPress={handleConfirm}
              disabled={selectedFoods.size === 0}
              icon={<Check size={20} color="#FFFFFF" />}
              style={{ backgroundColor: colors.success }}
            >
              Ajouter le repas
            </Button>
          ) : transcript.trim() ? (
            /* Has transcript - Analyze button */
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onPress={handleAnalyze}
              icon={<Check size={20} color="#FFFFFF" />}
            >
              Analyser
            </Button>
          ) : (
            /* No transcript yet */
            <Text style={styles.hintText}>Décris ton repas pour commencer</Text>
          )}
        </View>
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
    padding: spacing.default,
    paddingTop: Platform.OS === 'ios' ? 60 : spacing.default,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerTitle: {
    ...typography.h4,
    color: colors.text.primary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.default,
    paddingBottom: 120,
  },
  voiceSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  devBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
    marginBottom: spacing.xl,
    width: '100%',
  },
  devBannerIcon: {
    fontSize: 20,
  },
  devBannerContent: {
    flex: 1,
  },
  devBannerTitle: {
    ...typography.smallMedium,
    color: colors.warning,
    marginBottom: 2,
  },
  devBannerText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  voiceButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.accent.light,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  voiceButtonActive: {
    backgroundColor: colors.error,
  },
  listeningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  listeningDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.error,
  },
  listeningText: {
    ...typography.small,
    color: colors.error,
  },
  liveTranscript: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    width: '100%',
    minHeight: 60,
  },
  liveTranscriptText: {
    ...typography.body,
    color: colors.text.primary,
  },
  partialTranscriptText: {
    color: colors.text.muted,
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    width: '100%',
  },
  actionButtonsContainer: {
    flexDirection: 'column',
    gap: spacing.md,
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.default,
    width: '100%',
  },
  voiceInstructions: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  exampleText: {
    ...typography.small,
    color: colors.text.muted,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingHorizontal: spacing.lg,
  },
  transcriptSection: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    ...typography.smallMedium,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  transcriptInput: {
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: spacing.md,
    minHeight: 120,
    marginBottom: spacing.md,
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  analyzeButtonText: {
    ...typography.button,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: spacing.xs,
  },
  editButtonText: {
    ...typography.body,
    color: colors.accent.primary,
    fontSize: 14,
  },
  textModeAnalyzeButton: {
    marginTop: spacing.sm,
  },
  validateEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  validateEditText: {
    ...typography.bodyMedium,
    color: colors.accent.primary,
  },
  errorCard: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
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
  transcriptPreview: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  transcriptPreviewLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  transcriptPreviewText: {
    ...typography.body,
    color: colors.text.primary,
    fontStyle: 'italic',
  },
  editLink: {
    ...typography.small,
    color: colors.accent.primary,
    marginTop: spacing.sm,
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
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.bg.primary,
  },
  hintText: {
    ...typography.body,
    color: colors.text.muted,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  analysisContainer: {
    backgroundColor: colors.accent.primary,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  analysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  analysisIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analysisTextContainer: {
    flex: 1,
  },
  analysisTitle: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  analysisSubtitle: {
    ...typography.small,
    color: 'rgba(255,255,255,0.8)',
  },
  progressBarContainer: {
    width: '100%',
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
  },
  analysisContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  analysisText: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: colors.border.light,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    width: '60%',
    height: '100%',
    backgroundColor: colors.accent.primary,
    borderRadius: 2,
  },
})
