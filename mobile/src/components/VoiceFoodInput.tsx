import React, { useState, useEffect } from 'react'
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
} from 'react-native'
import { Mic, MicOff, X, Check, Edit2, AlertCircle } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
// Note: expo-speech is for TTS, for STT we'll use a different approach
// For now, we'll use a text-based fallback with AI analysis

import { Card, Button, Badge } from './ui'
import { colors, spacing, typography, radius } from '../constants/theme'
import { analyzeFoodDescription, hasOpenAIApiKey, type AnalyzedFood } from '../services/ai-service'
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
  const [transcript, setTranscript] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [analyzedFoods, setAnalyzedFoods] = useState<AnalyzedFood[]>([])
  const [selectedFoods, setSelectedFoods] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const resetState = () => {
    setTranscript('')
    setIsListening(false)
    setIsAnalyzing(false)
    setIsEditing(false)
    setAnalyzedFoods([])
    setSelectedFoods(new Set())
    setError(null)
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  // Note: Real voice recognition would require native modules or a cloud service
  // For React Native, you can use:
  // - react-native-voice (native module)
  // - expo-speech for TTS only
  // - Web Speech API via WebView
  // Here we provide a text-based fallback

  const toggleListening = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    if (isListening) {
      setIsListening(false)
      // In a real implementation, stop voice recognition here
    } else {
      setIsListening(true)
      // In a real implementation, start voice recognition here
      // For now, show editing mode after a delay
      setTimeout(() => {
        setIsListening(false)
        setIsEditing(true)
      }, 2000)
    }
  }

  const handleAnalyze = async () => {
    if (!transcript.trim()) {
      Alert.alert('Texte vide', 'Veuillez decrire votre repas')
      return
    }

    // Check API key first
    const hasKey = await hasOpenAIApiKey()
    if (!hasKey) {
      Alert.alert(
        'Configuration requise',
        'Veuillez configurer votre cle API OpenAI dans les parametres pour utiliser l\'analyse vocale.',
        [{ text: 'OK' }]
      )
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setIsAnalyzing(true)
    setError(null)
    setIsEditing(false)

    try {
      const result = await analyzeFoodDescription(transcript)

      if (result.success && result.foods.length > 0) {
        setAnalyzedFoods(result.foods)
        setSelectedFoods(new Set(result.foods.map((_, i) => i)))
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      } else if (result.foods.length === 0) {
        setError('Aucun aliment identifie dans votre description')
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
      <View style={styles.container}>
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
          keyboardShouldPersistTaps="handled"
        >
          {/* Voice Button */}
          {!isEditing && analyzedFoods.length === 0 && (
            <View style={styles.voiceSection}>
              <TouchableOpacity
                style={[styles.voiceButton, isListening && styles.voiceButtonActive]}
                onPress={toggleListening}
                disabled={isAnalyzing}
              >
                {isListening ? (
                  <MicOff size={48} color="#FFFFFF" />
                ) : (
                  <Mic size={48} color={isAnalyzing ? colors.text.muted : colors.accent.primary} />
                )}
              </TouchableOpacity>

              <Text style={styles.voiceInstructions}>
                {isListening
                  ? 'Parlez maintenant...'
                  : isAnalyzing
                    ? 'Analyse en cours...'
                    : 'Appuyez pour parler'}
              </Text>

              {isListening && (
                <View style={styles.listeningIndicator}>
                  <ActivityIndicator size="small" color={colors.accent.primary} />
                  <Text style={styles.listeningText}>Ecoute...</Text>
                </View>
              )}

              {/* Fallback text input */}
              <Text style={styles.orText}>ou</Text>
              <Button
                variant="outline"
                size="default"
                onPress={() => setIsEditing(true)}
              >
                <Edit2 size={18} color={colors.accent.primary} />
                <Text style={styles.outlineButtonText}>Saisir manuellement</Text>
              </Button>
            </View>
          )}

          {/* Transcript Editor */}
          {(isEditing || transcript) && analyzedFoods.length === 0 && (
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
                autoFocus={isEditing}
              />

              <Button
                variant="primary"
                size="lg"
                fullWidth
                onPress={handleAnalyze}
                disabled={isAnalyzing || !transcript.trim()}
                style={styles.analyzeButton}
              >
                {isAnalyzing ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.buttonText}>Analyse en cours...</Text>
                  </>
                ) : (
                  <>
                    <Check size={20} color="#FFFFFF" />
                    <Text style={styles.buttonText}>Analyser</Text>
                  </>
                )}
              </Button>
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
                <Text style={styles.transcriptPreviewLabel}>Votre description:</Text>
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
    paddingBottom: spacing['3xl'],
  },
  voiceSection: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
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
    backgroundColor: colors.accent.primary,
  },
  voiceInstructions: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  listeningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  listeningText: {
    ...typography.small,
    color: colors.accent.primary,
  },
  orText: {
    ...typography.body,
    color: colors.text.muted,
    marginVertical: spacing.md,
  },
  outlineButtonText: {
    ...typography.bodyMedium,
    color: colors.accent.primary,
    marginLeft: spacing.sm,
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
    marginTop: spacing.sm,
  },
  buttonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    marginLeft: spacing.sm,
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
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
})
