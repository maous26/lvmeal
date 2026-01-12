/**
 * PaywallScreen - Faux paywall qualitatif (phase test)
 *
 * Philosophie:
 * - Pas de vrai paiement pour les testeurs
 * - Collecte de feedback qualitatif sur la valeur perçue
 * - Accès gratuit maintenu après réponse
 * - Objectif: apprendre, pas monétiser
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useToast } from '../components/ui/Toast'
import { LinearGradient } from 'expo-linear-gradient'
import {
  X,
  Heart,
  Sparkles,
  Shield,
  Clock,
  ThumbsUp,
  Clock3,
  XCircle,
  MessageSquare,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { useNavigation } from '@react-navigation/native'

import { useTheme } from '../contexts/ThemeContext'
import { useOnboardingStore, SUBSCRIPTION_PRICE } from '../stores/onboarding-store'
import { useFeedbackStore, type PaywallResponse } from '../stores/feedback-store'
import { useUserStore } from '../stores/user-store'
import { fonts, spacing, radius } from '../constants/theme'

export default function PaywallScreen() {
  const navigation = useNavigation()
  const { colors } = useTheme()
  const toast = useToast()
  const { profile } = useUserStore()
  const { markPaywallSeen, getDaysSinceSignup, subscribe } = useOnboardingStore()
  const { submitPaywallFeedback, hasRespondedToPaywall } = useFeedbackStore()

  const [selectedResponse, setSelectedResponse] = useState<PaywallResponse | null>(null)
  const [customReason, setCustomReason] = useState('')
  const [showReasonInput, setShowReasonInput] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const daysSinceSignup = getDaysSinceSignup()
  const userName = profile?.firstName || 'toi'

  const responseOptions: { key: PaywallResponse; label: string; sublabel: string; icon: React.ReactNode; color: string }[] = [
    {
      key: 'would_pay',
      label: 'Je paierais pour continuer',
      sublabel: 'LYM m\'apporte de la valeur',
      icon: <ThumbsUp size={24} color={colors.success} />,
      color: colors.success,
    },
    {
      key: 'need_more_time',
      label: 'J\'ai besoin de plus de temps',
      sublabel: 'Je veux encore tester',
      icon: <Clock3 size={24} color={colors.info} />,
      color: colors.info,
    },
    {
      key: 'too_expensive',
      label: 'Le prix est trop élevé',
      sublabel: `${SUBSCRIPTION_PRICE.toFixed(2).replace('.', ',')}€/mois`,
      icon: <XCircle size={24} color={colors.warning} />,
      color: colors.warning,
    },
    {
      key: 'not_now',
      label: 'Autre raison',
      sublabel: 'Je veux préciser',
      icon: <MessageSquare size={24} color={colors.text.secondary} />,
      color: colors.text.secondary,
    },
  ]

  const handleSelectResponse = (response: PaywallResponse) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedResponse(response)
    setShowReasonInput(response === 'not_now')
  }

  const handleSubmit = async () => {
    if (!selectedResponse) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setIsSubmitting(true)

    // Submit feedback
    submitPaywallFeedback(
      selectedResponse,
      selectedResponse === 'not_now' ? customReason : undefined,
      daysSinceSignup
    )

    // Mark paywall as seen
    markPaywallSeen()

    // Give access (fake subscription for testers)
    subscribe()

    // Show thank you message
    await new Promise(resolve => setTimeout(resolve, 500))

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    toast.success('Merci ! Tu as maintenant accès complet à LYM.')

    setIsSubmitting(false)
    navigation.goBack()
  }

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // Allow close without feedback for testers
    markPaywallSeen()
    subscribe() // Give access anyway
    navigation.goBack()
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: colors.bg.secondary }]}
            onPress={handleClose}
          >
            <X size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero */}
          <View style={styles.heroSection}>
            <LinearGradient
              colors={[colors.accent.primary, colors.secondary.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroIcon}
            >
              <Heart size={40} color="#FFFFFF" />
            </LinearGradient>

            <Text style={[styles.heroTitle, { color: colors.text.primary }]}>
              {daysSinceSignup} jours ensemble
            </Text>

            <Text style={[styles.heroSubtitle, { color: colors.text.secondary }]}>
              {userName}, LYM commence à te connaître.{'\n'}
              On aimerait avoir ton avis.
            </Text>
          </View>

          {/* Context card */}
          <View style={[styles.contextCard, { backgroundColor: colors.bg.elevated }]}>
            <Text style={[styles.contextTitle, { color: colors.text.primary }]}>
              Si LYM devenait payant...
            </Text>
            <Text style={[styles.contextPrice, { color: colors.accent.primary }]}>
              {SUBSCRIPTION_PRICE.toFixed(2).replace('.', ',')} €/mois
            </Text>
            <Text style={[styles.contextNote, { color: colors.text.tertiary }]}>
              (C'est une question, pas un paiement)
            </Text>
          </View>

          {/* Response options */}
          <View style={styles.optionsSection}>
            <Text style={[styles.questionText, { color: colors.text.primary }]}>
              Quelle serait ta réaction ?
            </Text>

            {responseOptions.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.optionCard,
                  { backgroundColor: colors.bg.elevated, borderColor: colors.border.default },
                  selectedResponse === option.key && {
                    borderColor: option.color,
                    backgroundColor: option.color + '10',
                  },
                ]}
                onPress={() => handleSelectResponse(option.key)}
                activeOpacity={0.7}
              >
                <View style={[styles.optionIcon, { backgroundColor: option.color + '15' }]}>
                  {option.icon}
                </View>
                <View style={styles.optionContent}>
                  <Text style={[styles.optionLabel, { color: colors.text.primary }]}>
                    {option.label}
                  </Text>
                  <Text style={[styles.optionSublabel, { color: colors.text.tertiary }]}>
                    {option.sublabel}
                  </Text>
                </View>
                {selectedResponse === option.key && (
                  <View style={[styles.checkMark, { backgroundColor: option.color }]}>
                    <Text style={styles.checkMarkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom reason input */}
          {showReasonInput && (
            <View style={styles.reasonSection}>
              <Text style={[styles.reasonLabel, { color: colors.text.secondary }]}>
                Dis-nous en plus (optionnel)
              </Text>
              <TextInput
                style={[
                  styles.reasonInput,
                  {
                    backgroundColor: colors.bg.elevated,
                    borderColor: colors.border.default,
                    color: colors.text.primary,
                  },
                ]}
                placeholder="Ce qui manque, ce qui te bloque..."
                placeholderTextColor={colors.text.muted}
                value={customReason}
                onChangeText={setCustomReason}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          )}

          {/* Submit button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              !selectedResponse && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!selectedResponse || isSubmitting}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={
                selectedResponse
                  ? [colors.accent.primary, colors.secondary.primary]
                  : [colors.bg.secondary, colors.bg.secondary]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitGradient}
            >
              <Text
                style={[
                  styles.submitText,
                  { color: selectedResponse ? '#FFFFFF' : colors.text.muted },
                ]}
              >
                {isSubmitting ? 'Envoi...' : 'Envoyer mon avis'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Privacy note */}
          <Text style={[styles.privacyNote, { color: colors.text.muted }]}>
            Ton avis reste anonyme et nous aide à améliorer LYM.{'\n'}
            Tu garderas l'accès complet après cette question.
          </Text>

          {/* Benefits reminder */}
          <View style={[styles.benefitsCard, { backgroundColor: colors.bg.elevated }]}>
            <Text style={[styles.benefitsTitle, { color: colors.text.primary }]}>
              Ce que LYM t'apporte
            </Text>

            <View style={styles.benefitsList}>
              <BenefitItem
                icon={<Sparkles size={18} color={colors.accent.primary} />}
                text="Un coach qui s'adapte à toi"
                colors={colors}
              />
              <BenefitItem
                icon={<Heart size={18} color={colors.secondary.primary} />}
                text="Zéro culpabilité, zéro pression"
                colors={colors}
              />
              <BenefitItem
                icon={<Shield size={18} color={colors.success} />}
                text="Tes données restent privées"
                colors={colors}
              />
              <BenefitItem
                icon={<Clock size={18} color={colors.info} />}
                text="Moins de charge mentale"
                colors={colors}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// Benefit item component
function BenefitItem({
  icon,
  text,
  colors,
}: {
  icon: React.ReactNode
  text: string
  colors: ReturnType<typeof useTheme>['colors']
}) {
  return (
    <View style={styles.benefitItem}>
      <View style={[styles.benefitIcon, { backgroundColor: colors.bg.secondary }]}>
        {icon}
      </View>
      <Text style={[styles.benefitText, { color: colors.text.secondary }]}>
        {text}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  // Hero
  heroSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '700',
    fontFamily: fonts.serif.bold,
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  // Context card
  contextCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  contextTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  contextPrice: {
    fontSize: 32,
    fontWeight: '700',
    fontFamily: fonts.serif.bold,
  },
  contextNote: {
    fontSize: 13,
    marginTop: 4,
  },
  // Options
  optionsSection: {
    marginBottom: 20,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: fonts.serif.semibold,
    marginBottom: 16,
    textAlign: 'center',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 2,
    marginBottom: 12,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionContent: {
    flex: 1,
    marginLeft: 14,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  optionSublabel: {
    fontSize: 13,
  },
  checkMark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMarkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  // Reason input
  reasonSection: {
    marginBottom: 20,
  },
  reasonLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  reasonInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    fontSize: 15,
    minHeight: 80,
  },
  // Submit
  submitButton: {
    marginBottom: 12,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitGradient: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
  },
  // Privacy
  privacyNote: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  // Benefits
  benefitsCard: {
    borderRadius: 16,
    padding: 20,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: fonts.serif.semibold,
    marginBottom: 16,
  },
  benefitsList: {
    gap: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
})
