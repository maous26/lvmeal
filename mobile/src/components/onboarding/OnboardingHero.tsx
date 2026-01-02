import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  TouchableOpacity,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronRight } from 'lucide-react-native'
import { useTheme } from '../../contexts/ThemeContext'
import { spacing, radius, typography, shadows } from '../../constants/theme'

const { width, height } = Dimensions.get('window')

interface OnboardingHeroProps {
  onGetStarted: () => void
}

export function OnboardingHero({ onGetStarted }: OnboardingHeroProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      {/* Hero Image */}
      <View style={styles.imageContainer}>
        <Image
          source={require('../../../assets/Photo1.jpg')}
          style={styles.heroImage}
          resizeMode="cover"
        />

        {/* Gradient overlay for text readability */}
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.3)', colors.bg.primary]}
          locations={[0, 0.5, 1]}
          style={styles.imageOverlay}
        />
      </View>

      {/* Content */}
      <View style={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        {/* Brand */}
        <View style={styles.brandContainer}>
          <Text style={[styles.brandName, { color: colors.accent.primary }]}>
            Love Your Meal
          </Text>
        </View>

        {/* Main headline */}
        <Text style={[styles.headline, { color: colors.text.primary }]}>
          Reprends le contrôle{'\n'}de ton alimentation
        </Text>

        {/* Subheadline */}
        <Text style={[styles.subheadline, { color: colors.text.secondary }]}>
          Sans frustration. Sans régime strict.{'\n'}
          Juste toi, tes objectifs et un coach bienveillant.
        </Text>

        {/* Trust badges */}
        <View style={styles.trustBadges}>
          <View style={[styles.badge, { backgroundColor: colors.success + '15' }]}>
            <Text style={styles.badgeEmoji}>✓</Text>
            <Text style={[styles.badgeText, { color: colors.success }]}>100% personnalisé</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: colors.accent.light }]}>
            <Text style={styles.badgeEmoji}>🤖</Text>
            <Text style={[styles.badgeText, { color: colors.accent.primary }]}>Coach IA intégré</Text>
          </View>
        </View>

        {/* CTA Button */}
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            onGetStarted()
          }}
          activeOpacity={0.8}
          style={[
            styles.ctaButton,
            { backgroundColor: colors.accent.primary },
            shadows.glowPrimary,
          ]}
        >
          <Text style={styles.ctaText}>Commencer mon parcours</Text>
          <ChevronRight size={20} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Micro-copy */}
        <Text style={[styles.microCopy, { color: colors.text.muted }]}>
          Configuration en quelques étapes
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  imageContainer: {
    height: height * 0.45,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    justifyContent: 'space-between',
  },
  brandContainer: {
    marginBottom: spacing.sm,
  },
  brandName: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  headline: {
    ...typography.h1,
    marginBottom: spacing.md,
  },
  subheadline: {
    ...typography.lg,
    lineHeight: 28,
    marginBottom: spacing.lg,
  },
  trustBadges: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  badgeEmoji: {
    fontSize: 14,
  },
  badgeText: {
    ...typography.captionMedium,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.xl,
    gap: spacing.sm,
  },
  ctaText: {
    ...typography.button,
    color: '#FFFFFF',
  },
  microCopy: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.md,
  },
})

export default OnboardingHero
