/**
 * Conversation Screen - Simplified with Gifted Chat
 *
 * Uses react-native-gifted-chat for stable, proven chat UI
 * Connects to existing conversation-store for state management
 */

import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  SafeAreaView,
  Platform,
} from 'react-native'
// @ts-ignore - GiftedChat types are complex
import { GiftedChat, Bubble, InputToolbar, Send } from 'react-native-gifted-chat'
// @ts-ignore - Expo provides this at runtime
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'

import { useTheme } from '../../contexts/ThemeContext'
import { useConversationStore } from '../../stores/conversation-store'
import { useSubscriptionStore } from '../../stores/subscription-store'
import { ConversationTurn, QuickReply, UserIntent } from '../../types/conversation'

// Simplified message type for Gifted Chat
interface ChatMessage {
  _id: string
  text: string
  createdAt: Date
  user: {
    _id: string
    name: string
    avatar?: string
  }
}

// Convert our turns to Gifted Chat format
const turnsToMessages = (turns: ConversationTurn[]): ChatMessage[] => {
  return turns
    .map((turn): ChatMessage => ({
      _id: turn.id,
      text: turn.content,
      createdAt: new Date(turn.timestamp),
      user: {
        _id: turn.role === 'user' ? 'user' : 'coach',
        name: turn.role === 'user' ? 'Vous' : 'Coach LYM',
        avatar: turn.role === 'assistant' ? '🌿' : undefined,
      },
    }))
    .reverse() // Gifted Chat expects newest first
}

// Quick reply intent buttons for guided mode
const QUICK_INTENTS: Array<{ label: string; emoji: string; intent: UserIntent }> = [
  { label: "J'ai faim", emoji: '🍽️', intent: 'HUNGER' },
  { label: 'Envie de sucré', emoji: '🍫', intent: 'CRAVING' },
  { label: 'Fatigué(e)', emoji: '😴', intent: 'FATIGUE' },
  { label: 'Stressé(e)', emoji: '😰', intent: 'STRESS' },
  { label: "Où j'en suis ?", emoji: '📊', intent: 'PROGRESS_CHECK' },
  { label: 'Propose un repas', emoji: '👨‍🍳', intent: 'MEAL_SUGGESTION' },
]

