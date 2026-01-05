import React, { useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  TouchableOpacity,
  Animated,
  Easing,
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
  onHaveAccount?: () => void
}

export function OnboardingHero({ onGetStarted, onHaveAccount }: OnboardingHeroProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()

  // Smooth fade-in animation from splash screen
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(20)).current

  useEffect(() => {
    // Gentle fade in with subtle slide up
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: colors.bg.primary },
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
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

        {/* Already have an account link */}
        {onHaveAccount && (
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onHaveAccount()
            }}
            style={styles.haveAccountButton}
            activeOpacity={0.7}
          >
            <Text style={[styles.haveAccountText, { color: colors.accent.primary }]}>
              J'ai déjà un compte
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
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
  haveAccountButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  haveAccountText: {
    ...typography.bodyMedium,
  },
})

export default OnboardingHero
