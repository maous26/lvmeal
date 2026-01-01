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
import { ChevronRight, Zap } from 'lucide-react-native'
import { useTheme } from '../../contexts/ThemeContext'
import { spacing, radius, typography, shadows } from '../../constants/theme'

const { width, height } = Dimensions.get('window')

interface OnboardingHeroProps {
  onGetStarted: () => void
  onQuickStart?: () => void
}

export function OnboardingHero({ onGetStarted, onQuickStart }: OnboardingHeroProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      {/* Hero Image Placeholder */}
      <View style={styles.imageContainer}>
        <LinearGradient
          colors={[colors.accent.light, colors.accent.muted]}
          style={styles.imagePlaceholder}
        >
          {/* Placeholder - Tu remplaceras par ta vraie photo */}
          <View style={styles.placeholderContent}>
            <Text style={styles.placeholderEmoji}>🍽️</Text>
            <Text style={[styles.placeholderText, { color: colors.accent.primary }]}>
              Photo de personnes souriantes autour d'un repas
            </Text>
          </View>
        </LinearGradient>

        {/* Gradient overlay for text readability */}
        <LinearGradient
          colors={['transparent', colors.bg.primary]}
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
          2 minutes pour configurer ton profil
        </Text>

        {/* Quick Start Option */}
        {onQuickStart && (
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onQuickStart()
            }}
            activeOpacity={0.7}
            style={[styles.quickStartButton, { borderColor: colors.border.default }]}
          >
            <Zap size={18} color={colors.accent.primary} />
            <Text style={[styles.quickStartText, { color: colors.text.secondary }]}>
              Pressé ? <Text style={{ color: colors.accent.primary, fontWeight: '600' }}>Mode rapide (30s)</Text>
            </Text>
          </TouchableOpacity>
        )}
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
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderContent: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  placeholderEmoji: {
    fontSize: 80,
    marginBottom: spacing.md,
  },
  placeholderText: {
    ...typography.small,
    textAlign: 'center',
    fontStyle: 'italic',
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
  quickStartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  quickStartText: {
    ...typography.small,
  },
})

export default OnboardingHero
