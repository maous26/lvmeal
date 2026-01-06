/**
 * Setup Choice Step - Premium Dark Design
 *
 * Dark background with hero image fade, white text, modern UI
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

import { spacing, radius, typography, fonts } from '../../constants/theme'

const { width, height } = Dimensions.get('window')

interface StepSetupChoiceProps {
  onQuickSetup: () => void
  onFullSetup: () => void
}

// Dark theme colors
const dark = {
  bg: '#0A0A0A',
  card: '#1A1A1A',
  cardBorder: '#2A2A2A',
  cardHighlight: '#1E2A3A',
  cardHighlightBorder: '#3B82F6',
  text: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textMuted: '#606060',
  accent: '#3B82F6',
  accentLight: '#3B82F620',
  warning: '#F59E0B',
  warningLight: '#F59E0B20',
}

export function StepSetupChoice({ onQuickSetup, onFullSetup }: StepSetupChoiceProps) {
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
    <View style={[styles.container, { backgroundColor: dark.bg }]}>
      {/* Hero Image with Gradient Fade */}
      <View style={styles.heroContainer}>
        <Image
          source={require('../../../assets/photo4.jpeg')}
          style={styles.heroImage}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(10,10,10,0.6)', dark.bg]}
          locations={[0, 0.5, 1]}
          style={styles.heroGradient}
        />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.welcomeTitle}>Bienvenue.</Text>
          <Text style={styles.welcomeMessage}>
            Ici, tu n'as rien à réussir.{'\n'}
            Juste à avancer, à ton rythme.
          </Text>
        </View>

        {/* Options */}
        <View style={styles.optionsContainer}>
          {/* Quick Setup */}
          <TouchableOpacity
            style={[styles.optionCard, { backgroundColor: dark.card, borderColor: dark.cardBorder }]}
            onPress={handleQuick}
            activeOpacity={0.8}
          >
            <View style={[styles.optionIcon, { backgroundColor: dark.warningLight }]}>
              <Zap size={24} color={dark.warning} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Express</Text>
              <View style={styles.timeRow}>
                <Clock size={12} color={dark.textMuted} />
                <Text style={styles.timeText}>2 min</Text>
              </View>
              <Text style={styles.optionDescription}>
                L'essentiel pour démarrer
              </Text>
            </View>
            <ChevronRight size={20} color={dark.textMuted} />
          </TouchableOpacity>

          {/* Full Setup - Recommended */}
          <TouchableOpacity
            style={[
              styles.optionCard,
              { backgroundColor: dark.cardHighlight, borderColor: dark.cardHighlightBorder }
            ]}
            onPress={handleFull}
            activeOpacity={0.8}
          >
            <View style={styles.recommendedBadge}>
              <Text style={styles.recommendedText}>Recommandé</Text>
            </View>
            <View style={[styles.optionIcon, { backgroundColor: dark.accentLight }]}>
              <Sparkles size={24} color={dark.accent} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Personnalisé</Text>
              <View style={styles.timeRow}>
                <Clock size={12} color={dark.textMuted} />
                <Text style={styles.timeText}>5 min</Text>
              </View>
              <Text style={styles.optionDescription}>
                Des conseils adaptés à ton profil
              </Text>
            </View>
            <ChevronRight size={20} color={dark.accent} />
          </TouchableOpacity>

          {/* Social proof */}
          <View style={styles.socialProof}>
            <Text style={styles.socialProofText}>
              Choisi par 87% de nos membres pour plus de précision
            </Text>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.footerContent}>
          <Shield size={14} color={dark.textMuted} />
          <Text style={styles.footerText}>
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
    height: height * 0.35,
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
    fontSize: 36,
    fontFamily: fonts.serif.bold,
    color: dark.text,
    marginBottom: spacing.sm,
    letterSpacing: -0.3,
  },
  welcomeMessage: {
    fontSize: 17,
    lineHeight: 26,
    fontFamily: fonts.sans.regular,
    color: dark.textSecondary,
  },
  optionsContainer: {
    gap: spacing.md,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.md,
  },
  recommendedBadge: {
    position: 'absolute',
    top: -10,
    left: spacing.lg,
    backgroundColor: dark.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  recommendedText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: fonts.sans.semibold,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 17,
    fontFamily: fonts.serif.semibold,
    color: dark.text,
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
    color: dark.textMuted,
  },
  optionDescription: {
    fontSize: 13,
    fontFamily: fonts.sans.regular,
    color: dark.textSecondary,
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
    color: dark.textMuted,
  },
  socialProof: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  socialProofText: {
    fontSize: 12,
    fontFamily: fonts.sans.regular,
    color: dark.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
  },
})

export default StepSetupChoice
