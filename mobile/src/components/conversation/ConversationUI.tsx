/**
 * Conversation UI Components
 *
 * Implements:
 * - Guided Mode (intent buttons)
 * - Message Bubbles
 * - Diagnosis Toggle (Recommendation #5)
 * - Quick Replies
 * - Action Buttons
 */

import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StyleSheet,
  Animated,
  Keyboard,
  ActivityIndicator,
  Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../contexts/ThemeContext'
import {
  ConversationTurn,
  ConversationResponse,
  UserIntent,
  QuickReply,
  ConversationAction,
  DiagnosisFactor,
  InfoCard,
} from '../../types/conversation'
import { useConversationStore } from '../../stores/conversation-store'
import { useSubscriptionStore } from '../../stores/subscription-store'
import { conversationActionService } from '../../services/conversation-action-service'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

// ============================================================================
// GUIDED MODE (Intent Buttons)
// ============================================================================

interface IntentButtonConfig {
  label: string
  icon: string
  intent: UserIntent
  color?: string
}

interface IntentCategory {
  title: string
  buttons: IntentButtonConfig[]
}

const INTENT_CATEGORIES: IntentCategory[] = [
  {
    title: 'Comment tu te sens ?',
    buttons: [
      { label: "J'ai faim", icon: '🍽️', intent: 'HUNGER' },
      { label: 'Envie de sucré', icon: '🍫', intent: 'CRAVING' },
      { label: 'Fatigué(e)', icon: '😴', intent: 'FATIGUE' },
    ],
  },
  {
    title: 'État émotionnel',
    buttons: [
      { label: 'Stressé(e)', icon: '😰', intent: 'STRESS' },
      { label: 'Démotivé(e)', icon: '😔', intent: 'DOUBT' },
      { label: 'Content(e) !', icon: '🎉', intent: 'CELEBRATION' },
    ],
  },
  {
    title: 'Actions',
    buttons: [
      { label: 'Où j\'en suis ?', icon: '📊', intent: 'PROGRESS_CHECK' },
      { label: 'Propose un repas', icon: '👨‍🍳', intent: 'MEAL_SUGGESTION' },
      { label: 'Un défi !', icon: '🎯', intent: 'CHALLENGE_START' },
    ],
  },
]

interface GuidedModeProps {
  onSwitchToFree?: () => void
}

