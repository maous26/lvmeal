/**
 * Setup Choice Step - After Marketing Slides
 *
 * Allows user to choose between quick setup (2min) or full personalization (5min)
 */

import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Zap, Sparkles, Clock, ChevronRight } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { useTheme } from '../../contexts/ThemeContext'
import { spacing, radius, typography, shadows } from '../../constants/theme'

interface StepSetupChoiceProps {
  onQuickSetup: () => void
  onFullSetup: () => void
}

export function StepSetupChoice({ onQuickSetup, onFullSetup }: StepSetupChoiceProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()

  const handleQuick = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onQuickSetup()
  }

  const handleFull = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onFullSetup()
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      {/* Logo */}
      <View style={[styles.logoContainer, { paddingTop: insets.top + spacing.xl }]}>
        <Image
          source={require('../../../logo1.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Title - Welcoming message */}
      <View style={styles.titleContainer}>
        <Text style={[styles.welcomeTitle, { color: colors.text.primary }]}>
          Bienvenue.
        </Text>
        <Text style={[styles.welcomeMessage, { color: colors.text.secondary }]}>
          Ici, tu n'as rien a reussir.{'\n'}
          Juste a avancer, a ton rythme.
        </Text>
        <Text style={[styles.welcomeSubtext, { color: colors.text.tertiary }]}>
          On commencera simplement, quand tu voudras.
        </Text>
        <Text style={[styles.questionText, { color: colors.text.primary }]}>
          Que veux-tu faire maintenant ?
        </Text>
      </View>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {/* Quick Setup */}
        <TouchableOpacity
          style={[styles.optionCard, { backgroundColor: colors.bg.elevated, borderColor: colors.border.light }]}
          onPress={handleQuick}
          activeOpacity={0.8}
        >
          <View style={[styles.optionIcon, { backgroundColor: colors.warning + '20' }]}>
            <Zap size={28} color={colors.warning} />
          </View>
          <View style={styles.optionContent}>
            <Text style={[styles.optionTitle, { color: colors.text.primary }]}>
              Express
            </Text>
            <View style={styles.timeRow}>
              <Clock size={14} color={colors.text.tertiary} />
              <Text style={[styles.timeText, { color: colors.text.tertiary }]}>
                2 min
              </Text>
            </View>
            <Text style={[styles.optionDescription, { color: colors.text.secondary }]}>
              L'essentiel pour démarrer rapidement
            </Text>
          </View>
          <ChevronRight size={24} color={colors.text.tertiary} />
        </TouchableOpacity>

        {/* Full Setup - Recommended */}
        <TouchableOpacity
          style={[
            styles.optionCard,
            styles.optionCardHighlight,
            { backgroundColor: colors.accent.primary + '10', borderColor: colors.accent.primary }
          ]}
          onPress={handleFull}
          activeOpacity={0.8}
        >
          <View style={styles.recommendedBadge}>
            <Text style={[styles.recommendedText, { color: colors.accent.primary }]}>
              Recommandé
            </Text>
          </View>
          <View style={[styles.optionIcon, { backgroundColor: colors.accent.light }]}>
            <Sparkles size={28} color={colors.accent.primary} />
          </View>
          <View style={styles.optionContent}>
            <Text style={[styles.optionTitle, { color: colors.text.primary }]}>
              Personnalisé
            </Text>
            <View style={styles.timeRow}>
              <Clock size={14} color={colors.text.tertiary} />
              <Text style={[styles.timeText, { color: colors.text.tertiary }]}>
                5 min
              </Text>
            </View>
            <Text style={[styles.optionDescription, { color: colors.text.secondary }]}>
              Des conseils vraiment adaptés à ton profil
            </Text>
          </View>
          <ChevronRight size={24} color={colors.accent.primary} />
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Text style={[styles.footerText, { color: colors.text.muted }]}>
          Tes données restent privées et sécurisées
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  logoContainer: {
    alignItems: 'center',
    paddingBottom: spacing.xl,
  },
  logo: {
    width: 80,
    height: 80,
  },
  titleContainer: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xl,
  },
  welcomeTitle: {
    ...typography.h1,
    marginBottom: spacing.md,
  },
  welcomeMessage: {
    ...typography.lg,
    lineHeight: 28,
    marginBottom: spacing.md,
  },
  welcomeSubtext: {
    ...typography.body,
    fontStyle: 'italic',
    marginBottom: spacing.xl,
  },
  questionText: {
    ...typography.bodyMedium,
  },
  optionsContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 2,
    gap: spacing.md,
  },
  optionCardHighlight: {
    position: 'relative',
  },
  recommendedBadge: {
    position: 'absolute',
    top: -10,
    left: spacing.lg,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  recommendedText: {
    ...typography.caption,
    fontWeight: '600',
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    ...typography.h4,
    marginBottom: 4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  timeText: {
    ...typography.caption,
  },
  optionDescription: {
    ...typography.small,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    alignItems: 'center',
  },
  footerText: {
    ...typography.caption,
  },
})

export default StepSetupChoice
