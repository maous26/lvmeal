/**
 * FeedbackButton - Bouton flottant pour envoyer des commentaires/bugs
 *
 * Disponible sur tous les écrans via FeedbackProvider.
 * Envoie les feedbacks par email à moussaoulare@orange.fr
 */

import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Keyboard,
  ScrollView,
} from 'react-native'
import { MessageCircle, X, Send, Bug, Lightbulb, Check } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme } from '../../contexts/ThemeContext'
import { spacing, typography, radius, shadows, fonts, componentSizes } from '../../constants/theme'

// Email destinataire
const FEEDBACK_EMAIL = 'moussaoulare@orange.fr'

// Types de feedback
type FeedbackType = 'bug' | 'suggestion' | 'other'

interface FeedbackButtonProps {
  /** Position du bouton (bottom offset) */
  bottomOffset?: number
}

export function FeedbackButton({ bottomOffset = 100 }: FeedbackButtonProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const [modalVisible, setModalVisible] = useState(false)
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('suggestion')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const scaleAnim = useRef(new Animated.Value(1)).current

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start()
    setModalVisible(true)
  }

  const handleClose = () => {
    Keyboard.dismiss()
    setModalVisible(false)
    // Reset après fermeture
    setTimeout(() => {
      setMessage('')
      setEmail('')
      setSent(false)
      setFeedbackType('suggestion')
    }, 300)
  }

  const handleSend = async () => {
    if (!message.trim()) return

    setSending(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    try {
      // Préparer le contenu de l'email
      const subject = encodeURIComponent(
        feedbackType === 'bug'
          ? '🐛 [LYM Bug Report]'
          : feedbackType === 'suggestion'
            ? '💡 [LYM Suggestion]'
            : '📝 [LYM Feedback]'
      )

      const body = encodeURIComponent(
        `Type: ${feedbackType === 'bug' ? 'Bug' : feedbackType === 'suggestion' ? 'Suggestion' : 'Autre'}\n\n` +
        `Message:\n${message}\n\n` +
        `${email ? `Email de contact: ${email}\n\n` : ''}` +
        `---\n` +
        `Envoyé depuis l'app LYM\n` +
        `Date: ${new Date().toLocaleString('fr-FR')}\n` +
        `Platform: ${Platform.OS} ${Platform.Version}`
      )

      // Utiliser l'API mailto pour ouvrir le client email
      const mailtoUrl = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`

      // Sur mobile, on peut aussi envoyer via une API backend
      // Pour l'instant, on simule l'envoi et on ouvre le client mail
      const { Linking } = await import('react-native')
      const canOpen = await Linking.canOpenURL(mailtoUrl)

      if (canOpen) {
        await Linking.openURL(mailtoUrl)
        setSent(true)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        setTimeout(handleClose, 1500)
      } else {
        // Fallback: copier dans le presse-papier
        const { Clipboard } = await import('react-native')
        if (Clipboard?.setString) {
          Clipboard.setString(`${FEEDBACK_EMAIL}\n\nSujet: ${decodeURIComponent(subject)}\n\n${decodeURIComponent(body)}`)
        }
        setSent(true)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        setTimeout(handleClose, 1500)
      }
    } catch (error) {
      console.error('[Feedback] Error sending:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setSending(false)
    }
  }

  const typeOptions: { type: FeedbackType; icon: React.ReactNode; label: string }[] = [
    { type: 'bug', icon: <Bug size={18} color={feedbackType === 'bug' ? colors.text.inverse : colors.text.secondary} />, label: 'Bug' },
    { type: 'suggestion', icon: <Lightbulb size={18} color={feedbackType === 'suggestion' ? colors.text.inverse : colors.text.secondary} />, label: 'Idée' },
    { type: 'other', icon: <MessageCircle size={18} color={feedbackType === 'other' ? colors.text.inverse : colors.text.secondary} />, label: 'Autre' },
  ]

  return (
    <>
      {/* Bouton flottant */}
      <Animated.View
        style={[
          styles.floatingButton,
          {
            bottom: bottomOffset + insets.bottom,
            backgroundColor: colors.accent.primary,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <TouchableOpacity
          onPress={handlePress}
          style={styles.buttonInner}
          activeOpacity={0.8}
        >
          <MessageCircle size={24} color={colors.text.inverse} />
        </TouchableOpacity>
      </Animated.View>

      {/* Modal de feedback */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={handleClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={handleClose}
          />

          <View style={[styles.modalContent, { backgroundColor: colors.bg.elevated }]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text.primary }]}>
                Ton feedback
              </Text>
              <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={24} color={colors.text.tertiary} />
              </TouchableOpacity>
            </View>

            {sent ? (
              // État envoyé
              <View style={styles.sentContainer}>
                <View style={[styles.sentIcon, { backgroundColor: '#7A9E7E' }]}>
                  <Check size={32} color="#FFFFFF" />
                </View>
                <Text style={[styles.sentTitle, { color: colors.text.primary }]}>
                  Merci ! 🙏
                </Text>
                <Text style={[styles.sentMessage, { color: colors.text.secondary }]}>
                  Ton message a été préparé. Continue avec ton app email.
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Type de feedback */}
                <Text style={[styles.label, { color: colors.text.secondary }]}>
                  Type de feedback
                </Text>
                <View style={styles.typeSelector}>
                  {typeOptions.map((option) => (
                    <TouchableOpacity
                      key={option.type}
                      style={[
                        styles.typeOption,
                        {
                          backgroundColor:
                            feedbackType === option.type
                              ? colors.accent.primary
                              : colors.bg.tertiary,
                        },
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync()
                        setFeedbackType(option.type)
                      }}
                    >
                      {option.icon}
                      <Text
                        style={[
                          styles.typeLabel,
                          {
                            color:
                              feedbackType === option.type
                                ? colors.text.inverse
                                : colors.text.secondary,
                          },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Message */}
                <Text style={[styles.label, { color: colors.text.secondary }]}>
                  Ton message *
                </Text>
                <TextInput
                  style={[
                    styles.messageInput,
                    {
                      backgroundColor: colors.bg.secondary,
                      color: colors.text.primary,
                      borderColor: colors.border.default,
                    },
                  ]}
                  placeholder={
                    feedbackType === 'bug'
                      ? "Décris le problème rencontré..."
                      : feedbackType === 'suggestion'
                        ? "Partage ton idée..."
                        : "Ton message..."
                  }
                  placeholderTextColor={colors.text.muted}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                  value={message}
                  onChangeText={setMessage}
                  maxLength={1000}
                />
                <Text style={[styles.charCount, { color: colors.text.muted }]}>
                  {message.length}/1000
                </Text>

                {/* Email optionnel */}
                <Text style={[styles.label, { color: colors.text.secondary }]}>
                  Ton email (optionnel)
                </Text>
                <TextInput
                  style={[
                    styles.emailInput,
                    {
                      backgroundColor: colors.bg.secondary,
                      color: colors.text.primary,
                      borderColor: colors.border.default,
                    },
                  ]}
                  placeholder="Pour qu'on puisse te répondre"
                  placeholderTextColor={colors.text.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />

                {/* Bouton envoyer */}
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    {
                      backgroundColor: message.trim()
                        ? colors.accent.primary
                        : colors.bg.tertiary,
                    },
                  ]}
                  onPress={handleSend}
                  disabled={!message.trim() || sending}
                >
                  {sending ? (
                    <ActivityIndicator color={colors.text.inverse} />
                  ) : (
                    <>
                      <Send size={20} color={message.trim() ? colors.text.inverse : colors.text.muted} />
                      <Text
                        style={[
                          styles.sendButtonText,
                          {
                            color: message.trim()
                              ? colors.text.inverse
                              : colors.text.muted,
                          },
                        ]}
                      >
                        Envoyer
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <Text style={[styles.disclaimer, { color: colors.text.muted }]}>
                  Ton feedback nous aide à améliorer LYM. Merci ! 💚
                </Text>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    right: spacing.default,
    width: 56,
    height: 56,
    borderRadius: 28,
    ...shadows.lg,
    zIndex: 1000,
  },
  buttonInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContent: {
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: fonts.serif.semibold,
    fontWeight: '600',
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  typeLabel: {
    ...typography.small,
    fontWeight: '600',
  },
  messageInput: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    minHeight: 120,
    ...typography.body,
  },
  charCount: {
    ...typography.xs,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  emailInput: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...typography.body,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.lg,
  },
  sendButtonText: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  disclaimer: {
    ...typography.xs,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  sentContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  sentIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sentTitle: {
    fontSize: 20,
    fontFamily: fonts.serif.semibold,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  sentMessage: {
    ...typography.body,
    textAlign: 'center',
  },
})

export default FeedbackButton
