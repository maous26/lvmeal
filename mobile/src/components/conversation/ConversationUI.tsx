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
                  { backgroundColor: colors.background.secondary },
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
            : [styles.assistantBubble, { backgroundColor: colors.background.secondary }],
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
    <View style={[styles.diagnosisCard, { backgroundColor: colors.background.tertiary }]}>
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
    <View style={[styles.inputContainer, { backgroundColor: colors.background.primary }]}>
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
          { backgroundColor: colors.background.secondary, color: colors.text.primary },
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
          { backgroundColor: input.trim() ? colors.accent.primary : colors.background.secondary },
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
            : colors.background.secondary,
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
})
