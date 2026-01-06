import React, { useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronRight } from 'lucide-react-native'
import { useTheme } from '../../contexts/ThemeContext'
import { spacing, radius, typography, shadows, fonts, organicPalette } from '../../constants/theme'
import { Button } from '../ui/Button'

const { width, height } = Dimensions.get('window')

interface OnboardingHeroProps {
  onGetStarted: () => void
  onHaveAccount?: () => void
}

export function OnboardingHero({ onGetStarted, onHaveAccount }: OnboardingHeroProps) {
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const overlayMid = isDark ? 'rgba(0,0,0,0.25)' : 'rgba(250,249,247,0.3)'
  const offWhite = '#FAF9F7'
  const footerHeight = 52 + spacing.lg + spacing.md + insets.bottom // button + paddings

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
        { backgroundColor: offWhite },
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: footerHeight + spacing.lg }]}
        showsVerticalScrollIndicator={false}
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
            colors={['transparent', overlayMid, offWhite]}
            locations={[0, 0.5, 1]}
            style={styles.imageOverlay}
          />
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Brand */}
          <View style={styles.brandContainer}>
            <Text style={[styles.brandName, { color: colors.accent.primary }]}>
              LYM
            </Text>
          </View>

          {/* Main headline */}
          <Text style={[styles.headline, { color: colors.text.primary }]}>
            Retrouve le plaisir{'\n'}de bien manger
          </Text>

          {/* Subheadline */}
          <Text style={[styles.subheadline, { color: colors.text.secondary }]}>
            Pas un énième tracker. Un vrai compagnon{'\n'}
            qui s'adapte à toi, sans pression.
          </Text>

          {/* Trust badges */}
          <View style={styles.trustBadges}>
            <View style={[styles.badge, { backgroundColor: colors.success + '15' }]}>
              <Text style={styles.badgeEmoji}>✓</Text>
              <Text style={[styles.badgeText, { color: colors.success }]}>Sur-mesure</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.accent.light }]}>
              <Text style={styles.badgeEmoji}>♡</Text>
              <Text style={[styles.badgeText, { color: colors.accent.primary }]}>Zéro culpabilité</Text>
            </View>
          </View>

          {/* Micro-copy */}
          <Text style={[styles.microCopy, { color: colors.text.muted }]}>
            Configuration en quelques étapes
          </Text>
        </View>
      </ScrollView>

      {/* Fixed CTA footer (always visible) */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md, backgroundColor: offWhite }]}>
        <TouchableOpacity
          onPress={onGetStarted}
          style={{
            backgroundColor: organicPalette.clay,
            paddingVertical: spacing.lg,
            paddingHorizontal: spacing.xl,
            borderRadius: radius.xl,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
          }}
          activeOpacity={0.8}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '600', fontFamily: fonts.sans.semibold, marginRight: spacing.sm }}>
            Commencer mon parcours
          </Text>
          <ChevronRight size={20} color="#FFFFFF" />
        </TouchableOpacity>

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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  imageContainer: {
    height: Math.min(height * 0.42, 340),
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
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  brandContainer: {
    marginBottom: spacing.sm,
  },
  brandName: {
    fontSize: 14,
    fontFamily: fonts.serif.semibold,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  headline: {
    fontSize: 36,
    lineHeight: 42,
    fontFamily: fonts.serif.bold,
    letterSpacing: -0.3,
    marginBottom: spacing.md,
  },
  subheadline: {
    ...typography.lg,
    fontFamily: fonts.sans.regular,
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
  microCopy: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
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