export function GuidedMode({ onSwitchToFree }: GuidedModeProps) {
  const { colors } = useTheme()
  const { sendIntent, isProcessing } = useConversationStore()
  const { isPremium } = useSubscriptionStore()

  const handleIntentPress = async (intent: UserIntent) => {
    await sendIntent(intent, isPremium)
  }

  return (
    <View style={styles.guidedContainer}>
      <Text style={[styles.guidedTitle, { color: colors.text.primary }]}>
        Comment je peux t'aider ?
      </Text>

      {INTENT_CATEGORIES.map((category) => (
        <View key={category.title} style={styles.categoryContainer}>
          <Text style={[styles.categoryTitle, { color: colors.text.secondary }]}>
            {category.title}
          </Text>
          <View style={styles.buttonRow}>
            {category.buttons.map((button) => (
              <TouchableOpacity
                key={button.intent}
                style={[
                  styles.intentButton,
                  { backgroundColor: colors.bg.secondary },
                ]}
                onPress={() => handleIntentPress(button.intent)}
                disabled={isProcessing}
                activeOpacity={0.7}
              >
                <Text style={styles.intentIcon}>{button.icon}</Text>
                <Text
                  style={[styles.intentLabel, { color: colors.text.primary }]}
                  numberOfLines={1}
                >
                  {button.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      {onSwitchToFree && (
        <TouchableOpacity
          style={styles.switchModeButton}
          onPress={onSwitchToFree}
        >
          <Text style={[styles.switchModeText, { color: colors.accent.primary }]}>
            Écrire un message libre
          </Text>
          <Ionicons name="chatbubble-outline" size={16} color={colors.accent.primary} />
        </TouchableOpacity>
      )}
    </View>
  )
}

// ============================================================================
// MESSAGE BUBBLE
// ============================================================================

interface MessageBubbleProps {
  turn: ConversationTurn
  onDiagnosisToggle?: () => void
  onActionPress?: (action: ConversationAction) => void
  onQuickReplyPress?: (reply: QuickReply) => void
}

export function MessageBubble({
  turn,
  onDiagnosisToggle,
  onActionPress,
  onQuickReplyPress,
}: MessageBubbleProps) {
  const { colors } = useTheme()
  const isUser = turn.role === 'user'
  const [showDiagnosis, setShowDiagnosis] = useState(false)
  const { trackDiagnosisViewed } = useConversationStore()

  const handleDiagnosisToggle = () => {
    if (!showDiagnosis) {
      trackDiagnosisViewed()
    }
    setShowDiagnosis(!showDiagnosis)
    onDiagnosisToggle?.()
  }

  return (
    <View
      style={[
        styles.messageBubbleContainer,
        isUser ? styles.userBubbleContainer : styles.assistantBubbleContainer,
      ]}
    >
      <View
        style={[
          styles.messageBubble,
          isUser
            ? [styles.userBubble, { backgroundColor: colors.accent.primary }]
            : [styles.assistantBubble, { backgroundColor: colors.bg.secondary }],
        ]}
      >
        {/* Message text */}
        <Text
          style={[
            styles.messageText,
            { color: isUser ? '#FFFFFF' : colors.text.primary },
          ]}
        >
          {turn.response?.message.emoji && !isUser && `${turn.response.message.emoji} `}
          {turn.content}
        </Text>

        {/* Disclaimer if present */}
        {turn.response?.disclaimer && (
          <Text style={[styles.disclaimer, { color: colors.text.tertiary }]}>
            {turn.response.disclaimer}
          </Text>
        )}
      </View>

      {/* Assistant-specific elements */}
      {!isUser && turn.response && (
        <>
          {/* Diagnosis toggle (Recommendation #5) */}
          {turn.response.ui?.showDiagnosisToggle && turn.response.diagnosis && (
            <TouchableOpacity
              style={styles.diagnosisToggle}
              onPress={handleDiagnosisToggle}
            >
              <Text style={[styles.diagnosisToggleText, { color: colors.accent.primary }]}>
                {showDiagnosis ? 'Masquer le détail' : 'Pourquoi ?'}
              </Text>
              <Ionicons
                name={showDiagnosis ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={colors.accent.primary}
              />
            </TouchableOpacity>
          )}

          {/* Diagnosis content */}
          {showDiagnosis && turn.response.diagnosis && (
            <DiagnosisCard diagnosis={turn.response.diagnosis} />
          )}

          {/* Actions */}
          {turn.response.actions.length > 0 && (
            <View style={styles.actionsContainer}>
              {turn.response.actions.map((action, index) => (
                <ActionButton
                  key={`${action.type}-${index}`}
                  action={action}
                  onPress={() => onActionPress?.(action)}
                />
              ))}
            </View>
          )}

          {/* Rich UI Cards */}
          {turn.response.ui?.cards && turn.response.ui.cards.length > 0 && (
            <CardsContainer
              cards={turn.response.ui.cards}
              onAction={(action, params) => {
                // Convert card action to ConversationAction format
                const actionObj: ConversationAction = {
                  type: action as any,
                  label: action,
                  params: params || {},
                  requiresConfirmation: false,
                  isPremium: false,
                }
                onActionPress?.(actionObj)
              }}
            />
          )}

          {/* Quick replies */}
          {turn.response.ui?.quickReplies && turn.response.ui.quickReplies.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.quickRepliesContainer}
              contentContainerStyle={styles.quickRepliesContent}
            >
              {turn.response.ui.quickReplies.map((reply, index) => (
                <QuickReplyChip
                  key={`${reply.label}-${index}`}
                  reply={reply}
                  onPress={() => onQuickReplyPress?.(reply)}
                />
              ))}
            </ScrollView>
          )}
        </>
      )}
    </View>
  )
}

// ============================================================================
// DIAGNOSIS CARD (Recommendation #5)
// ============================================================================

interface DiagnosisCardProps {
  diagnosis: {
    summary: string
    factors: DiagnosisFactor[]
    confidence: number
    dataPoints: string[]
  }
}

function DiagnosisCard({ diagnosis }: DiagnosisCardProps) {
  const { colors } = useTheme()

  const getImpactColor = (impact: DiagnosisFactor['impact']) => {
    switch (impact) {
      case 'high': return colors.semantic.error
      case 'medium': return colors.semantic.warning
      case 'low': return colors.text.tertiary
    }
  }

  return (
    <View style={[styles.diagnosisCard, { backgroundColor: colors.bg.tertiary }]}>
      <Text style={[styles.diagnosisSummary, { color: colors.text.secondary }]}>
        {diagnosis.summary}
      </Text>

      {diagnosis.factors.map((factor, index) => (
        <View key={index} style={styles.factorRow}>
          <View style={[styles.factorDot, { backgroundColor: getImpactColor(factor.impact) }]} />
          <Text style={[styles.factorLabel, { color: colors.text.secondary }]}>
            {factor.label}
          </Text>
          <Text style={[styles.factorValue, { color: colors.text.primary }]}>
            {factor.value}
          </Text>
        </View>
      ))}

      {diagnosis.dataPoints.length > 0 && (
        <Text style={[styles.dataPoints, { color: colors.text.tertiary }]}>
          Sources : {diagnosis.dataPoints.join(', ')}
        </Text>
      )}
    </View>
  )
}

// ============================================================================
// ACTION BUTTON
// ============================================================================

interface ActionButtonProps {
  action: ConversationAction
  onPress: () => void
}

function ActionButton({ action, onPress }: ActionButtonProps) {
  const { colors } = useTheme()

  return (
    <TouchableOpacity
      style={[
        styles.actionButton,
        { backgroundColor: colors.accent.primary },
        action.isPremium && styles.premiumActionButton,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={styles.actionButtonText}>{action.label}</Text>
      {action.isPremium && (
        <View style={styles.premiumBadge}>
          <Ionicons name="star" size={10} color="#FFD700" />
        </View>
      )}
    </TouchableOpacity>
  )
}

// ============================================================================
// QUICK REPLY CHIP
// ============================================================================

interface QuickReplyChipProps {
  reply: QuickReply
  onPress: () => void
}

function QuickReplyChip({ reply, onPress }: QuickReplyChipProps) {
  const { colors } = useTheme()

  return (
    <TouchableOpacity
      style={[styles.quickReplyChip, { borderColor: colors.border.default }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.quickReplyText, { color: colors.text.primary }]}>
        {reply.label}
      </Text>
    </TouchableOpacity>
  )
}

// ============================================================================
// FREE MODE INPUT
// ============================================================================

interface FreeModeInputProps {
  onSend: (message: string) => void
  onSwitchToGuided?: () => void
  disabled?: boolean
  placeholder?: string
}

export function FreeModeInput({
  onSend,
  onSwitchToGuided,
  disabled,
  placeholder = 'Dis-moi ce qui te passe par la tête...',
}: FreeModeInputProps) {
  const { colors } = useTheme()
  const [input, setInput] = useState('')
  const inputRef = useRef<TextInput>(null)

  const handleSend = () => {
    if (input.trim() && !disabled) {
      onSend(input.trim())
      setInput('')
      Keyboard.dismiss()
    }
  }

  return (
    <View style={[styles.inputContainer, { backgroundColor: colors.bg.primary }]}>
      {onSwitchToGuided && (
        <TouchableOpacity
          style={styles.guidedModeButton}
          onPress={onSwitchToGuided}
        >
          <Ionicons name="apps-outline" size={20} color={colors.text.tertiary} />
        </TouchableOpacity>
      )}

      <TextInput
        ref={inputRef}
        style={[
          styles.textInput,
          { backgroundColor: colors.bg.secondary, color: colors.text.primary },
        ]}
        value={input}
        onChangeText={setInput}
        placeholder={placeholder}
        placeholderTextColor={colors.text.tertiary}
        multiline
        maxLength={500}
        editable={!disabled}
        returnKeyType="send"
        onSubmitEditing={handleSend}
      />

      <TouchableOpacity
        style={[
          styles.sendButton,
          { backgroundColor: input.trim() ? colors.accent.primary : colors.bg.secondary },
        ]}
        onPress={handleSend}
        disabled={!input.trim() || disabled}
      >
        {disabled ? (
          <ActivityIndicator size="small" color={colors.text.tertiary} />
        ) : (
          <Ionicons
            name="send"
            size={18}
            color={input.trim() ? '#FFFFFF' : colors.text.tertiary}
          />
        )}
      </TouchableOpacity>
    </View>
  )
}

// ============================================================================
// MESSAGE LIMIT BANNER
// ============================================================================

interface MessageLimitBannerProps {
  remaining: number | 'unlimited'
  isPremium: boolean
  onUpgrade?: () => void
}

export function MessageLimitBanner({ remaining, isPremium, onUpgrade }: MessageLimitBannerProps) {
  const { colors } = useTheme()

  if (remaining === 'unlimited') return null

  const isLow = remaining <= 3
  const isEmpty = remaining === 0

  return (
    <View
      style={[
        styles.limitBanner,
        {
          backgroundColor: isEmpty
            ? colors.semantic.error + '20'
            : isLow
            ? colors.semantic.warning + '20'
            : colors.bg.secondary,
        },
      ]}
    >
      <Text
        style={[
          styles.limitText,
          {
            color: isEmpty
              ? colors.semantic.error
              : isLow
              ? colors.semantic.warning
              : colors.text.secondary,
          },
        ]}
      >
        {isEmpty
          ? 'Limite atteinte pour aujourd\'hui'
          : `${remaining} message${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''} aujourd'hui`}
      </Text>

      {!isPremium && (
        <TouchableOpacity onPress={onUpgrade}>
          <Text style={[styles.upgradeText, { color: colors.accent.primary }]}>
            Passer Premium
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

// ============================================================================
// FEEDBACK BUTTONS
// ============================================================================

interface FeedbackButtonsProps {
  onFeedback: (positive: boolean) => void
}

export function FeedbackButtons({ onFeedback }: FeedbackButtonsProps) {
  const { colors } = useTheme()
  const [given, setGiven] = useState<boolean | null>(null)

  const handleFeedback = (positive: boolean) => {
    setGiven(positive)
    onFeedback(positive)
  }

  if (given !== null) {
    return (
      <Text style={[styles.feedbackThanks, { color: colors.text.tertiary }]}>
        Merci pour ton retour !
      </Text>
    )
  }

  return (
    <View style={styles.feedbackContainer}>
      <Text style={[styles.feedbackLabel, { color: colors.text.tertiary }]}>
        Cette réponse t'a aidé ?
      </Text>
      <TouchableOpacity
        style={styles.feedbackButton}
        onPress={() => handleFeedback(true)}
      >
        <Ionicons name="thumbs-up-outline" size={18} color={colors.text.tertiary} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.feedbackButton}
        onPress={() => handleFeedback(false)}
      >
        <Ionicons name="thumbs-down-outline" size={18} color={colors.text.tertiary} />
      </TouchableOpacity>
    </View>
  )
}

// ============================================================================
// RICH UI CARDS
// ============================================================================

interface RichCardProps {
  card: InfoCard
  onAction?: (action: string, params?: Record<string, unknown>) => void
}

export function RichCard({ card, onAction }: RichCardProps) {
  switch (card.type) {
    case 'meal_preview':
      return <MealPreviewCard data={card.data} onAction={onAction} />
    case 'correlation_insight':
      return <CorrelationInsightCard data={card.data} />
    case 'progress_chart':
      return <ProgressChartCard data={card.data} />
    case 'challenge_preview':
      return <ChallengePreviewCard data={card.data} onAction={onAction} />
    default:
      return null
  }
}

// ============================================================================
// MEAL PREVIEW CARD
// ============================================================================

interface MealPreviewCardProps {
  data: Record<string, unknown>
  onAction?: (action: string, params?: Record<string, unknown>) => void
}

function MealPreviewCard({ data, onAction }: MealPreviewCardProps) {
  const { colors } = useTheme()

  const mealName = data.name as string || 'Suggestion de repas'
  const calories = data.calories as number || 0
  const proteins = data.proteins as number || 0
  const carbs = data.carbs as number || 0
  const fats = data.fats as number || 0
  const prepTime = data.prepTime as number || 15
  const ingredients = data.ingredients as string[] || []
  const mealType = data.mealType as string || 'repas'
  const tags = data.tags as string[] || []

  const handleLogMeal = () => {
    onAction?.('LOG_MEAL_QUICK', { name: mealName, calories, proteins, carbs, fats })
  }

  const handleViewRecipe = () => {
    onAction?.('NAVIGATE_TO', { screen: 'Recipe', params: { mealId: data.id } })
  }

  return (
    <View style={[styles.richCard, { backgroundColor: colors.bg.secondary }]}>
      {/* Header */}
      <View style={styles.mealCardHeader}>
        <Text style={styles.mealIcon}>🍽️</Text>
        <View style={styles.mealCardHeaderText}>
          <Text style={[styles.mealCardTitle, { color: colors.text.primary }]} numberOfLines={1}>
            {mealName}
          </Text>
          <Text style={[styles.mealCardSubtitle, { color: colors.text.tertiary }]}>
            {mealType} • {prepTime} min
          </Text>
        </View>
      </View>

      {/* Macros */}
      <View style={styles.macrosContainer}>
        <View style={styles.macroItem}>
          <Text style={[styles.macroValue, { color: colors.accent.primary }]}>{calories}</Text>
          <Text style={[styles.macroLabel, { color: colors.text.tertiary }]}>kcal</Text>
        </View>
        <View style={[styles.macroDivider, { backgroundColor: colors.border.default }]} />
        <View style={styles.macroItem}>
          <Text style={[styles.macroValue, { color: colors.semantic.success }]}>{proteins}g</Text>
          <Text style={[styles.macroLabel, { color: colors.text.tertiary }]}>prot.</Text>
        </View>
        <View style={[styles.macroDivider, { backgroundColor: colors.border.default }]} />
        <View style={styles.macroItem}>
          <Text style={[styles.macroValue, { color: colors.semantic.warning }]}>{carbs}g</Text>
          <Text style={[styles.macroLabel, { color: colors.text.tertiary }]}>gluc.</Text>
        </View>
        <View style={[styles.macroDivider, { backgroundColor: colors.border.default }]} />
        <View style={styles.macroItem}>
          <Text style={[styles.macroValue, { color: colors.text.secondary }]}>{fats}g</Text>
          <Text style={[styles.macroLabel, { color: colors.text.tertiary }]}>lip.</Text>
        </View>
      </View>

      {/* Tags */}
      {tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {tags.slice(0, 3).map((tag, index) => (
            <View key={index} style={[styles.tag, { backgroundColor: colors.bg.tertiary }]}>
              <Text style={[styles.tagText, { color: colors.text.secondary }]}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Ingredients preview */}
      {ingredients.length > 0 && (
        <Text style={[styles.ingredientsPreview, { color: colors.text.tertiary }]} numberOfLines={2}>
          {ingredients.slice(0, 4).join(' • ')}{ingredients.length > 4 ? ' ...' : ''}
        </Text>
      )}

      {/* Actions */}
      <View style={styles.mealCardActions}>
        <TouchableOpacity
          style={[styles.mealCardButton, { backgroundColor: colors.bg.tertiary }]}
          onPress={handleViewRecipe}
        >
          <Ionicons name="book-outline" size={16} color={colors.text.primary} />
          <Text style={[styles.mealCardButtonText, { color: colors.text.primary }]}>Voir recette</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mealCardButton, styles.mealCardPrimaryButton, { backgroundColor: colors.accent.primary }]}
          onPress={handleLogMeal}
        >
          <Ionicons name="add-circle-outline" size={16} color="#FFFFFF" />
          <Text style={[styles.mealCardButtonText, { color: '#FFFFFF' }]}>Ajouter</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ============================================================================
// CORRELATION INSIGHT CARD
// ============================================================================

interface CorrelationInsightCardProps {
  data: Record<string, unknown>
}

function CorrelationInsightCard({ data }: CorrelationInsightCardProps) {
  const { colors } = useTheme()

  const title = data.title as string || 'Corrélation détectée'
  const description = data.description as string || ''
  const correlationType = data.type as string || 'general'
  const confidence = data.confidence as number || 0.7
  const factor1 = data.factor1 as { label: string; value: string } || { label: '', value: '' }
  const factor2 = data.factor2 as { label: string; value: string } || { label: '', value: '' }
  const trend = data.trend as 'positive' | 'negative' | 'neutral' || 'neutral'
  const source = data.source as string || 'LYM'

  const getCorrelationIcon = () => {
    switch (correlationType) {
      case 'sleep_nutrition': return '😴'
      case 'stress_eating': return '😰'
      case 'energy_pattern': return '⚡'
      default: return '🔗'
    }
  }

  const getTrendColor = () => {
    switch (trend) {
      case 'positive': return colors.semantic.success
      case 'negative': return colors.semantic.error
      default: return colors.text.secondary
    }
  }

  const getTrendIcon = () => {
    switch (trend) {
      case 'positive': return 'trending-up'
      case 'negative': return 'trending-down'
      default: return 'swap-horizontal'
    }
  }

  return (
    <View style={[styles.richCard, { backgroundColor: colors.bg.secondary }]}>
      {/* Header */}
      <View style={styles.correlationHeader}>
        <View style={[styles.correlationIconContainer, { backgroundColor: getTrendColor() + '20' }]}>
          <Text style={styles.correlationIcon}>{getCorrelationIcon()}</Text>
        </View>
        <View style={styles.correlationHeaderText}>
          <Text style={[styles.correlationTitle, { color: colors.text.primary }]}>{title}</Text>
          <View style={styles.confidenceRow}>
            <Text style={[styles.confidenceText, { color: colors.text.tertiary }]}>
              Confiance : {Math.round(confidence * 100)}%
            </Text>
            <Text style={[styles.sourceText, { color: colors.text.tertiary }]}> • {source}</Text>
          </View>
        </View>
      </View>

      {/* Correlation visualization */}
      <View style={styles.correlationVisualization}>
        <View style={styles.correlationFactor}>
          <Text style={[styles.factorLabelSmall, { color: colors.text.tertiary }]}>{factor1.label}</Text>
          <Text style={[styles.factorValueLarge, { color: colors.text.primary }]}>{factor1.value}</Text>
        </View>

        <View style={[styles.correlationArrow, { backgroundColor: getTrendColor() + '20' }]}>
          <Ionicons name={getTrendIcon() as any} size={20} color={getTrendColor()} />
        </View>

        <View style={styles.correlationFactor}>
          <Text style={[styles.factorLabelSmall, { color: colors.text.tertiary }]}>{factor2.label}</Text>
          <Text style={[styles.factorValueLarge, { color: colors.text.primary }]}>{factor2.value}</Text>
        </View>
      </View>

      {/* Description */}
      {description && (
        <Text style={[styles.correlationDescription, { color: colors.text.secondary }]}>
          {description}
        </Text>
      )}
    </View>
  )
}

// ============================================================================
// PROGRESS CHART CARD
// ============================================================================

interface ProgressChartCardProps {
  data: Record<string, unknown>
}

function ProgressChartCard({ data }: ProgressChartCardProps) {
  const { colors } = useTheme()

  const title = data.title as string || 'Ta progression'
  const period = data.period as string || '7 jours'
  const currentValue = data.currentValue as number || 0
  const targetValue = data.targetValue as number || 100
  const unit = data.unit as string || ''
  const trend = data.trend as 'up' | 'down' | 'stable' || 'stable'
  const trendPercent = data.trendPercent as number || 0
  const chartData = data.chartData as number[] || []
  const streak = data.streak as number || 0

  const progress = Math.min(100, Math.round((currentValue / targetValue) * 100))

  const getTrendColor = () => {
    switch (trend) {
      case 'up': return colors.semantic.success
      case 'down': return colors.semantic.error
      default: return colors.text.secondary
    }
  }

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return 'trending-up'
      case 'down': return 'trending-down'
      default: return 'remove'
    }
  }

  // Simple bar chart visualization
  const maxValue = Math.max(...chartData, targetValue)
  const barHeights = chartData.map(v => Math.max(4, (v / maxValue) * 40))

  return (
    <View style={[styles.richCard, { backgroundColor: colors.bg.secondary }]}>
      {/* Header */}
      <View style={styles.progressHeader}>
        <View>
          <Text style={[styles.progressTitle, { color: colors.text.primary }]}>{title}</Text>
          <Text style={[styles.progressPeriod, { color: colors.text.tertiary }]}>{period}</Text>
        </View>
        {streak > 0 && (
          <View style={[styles.streakBadge, { backgroundColor: colors.accent.primary + '20' }]}>
            <Text style={styles.streakIcon}>🔥</Text>
            <Text style={[styles.streakText, { color: colors.accent.primary }]}>{streak}j</Text>
          </View>
        )}
      </View>

      {/* Main value */}
      <View style={styles.progressValueContainer}>
        <Text style={[styles.progressValue, { color: colors.text.primary }]}>
          {currentValue}
          <Text style={[styles.progressUnit, { color: colors.text.tertiary }]}> {unit}</Text>
        </Text>
        <View style={styles.trendContainer}>
          <Ionicons name={getTrendIcon() as any} size={16} color={getTrendColor()} />
          <Text style={[styles.trendText, { color: getTrendColor() }]}>
            {trendPercent > 0 ? '+' : ''}{trendPercent}%
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBarBg, { backgroundColor: colors.bg.tertiary }]}>
          <View
            style={[
              styles.progressBarFill,
              {
                backgroundColor: progress >= 100 ? colors.semantic.success : colors.accent.primary,
                width: `${Math.min(100, progress)}%`,
              },
            ]}
          />
        </View>
        <Text style={[styles.progressPercent, { color: colors.text.tertiary }]}>
          {progress}% de {targetValue} {unit}
        </Text>
      </View>

      {/* Mini chart */}
      {chartData.length > 0 && (
        <View style={styles.miniChartContainer}>
          {barHeights.map((height, index) => (
            <View
              key={index}
              style={[
                styles.miniBar,
                {
                  height,
                  backgroundColor: index === barHeights.length - 1 ? colors.accent.primary : colors.bg.tertiary,
                },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  )
}

// ============================================================================
// CHALLENGE PREVIEW CARD
// ============================================================================

interface ChallengePreviewCardProps {
  data: Record<string, unknown>
  onAction?: (action: string, params?: Record<string, unknown>) => void
}

function ChallengePreviewCard({ data, onAction }: ChallengePreviewCardProps) {
  const { colors } = useTheme()

  const challengeName = data.name as string || 'Nouveau défi'
  const description = data.description as string || ''
  const duration = data.duration as string || '7 jours'
  const difficulty = data.difficulty as 'easy' | 'medium' | 'hard' || 'medium'
  const xpReward = data.xpReward as number || 100
  const category = data.category as string || 'nutrition'
  const isPremium = data.isPremium as boolean || false
  const progress = data.progress as number || 0
  const isActive = data.isActive as boolean || false

  const getDifficultyColor = () => {
    switch (difficulty) {
      case 'easy': return colors.semantic.success
      case 'hard': return colors.semantic.error
      default: return colors.semantic.warning
    }
  }

  const getDifficultyLabel = () => {
    switch (difficulty) {
      case 'easy': return 'Facile'
      case 'hard': return 'Difficile'
      default: return 'Moyen'
    }
  }

  const getCategoryIcon = () => {
    switch (category) {
      case 'nutrition': return '🥗'
      case 'hydration': return '💧'
      case 'wellness': return '🧘'
      case 'sport': return '🏃'
      case 'sleep': return '😴'
      default: return '🎯'
    }
  }

  const handleStart = () => {
    onAction?.('START_CHALLENGE', { challengeId: data.id })
  }

  return (
    <View style={[styles.richCard, { backgroundColor: colors.bg.secondary }]}>
      {/* Header */}
      <View style={styles.challengeHeader}>
        <View style={[styles.challengeIconContainer, { backgroundColor: getDifficultyColor() + '20' }]}>
          <Text style={styles.challengeIcon}>{getCategoryIcon()}</Text>
        </View>
        <View style={styles.challengeHeaderText}>
          <View style={styles.challengeTitleRow}>
            <Text style={[styles.challengeTitle, { color: colors.text.primary }]} numberOfLines={1}>
              {challengeName}
            </Text>
            {isPremium && (
              <View style={[styles.premiumBadgeSmall, { backgroundColor: '#FFD700' + '30' }]}>
                <Ionicons name="star" size={10} color="#FFD700" />
              </View>
            )}
          </View>
          <View style={styles.challengeMeta}>
            <Text style={[styles.challengeDuration, { color: colors.text.tertiary }]}>
              {duration}
            </Text>
            <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor() + '20' }]}>
              <Text style={[styles.difficultyText, { color: getDifficultyColor() }]}>
                {getDifficultyLabel()}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Description */}
      {description && (
        <Text style={[styles.challengeDescription, { color: colors.text.secondary }]} numberOfLines={2}>
          {description}
        </Text>
      )}

      {/* Progress (if active) */}
      {isActive && (
        <View style={styles.challengeProgressContainer}>
          <View style={[styles.challengeProgressBg, { backgroundColor: colors.bg.tertiary }]}>
            <View
              style={[
                styles.challengeProgressFill,
                { backgroundColor: colors.accent.primary, width: `${progress}%` },
              ]}
            />
          </View>
          <Text style={[styles.challengeProgressText, { color: colors.text.tertiary }]}>
            {progress}% accompli
          </Text>
        </View>
      )}

      {/* Footer */}
      <View style={styles.challengeFooter}>
        <View style={styles.xpRewardContainer}>
          <Text style={styles.xpIcon}>⚡</Text>
          <Text style={[styles.xpReward, { color: colors.accent.primary }]}>+{xpReward} XP</Text>
        </View>

        {!isActive && (
          <TouchableOpacity
            style={[styles.startChallengeButton, { backgroundColor: colors.accent.primary }]}
            onPress={handleStart}
          >
            <Text style={styles.startChallengeText}>Relever le défi</Text>
            <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

// ============================================================================
// CARDS CONTAINER (renders multiple cards)
// ============================================================================

interface CardsContainerProps {
  cards: InfoCard[]
  onAction?: (action: string, params?: Record<string, unknown>) => void
}

export function CardsContainer({ cards, onAction }: CardsContainerProps) {
  if (!cards || cards.length === 0) return null

  return (
    <View style={styles.cardsContainer}>
      {cards.map((card, index) => (
        <RichCard key={`card-${index}`} card={card} onAction={onAction} />
      ))}
    </View>
  )
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  // Guided Mode
  guidedContainer: {
    padding: 16,
  },
  guidedTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  categoryContainer: {
    marginBottom: 16,
  },
  categoryTitle: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  intentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    minWidth: (SCREEN_WIDTH - 48) / 3 - 8,
  },
  intentIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  intentLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  switchModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 6,
  },
  switchModeText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Message Bubble
  messageBubbleContainer: {
    marginVertical: 4,
    maxWidth: '85%',
  },
  userBubbleContainer: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  assistantBubbleContainer: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  messageBubble: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  disclaimer: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },

  // Diagnosis
  diagnosisToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  diagnosisToggleText: {
    fontSize: 13,
    fontWeight: '500',
  },
  diagnosisCard: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
  },
  diagnosisSummary: {
    fontSize: 12,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  factorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  factorLabel: {
    fontSize: 13,
    flex: 1,
  },
  factorValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  dataPoints: {
    fontSize: 11,
    marginTop: 8,
  },

  // Actions
  actionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  premiumActionButton: {
    paddingRight: 10,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  premiumBadge: {
    marginLeft: 6,
  },

  // Quick Replies
  quickRepliesContainer: {
    marginTop: 10,
  },
  quickRepliesContent: {
    gap: 8,
  },
  quickReplyChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  quickReplyText: {
    fontSize: 13,
  },

  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  guidedModeButton: {
    padding: 10,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 8,
    fontSize: 15,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Limit Banner
  limitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  limitText: {
    fontSize: 13,
  },
  upgradeText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Feedback
  feedbackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  feedbackLabel: {
    fontSize: 12,
  },
  feedbackButton: {
    padding: 4,
  },
  feedbackThanks: {
    fontSize: 12,
    marginTop: 8,
  },

  // Rich Cards Container
  cardsContainer: {
    marginTop: 10,
    gap: 10,
  },

  // Rich Card Base
  richCard: {
    borderRadius: 16,
    padding: 14,
    marginTop: 8,
  },

  // Meal Preview Card
  mealCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  mealCardHeaderText: {
    flex: 1,
  },
  mealCardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  mealCardSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  macrosContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  macroItem: {
    flex: 1,
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  macroLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  macroDivider: {
    width: 1,
    height: 24,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '500',
  },
  ingredientsPreview: {
    fontSize: 12,
    marginTop: 10,
    lineHeight: 18,
  },
  mealCardActions: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 10,
  },
  mealCardButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  mealCardPrimaryButton: {},
  mealCardButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Correlation Insight Card
  correlationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  correlationIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  correlationIcon: {
    fontSize: 22,
  },
  correlationHeaderText: {
    flex: 1,
  },
  correlationTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  confidenceRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  confidenceText: {
    fontSize: 11,
  },
  sourceText: {
    fontSize: 11,
  },
  correlationVisualization: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingHorizontal: 10,
  },
  correlationFactor: {
    flex: 1,
    alignItems: 'center',
  },
  factorLabelSmall: {
    fontSize: 11,
    marginBottom: 4,
  },
  factorValueLarge: {
    fontSize: 18,
    fontWeight: '700',
  },
  correlationArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
  },
  correlationDescription: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 14,
  },

  // Progress Chart Card
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  progressTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  progressPeriod: {
    fontSize: 12,
    marginTop: 2,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  streakIcon: {
    fontSize: 12,
  },
  streakText: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 12,
  },
  progressValue: {
    fontSize: 32,
    fontWeight: '700',
  },
  progressUnit: {
    fontSize: 14,
    fontWeight: '400',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    gap: 4,
  },
  trendText: {
    fontSize: 13,
    fontWeight: '600',
  },
  progressBarContainer: {
    marginTop: 14,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressPercent: {
    fontSize: 11,
    marginTop: 6,
  },
  miniChartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 14,
    height: 44,
    gap: 3,
  },
  miniBar: {
    flex: 1,
    borderRadius: 2,
    minHeight: 4,
  },

  // Challenge Preview Card
  challengeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  challengeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  challengeIcon: {
    fontSize: 22,
  },
  challengeHeaderText: {
    flex: 1,
  },
  challengeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  challengeTitle: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  premiumBadgeSmall: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  challengeDuration: {
    fontSize: 12,
  },
  difficultyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  difficultyText: {
    fontSize: 10,
    fontWeight: '600',
  },
  challengeDescription: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },
  challengeProgressContainer: {
    marginTop: 14,
  },
  challengeProgressBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  challengeProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  challengeProgressText: {
    fontSize: 11,
    marginTop: 4,
  },
  challengeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  xpRewardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  xpIcon: {
    fontSize: 14,
  },
  xpReward: {
    fontSize: 14,
    fontWeight: '700',
  },
  startChallengeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    gap: 4,
  },
  startChallengeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
})
