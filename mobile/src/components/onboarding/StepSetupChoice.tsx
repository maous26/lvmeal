/**
 * StepSetupChoice - iOS-style setup choice screen
 *
 * Features:
 * - Clean light/dark mode support
 * - iOS colors and styling
 * - Hero image with gradient fade
 */

import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Zap, Sparkles, Clock, ChevronRight, Shield } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../../contexts/ThemeContext'
import { spacing, radius, fonts } from '../../constants/theme'

const { height } = Dimensions.get('window')

// iOS color palette
const iosColors = {
  green: '#34C759',
  blue: '#007AFF',
  orange: '#FF9500',
  purple: '#AF52DE',
}

interface StepSetupChoiceProps {
  onQuickSetup: () => void
  onFullSetup: () => void
}

export function StepSetupChoice({ onQuickSetup, onFullSetup }: StepSetupChoiceProps) {
  const { colors, isDark } = useTheme()
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
      {/* Hero Image with Gradient Fade */}
      <View style={styles.heroContainer}>
        <Image
          source={require('../../../assets/photo4.jpeg')}
          style={styles.heroImage}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)', colors.bg.primary]}
          locations={[0, 0.5, 1]}
          style={styles.heroGradient}
        />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={[styles.welcomeTitle, { color: colors.text.primary }]}>
            Configurons ton coach.
          </Text>
          <Text style={[styles.welcomeMessage, { color: colors.text.secondary }]}>
            Plus ton IA te connaît,{'\n'}mieux elle t'accompagne.
          </Text>
        </View>

        {/* Options */}
        <View style={styles.optionsContainer}>
          {/* Quick Setup */}
          <TouchableOpacity
            style={[
              styles.optionCard,
              {
                backgroundColor: colors.bg.secondary,
                borderColor: colors.border.light,
              }
            ]}
            onPress={handleQuick}
            activeOpacity={0.8}
          >
            <View style={[styles.optionIcon, { backgroundColor: iosColors.orange + '15' }]}>
              <Zap size={22} color={iosColors.orange} />
            </View>
            <View style={styles.optionContent}>
              <Text style={[styles.optionTitle, { color: colors.text.primary }]}>Démarrage rapide</Text>
              <View style={styles.timeRow}>
                <Clock size={12} color={colors.text.muted} />
                <Text style={[styles.timeText, { color: colors.text.muted }]}>2 min</Text>
              </View>
              <Text style={[styles.optionDescription, { color: colors.text.tertiary }]}>
                IA générique, conseils standards
              </Text>
            </View>
            <ChevronRight size={20} color={colors.text.muted} />
          </TouchableOpacity>

          {/* Full Setup - Recommended */}
          <TouchableOpacity
            style={[
              styles.optionCard,
              styles.optionCardRecommended,
              {
                backgroundColor: iosColors.green + '10',
                borderColor: iosColors.green,
              }
            ]}
            onPress={handleFull}
            activeOpacity={0.8}
          >
            <View style={[styles.recommendedBadge, { backgroundColor: iosColors.green }]}>
              <Text style={styles.recommendedText}>Recommandé</Text>
            </View>
            <View style={[styles.optionIcon, { backgroundColor: iosColors.green + '20' }]}>
              <Sparkles size={22} color={iosColors.green} />
            </View>
            <View style={styles.optionContent}>
              <Text style={[styles.optionTitle, { color: colors.text.primary }]}>Coach IA sur-mesure</Text>
              <View style={styles.timeRow}>
                <Clock size={12} color={colors.text.muted} />
                <Text style={[styles.timeText, { color: colors.text.muted }]}>5 min</Text>
              </View>
              <Text style={[styles.optionDescription, { color: colors.text.tertiary }]}>
                IA calibrée sur toi, vraiment personnalisée
              </Text>
            </View>
            <ChevronRight size={20} color={iosColors.green} />
          </TouchableOpacity>

          {/* Social proof */}
          <View style={styles.socialProof}>
            <Text style={[styles.socialProofText, { color: colors.text.muted }]}>
              93% des utilisateurs préfèrent l'IA personnalisée
            </Text>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.footerContent}>
          <Shield size={14} color={colors.text.muted} />
          <Text style={[styles.footerText, { color: colors.text.muted }]}>
            Données privées et sécurisées
          </Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroContainer: {
    height: height * 0.38,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '70%',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    marginTop: -spacing.xl,
  },
  titleContainer: {
    marginBottom: spacing.xl,
  },
  welcomeTitle: {
    fontSize: 34,
    fontFamily: fonts.sans.bold,
    marginBottom: spacing.sm,
    letterSpacing: -0.5,
  },
  welcomeMessage: {
    fontSize: 17,
    lineHeight: 26,
    fontFamily: fonts.sans.regular,
  },
  optionsContainer: {
    gap: spacing.md,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  optionCardRecommended: {
    borderWidth: 2,
    marginTop: spacing.sm,
  },
  recommendedBadge: {
    position: 'absolute',
    top: -10,
    left: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  recommendedText: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: fonts.sans.semibold,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 17,
    fontFamily: fonts.sans.semibold,
    marginBottom: 2,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  timeText: {
    fontSize: 12,
    fontFamily: fonts.sans.regular,
  },
  optionDescription: {
    fontSize: 13,
    fontFamily: fonts.sans.regular,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  footerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  footerText: {
    fontSize: 12,
    fontFamily: fonts.sans.regular,
  },
  socialProof: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  socialProofText: {
    fontSize: 12,
    fontFamily: fonts.sans.regular,
    fontStyle: 'italic',
    textAlign: 'center',
  },
})

export default StepSetupChoice
