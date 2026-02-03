/**
 * Conversation Screen - Main Coach Interface
 *
 * Combines:
 * - Guided Mode (buttons) for Free users
 * - Free Mode (text input) for Premium users
 * - Hybrid Mode (default) with toggle
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  View,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useTheme } from '../../contexts/ThemeContext'
import { useConversationStore } from '../../stores/conversation-store'
import { useSubscriptionStore } from '../../stores/subscription-store'
import {
  GuidedMode,
  MessageBubble,
  FreeModeInput,
  MessageLimitBanner,
  FeedbackButtons,
} from './ConversationUI'
import { ConversationTurn, QuickReply, ConversationAction } from '../../types/conversation'
import { conversationActionService } from '../../services/conversation-action-service'
import { conversationContextService } from '../../services/conversation-context-service'

type ConversationMode = 'guided' | 'free' | 'hybrid'

export function ConversationScreen() {
  const { colors } = useTheme()
  const navigation = useNavigation<any>()
  const flatListRef = useRef<FlatList>(null)

  // Stores
  const {
    turns,
    isProcessing,
    sendMessage,
    sendIntent,
    canSendMessage,
    getMessagesRemaining,
    trackFeedback,
    getContext,
  } = useConversationStore()
  const { isPremium } = useSubscriptionStore()

  // Local state
  const [mode, setMode] = useState<ConversationMode>('hybrid')
  const [showGuided, setShowGuided] = useState(true)

  // Compute messages remaining
  const messagesRemaining = getMessagesRemaining(isPremium)
  const canSend = canSendMessage(isPremium)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (turns.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true })
      }, 100)
    }
  }, [turns.length])

  // Handle free text message
  const handleSendMessage = useCallback(async (message: string) => {
    if (!canSend) return
    setShowGuided(false)
    await sendMessage(message, isPremium)
  }, [canSend, sendMessage, isPremium])

  // Handle intent button press
  const handleIntentPress = useCallback(async (intent: any) => {
    if (!canSend) return
    setShowGuided(false)
    await sendIntent(intent, isPremium)
  }, [canSend, sendIntent, isPremium])

  // Handle quick reply press
  const handleQuickReply = useCallback(async (reply: QuickReply) => {
    if (reply.intent) {
      await handleIntentPress(reply.intent)
    } else if (reply.action) {
      // Execute action directly
      const context = getContext()
      const action: ConversationAction = {
        type: reply.action,
        label: reply.label,
        params: reply.params || {},
        requiresConfirmation: false,
        isPremium: false,
      }
      const result = await conversationActionService.executeAction(action, context)
      if (result.success && result.result) {
        handleActionResult(result.result as any)
      }
    }
  }, [handleIntentPress, getContext])

  // Handle action button press
  const handleActionPress = useCallback(async (action: ConversationAction) => {
    const context = getContext()

    // If requires confirmation, could show a modal here
    if (action.requiresConfirmation) {
      // For now, just execute
      console.log('[ConversationScreen] Action requires confirmation:', action.type)
    }

    const result = await conversationActionService.executeAction(action, context)
    if (result.success && result.result) {
      handleActionResult(result.result as any)
    }
  }, [getContext])

  // Handle action result (navigation, etc.)
  const handleActionResult = (result: { action: string; screen?: string; params?: any }) => {
    if (result.action === 'navigate' && result.screen) {
      navigation.navigate(result.screen, result.params)
    }
  }

  // Handle upgrade press
  const handleUpgrade = () => {
    navigation.navigate('Paywall')
  }

  // Render message item
  const renderMessage = ({ item, index }: { item: ConversationTurn; index: number }) => {
    const isLastAssistant = item.role === 'assistant' && index === turns.length - 1

    return (
      <View>
        <MessageBubble
          turn={item}
          onActionPress={handleActionPress}
          onQuickReplyPress={handleQuickReply}
        />

        {/* Show feedback buttons on last assistant message */}
        {isLastAssistant && !isProcessing && (
          <FeedbackButtons onFeedback={trackFeedback} />
        )}
      </View>
    )
  }

  // Render empty state (guided mode)
  const renderEmptyState = () => {
    if (!showGuided) return null

    return (
      <GuidedMode
        onSwitchToFree={isPremium ? () => setShowGuided(false) : undefined}
      />
    )
  }

  // Render typing indicator
  const renderTypingIndicator = () => {
    if (!isProcessing) return null

    return (
      <View style={[styles.typingContainer, { backgroundColor: colors.background.secondary }]}>
        <ActivityIndicator size="small" color={colors.accent.primary} />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background.primary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Message limit banner */}
      <MessageLimitBanner
        remaining={messagesRemaining}
        isPremium={isPremium}
        onUpgrade={handleUpgrade}
      />

      {/* Messages list */}
      <FlatList
        ref={flatListRef}
        data={turns}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.messageList,
          turns.length === 0 && styles.emptyList,
        ]}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderTypingIndicator}
        showsVerticalScrollIndicator={false}
      />

      {/* Input area */}
      {(mode === 'free' || mode === 'hybrid') && !showGuided && (
        <FreeModeInput
          onSend={handleSendMessage}
          onSwitchToGuided={() => setShowGuided(true)}
          disabled={isProcessing || !canSend}
          placeholder={
            !canSend
              ? 'Limite atteinte pour aujourd\'hui'
              : 'Dis-moi ce qui te passe par la tête...'
          }
        />
      )}

      {/* Show guided mode button when in conversation */}
      {!showGuided && turns.length > 0 && mode === 'hybrid' && (
        <View style={styles.bottomButtons}>
          {/* Could add a floating button to show guided mode again */}
        </View>
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messageList: {
    padding: 16,
    paddingBottom: 8,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  typingContainer: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    marginVertical: 4,
  },
  bottomButtons: {
    position: 'absolute',
    bottom: 80,
    right: 16,
  },
})

export default ConversationScreen