export function ConversationScreen() {
  const { colors } = useTheme()
  const navigation = useNavigation()
  const isMounted = useRef(true)

  // Stores
  const {
    turns,
    isProcessing,
    sendMessage,
    sendIntent,
    canSendMessage,
    getMessagesRemaining,
  } = useConversationStore()
  const { isPremium } = useSubscriptionStore()

  // Local state
  const [showGuided, setShowGuided] = useState(turns.length === 0)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

  // Convert turns to messages
  const messages = turnsToMessages(turns)
  const messagesRemaining = getMessagesRemaining(isPremium)
  const canSend = canSendMessage(isPremium)

  // Handle sending message
  const onSend = useCallback(
    async (newMessages: ChatMessage[] = []) => {
      if (!canSend || !isMounted.current) return

      const messageText = newMessages[0]?.text
      if (!messageText) return

      setShowGuided(false)
      await sendMessage(messageText, isPremium)
    },
    [canSend, sendMessage, isPremium]
  )

  // Handle intent button press
  const handleIntentPress = useCallback(
    async (intent: UserIntent) => {
      if (!canSend || !isMounted.current) return

      setShowGuided(false)
      await sendIntent(intent, isPremium)
    },
    [canSend, sendIntent, isPremium]
  )

  // Custom bubble renderer
  const renderBubble = useCallback(
    (props: any) => (
      <Bubble
        {...props}
        wrapperStyle={{
          right: {
            backgroundColor: colors.accent.primary,
          },
          left: {
            backgroundColor: colors.bg.secondary,
          },
        }}
        textStyle={{
          right: {
            color: '#FFFFFF',
          },
          left: {
            color: colors.text.primary,
          },
        }}
      />
    ),
    [colors]
  )

  // Custom input toolbar
  const renderInputToolbar = useCallback(
    (props: any) => (
      <InputToolbar
        {...props}
        containerStyle={[
          styles.inputToolbar,
          { backgroundColor: colors.bg.primary, borderTopColor: colors.border.default },
        ]}
        primaryStyle={styles.inputPrimary}
      />
    ),
    [colors]
  )

  // Custom send button
  const renderSend = useCallback(
    (props: any) => (
      <Send {...props} containerStyle={styles.sendContainer}>
        <View
          style={[
            styles.sendButton,
            { backgroundColor: props.text ? colors.accent.primary : colors.bg.secondary },
          ]}
        >
          <Ionicons
            name="send"
            size={18}
            color={props.text ? '#FFFFFF' : colors.text.tertiary}
          />
        </View>
      </Send>
    ),
    [colors]
  )

  // Render guided mode (initial state with buttons)
  const renderGuidedMode = () => {
    if (!showGuided || messages.length > 0) return null

    return (
      <View style={styles.guidedContainer}>
        <Text style={[styles.guidedTitle, { color: colors.text.primary }]}>
          Comment je peux t'aider ?
        </Text>
        <Text style={[styles.guidedSubtitle, { color: colors.text.secondary }]}>
          Choisis une option ou écris-moi directement
        </Text>

        <View style={styles.intentGrid}>
          {QUICK_INTENTS.map((item) => (
            <TouchableOpacity
              key={item.intent}
              style={[styles.intentButton, { backgroundColor: colors.bg.secondary }]}
              onPress={() => handleIntentPress(item.intent)}
              disabled={isProcessing}
              activeOpacity={0.7}
            >
              <Text style={styles.intentEmoji}>{item.emoji}</Text>
              <Text style={[styles.intentLabel, { color: colors.text.primary }]} numberOfLines={1}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    )
  }

  // Render message limit banner
  const renderLimitBanner = () => {
    if (messagesRemaining === 'unlimited') return null

    const isLow = messagesRemaining <= 3
    const isEmpty = messagesRemaining === 0

    return (
      <View
        style={[
          styles.limitBanner,
          {
            backgroundColor: isEmpty
              ? colors.error + '20'
              : isLow
              ? colors.warning + '20'
              : colors.bg.secondary,
          },
        ]}
      >
        <Text
          style={[
            styles.limitText,
            {
              color: isEmpty
                ? colors.error
                : isLow
                ? colors.warning
                : colors.text.secondary,
            },
          ]}
        >
          {isEmpty
            ? "Limite atteinte pour aujourd'hui"
            : `${messagesRemaining} message${messagesRemaining > 1 ? 's' : ''} restant${messagesRemaining > 1 ? 's' : ''}`}
        </Text>
        {!isPremium && (
          <TouchableOpacity onPress={() => navigation.navigate('Paywall' as never)}>
            <Text style={[styles.upgradeText, { color: colors.accent.primary }]}>
              Passer Premium
            </Text>
          </TouchableOpacity>
        )}
      </View>
    )
  }

  // Render header
  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: colors.bg.primary, borderBottomColor: colors.border.default }]}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="chevron-down" size={28} color={colors.text.primary} />
      </TouchableOpacity>
      <View style={styles.headerCenter}>
        <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Coach LYM</Text>
        <Text style={[styles.headerSubtitle, { color: colors.text.tertiary }]}>
          Ton accompagnement bienveillant
        </Text>
      </View>
      <View style={styles.headerRight} />
    </View>
  )

  // Common GiftedChat props
  const chatProps = {
    user: { _id: 'user', name: 'Vous' },
    placeholder: !canSend
      ? "Limite atteinte pour aujourd'hui"
      : 'Dis-moi ce qui te passe par la tête...',
    renderBubble,
    renderInputToolbar,
    renderSend,
    alwaysShowSend: true,
    isTyping: isProcessing,
    keyboardShouldPersistTaps: 'handled' as const,
    bottomOffset: Platform.OS === 'ios' ? 0 : 0,
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      {renderHeader()}
      {renderLimitBanner()}

      {showGuided && messages.length === 0 ? (
        <View style={styles.guidedWrapper}>
          {renderGuidedMode()}
          <GiftedChat
            messages={[] as any}
            onSend={(msgs: any) => onSend(msgs)}
            {...(chatProps as any)}
            messagesContainerStyle={styles.emptyMessages}
          />
        </View>
      ) : (
        <GiftedChat
          messages={messages as any}
          onSend={(msgs: any) => onSend(msgs)}
          {...(chatProps as any)}
          listViewProps={{
            contentContainerStyle: { paddingTop: 10 },
          }}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerRight: {
    width: 36,
  },
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
  guidedWrapper: {
    flex: 1,
  },
  guidedContainer: {
    padding: 20,
    paddingTop: 40,
  },
  guidedTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  guidedSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  intentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  intentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    minWidth: '45%',
  },
  intentEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  intentLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  inputToolbar: {
    borderTopWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  inputPrimary: {
    alignItems: 'center',
  },
  sendContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
    marginBottom: 4,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyMessages: {
    flex: 0,
  },
})

export default ConversationScreen
