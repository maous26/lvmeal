/**
 * CreditsExhaustedModal - Modal affiche quand les credits IA sont epuises
 *
 * Propose l'upgrade vers Premium avec arguments convaincants
 */

import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { X, Sparkles, Zap, Check, Crown } from 'lucide-react-native'
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

import { useTheme } from '../contexts/ThemeContext'
import { spacing, typography, radius } from '../constants/theme'
import { freemiumService } from '../services/freemium-service'

interface CreditsExhaustedModalProps {
  visible: boolean
  onClose: () => void
  featureName?: string
}

export function CreditsExhaustedModal({
  visible,
  onClose,
  featureName = 'cette fonctionnalite',
}: CreditsExhaustedModalProps) {
  const navigation = useNavigation<any>()
  const { colors } = useTheme()
  const status = freemiumService.getUserStatus()

  const handleUpgrade = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onClose()
    navigation.navigate('Paywall')
  }

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }

  const premiumBenefits = [
    'IA illimitee pour tous tes repas',
    'Scanner photo sans restriction',
    'Coach personnalise 24/7',
    'Statistiques avancees',
  ]

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Animated.View
          entering={FadeIn.duration(200)}
          style={[styles.overlayBackground]}
        />
      </Pressable>

      <View style={styles.container} pointerEvents="box-none">
        <Animated.View
          entering={SlideInDown.springify().damping(15)}
          style={[styles.modal, { backgroundColor: colors.bg.elevated }]}
        >
          {/* Close button */}
          <TouchableOpacity
            onPress={handleClose}
            style={[styles.closeButton, { backgroundColor: colors.bg.secondary }]}
          >
            <X size={20} color={colors.text.secondary} />
          </TouchableOpacity>

          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: 'rgba(200, 120, 99, 0.1)' }]}>
            <Zap size={32} color="#C87863" />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text.primary }]}>
            Credits epuises
          </Text>

          {/* Message */}
          <Text style={[styles.message, { color: colors.text.secondary }]}>
            Tu as utilise tous tes credits IA ce mois-ci.{'\n'}
            Pour continuer a utiliser {featureName}, passe a Premium.
          </Text>

          {/* Stats */}
          <View style={[styles.statsContainer, { backgroundColor: colors.bg.secondary }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.error }]}>0</Text>
              <Text style={[styles.statLabel, { color: colors.text.tertiary }]}>
                Credits restants
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border.light }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text.primary }]}>
                {status.isTrialActive ? '15' : '3'}
              </Text>
              <Text style={[styles.statLabel, { color: colors.text.tertiary }]}>
                Par mois (free)
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border.light }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#9B8BB8' }]}>∞</Text>
              <Text style={[styles.statLabel, { color: colors.text.tertiary }]}>Premium</Text>
            </View>
          </View>

          {/* Benefits */}
          <View style={styles.benefitsContainer}>
            <Text style={[styles.benefitsTitle, { color: colors.text.primary }]}>
              Avec Premium, tu as :
            </Text>
            {premiumBenefits.map((benefit, index) => (
              <View key={index} style={styles.benefitRow}>
                <View style={[styles.checkIcon, { backgroundColor: 'rgba(155, 139, 184, 0.1)' }]}>
                  <Check size={14} color="#9B8BB8" strokeWidth={3} />
                </View>
                <Text style={[styles.benefitText, { color: colors.text.secondary }]}>
                  {benefit}
                </Text>
              </View>
            ))}
          </View>

          {/* CTA */}
          <TouchableOpacity
            onPress={handleUpgrade}
            style={styles.ctaButton}
            activeOpacity={0.8}
          >
            <Crown size={20} color="#FFFFFF" />
            <Text style={styles.ctaText}>Passer a Premium</Text>
          </TouchableOpacity>

          {/* Later button */}
          <TouchableOpacity onPress={handleClose} style={styles.laterButton}>
            <Text style={[styles.laterText, { color: colors.text.tertiary }]}>
              Plus tard
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['3xl'],
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: spacing.default,
    right: spacing.default,
    width: 36,
    height: 36,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.default,
  },
  title: {
    ...typography.h3,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    padding: spacing.default,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    ...typography.h3,
    marginBottom: 2,
  },
  statLabel: {
    ...typography.caption,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  benefitsContainer: {
    width: '100%',
    marginBottom: spacing.xl,
  },
  benefitsTitle: {
    ...typography.bodyMedium,
    marginBottom: spacing.md,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitText: {
    ...typography.body,
    flex: 1,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#9B8BB8',
    width: '100%',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  ctaText: {
    ...typography.bodySemibold,
    color: '#FFFFFF',
  },
  laterButton: {
    paddingVertical: spacing.sm,
  },
  laterText: {
    ...typography.body,
  },
})

export default CreditsExhaustedModal
