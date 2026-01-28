/**
 * OnboardingHero - iOS-style welcome screen
 *
 * Features:
 * - Clean, minimal iOS design
 * - Hero image with gradient fade
 * - Benefits grid with iOS colors
 * - Apple Green CTA button
 */

import React, { useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  TouchableOpacity,
  ScrollView,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  ChevronRight,
  Sparkles,
  Heart,
  Brain,
  Leaf,
} from 'lucide-react-native'
import { useTheme } from '../../contexts/ThemeContext'
import { spacing, radius, fonts } from '../../constants/theme'

const { height } = Dimensions.get('window')

// iOS color palette
const iosColors = {
  green: '#1D1D1F',  // Black for primary actions
  purple: '#AF52DE',
  orange: '#FF9500',
  blue: '#007AFF',
}

// Animated benefit card
const AnimatedBenefitCard = ({
  icon,
  title,
  description,
  color,
  index,
  textColor,
  textColorMuted,
}: {
  icon: React.ReactNode
  title: string
  description: string
  color: string
  index: number
  textColor: string
  textColorMuted: string
}) => {
  const opacity = useSharedValue(0)
  const translateY = useSharedValue(20)

  useEffect(() => {
    const baseDelay = 200 + index * 80
    opacity.value = withDelay(baseDelay, withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }))
    translateY.value = withDelay(baseDelay, withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) }))
  }, [])

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }]
  }))

  return (
    <Animated.View style={[styles.benefitCard, cardStyle]}>
      <View style={[styles.benefitIconContainer, { backgroundColor: color + '15' }]}>
        {icon}
      </View>
      <Text style={[styles.benefitTitle, { color: textColor }]}>
        {title}
      </Text>
      <Text style={[styles.benefitDescription, { color: textColorMuted }]}>
        {description}
      </Text>
    </Animated.View>
  )
}

interface OnboardingHeroProps {
  onGetStarted: () => void
  onHaveAccount?: () => void
}

export function OnboardingHero({ onGetStarted, onHaveAccount }: OnboardingHeroProps) {
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const bgColor = colors.bg.primary
  const safeBottom = Math.max(insets.bottom, 16)

  // Main content animation
  const mainOpacity = useSharedValue(0)
  const mainTranslateY = useSharedValue(20)

  useEffect(() => {
    mainOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) })
    mainTranslateY.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) })
  }, [])

  const mainStyle = useAnimatedStyle(() => ({
    opacity: mainOpacity.value,
    transform: [{ translateY: mainTranslateY.value }]
  }))

  const benefits = [
    {
      id: 'ai',
      icon: <Brain size={20} color={iosColors.purple} strokeWidth={2} />,
      title: 'Conseils IA',
      description: '100% personnalisés pour toi',
      color: iosColors.purple,
    },
    {
      id: 'correlations',
      icon: <Sparkles size={20} color={iosColors.blue} strokeWidth={2} />,
      title: 'Corrélations',
      description: 'Nutrition, sommeil, stress',
      color: iosColors.blue,
    },
    {
      id: 'boost',
      icon: <Leaf size={20} color={iosColors.orange} strokeWidth={2} />,
      title: 'Boost Métabolisme',
      description: 'Programme en 4 phases',
      color: iosColors.orange,
    },
    {
      id: 'wellness',
      icon: <Heart size={20} color={'#34C759'} strokeWidth={2} />,
      title: 'Bien-être intégré',
      description: 'Sommeil, énergie, humeur',
      color: '#34C759',
    },
  ]

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 160 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Image */}
        <View style={styles.imageContainer}>
          <Image
            source={require('../../../assets/Photo1.jpg')}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)', bgColor]}
            locations={[0, 0.5, 1]}
            style={styles.imageOverlay}
          />
        </View>

        {/* Content */}
        <Animated.View style={[styles.content, mainStyle]}>
          {/* Brand */}
          <View style={styles.brandContainer}>
            <Brain size={14} color={iosColors.purple} strokeWidth={2} />
            <Text style={[styles.brandName, { color: iosColors.purple }]}>
              LYM
            </Text>
          </View>

          {/* Main headline */}
          <Text style={[styles.headline, { color: colors.text.primary }]}>
            La nutrition intelligente{'\n'}qui s'adapte à toi
          </Text>

          {/* Subheadline */}
          <Text style={[styles.subheadline, { color: colors.text.secondary }]}>
            Conseils personnalisés par IA, liens entre{'\n'}alimentation et bien-être. Sans jugement.
          </Text>

          {/* Benefits Grid - 2x2 */}
          <View style={styles.benefitsGrid}>
            {benefits.map((benefit, index) => (
              <AnimatedBenefitCard
                key={benefit.id}
                icon={benefit.icon}
                title={benefit.title}
                description={benefit.description}
                color={benefit.color}
                index={index}
                textColor={colors.text.primary}
                textColorMuted={colors.text.tertiary}
              />
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      {/* CTA footer */}
      <View style={[styles.footer, { paddingBottom: safeBottom, backgroundColor: bgColor }]}>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            onGetStarted()
          }}
          activeOpacity={0.9}
          style={[styles.ctaButton, { backgroundColor: iosColors.green }]}
        >
          <Text style={styles.ctaText}>
            Commencer — 7 jours gratuits
          </Text>
          <ChevronRight size={20} color="#FFFFFF" strokeWidth={2.5} />
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
            <Text style={[styles.haveAccountText, { color: colors.text.tertiary }]}>
              J'ai déjà un compte
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  // Image
  imageContainer: {
    height: Math.min(height * 0.42, 360),
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
    height: 180,
  },
  // Content
  content: {
    paddingHorizontal: spacing.xl,
    marginTop: -spacing.lg,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  brandName: {
    fontSize: 13,
    fontFamily: fonts.sans.semibold,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  headline: {
    fontSize: 32,
    lineHeight: 40,
    fontFamily: fonts.sans.bold,
    letterSpacing: -0.5,
    marginBottom: spacing.md,
  },
  subheadline: {
    fontSize: 16,
    fontFamily: fonts.sans.regular,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  // Benefits Grid
  benefitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.sm,
  },
  benefitCard: {
    width: '50%',
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.lg,
  },
  benefitIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  benefitTitle: {
    fontSize: 15,
    fontFamily: fonts.sans.semibold,
    marginBottom: 2,
  },
  benefitDescription: {
    fontSize: 13,
    fontFamily: fonts.sans.regular,
    lineHeight: 18,
  },
  // Footer
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: fonts.sans.semibold,
  },
  haveAccountButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  haveAccountText: {
    fontSize: 14,
    fontFamily: fonts.sans.medium,
  },
})

export default OnboardingHero
