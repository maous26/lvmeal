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
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  ChevronRight,
  Camera,
  Sparkles,
  Heart,
  Brain,
  Leaf,
} from 'lucide-react-native'
import { useTheme } from '../../contexts/ThemeContext'
import { spacing, radius, fonts, organicPalette } from '../../constants/theme'

const { width, height } = Dimensions.get('window')

// Small floating blob for background
const SmallBlob = ({
  color,
  size,
  top,
  left,
  delay = 0
}: {
  color: string
  size: number
  top: number
  left: number
  delay?: number
}) => {
  const scale = useSharedValue(1)
  const translateY = useSharedValue(0)
  const translateX = useSharedValue(0)

  useEffect(() => {
    scale.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(1.15, { duration: 6000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.95, { duration: 6000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    ))

    translateY.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(-15, { duration: 7000, easing: Easing.inOut(Easing.sin) }),
        withTiming(15, { duration: 7000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    ))

    translateX.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(10, { duration: 8000, easing: Easing.inOut(Easing.sin) }),
        withTiming(-10, { duration: 8000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    ))
  }, [])

  const style = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
      { translateX: translateX.value }
    ]
  }))

  return (
    <Animated.View
      style={[
        styles.smallBlob,
        style,
        {
          backgroundColor: color,
          width: size,
          height: size,
          top,
          left,
          borderRadius: size / 2,
        }
      ]}
    />
  )
}

// Animated benefit card with reveal animation
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
  const iconScale = useSharedValue(1)
  const iconTranslateY = useSharedValue(0)

  useEffect(() => {
    // Cascade delay - 100ms between each card
    const baseDelay = 300 + index * 100

    // Fade in and slide up (reveal effect)
    opacity.value = withDelay(baseDelay, withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) }))
    translateY.value = withDelay(baseDelay, withTiming(0, { duration: 450, easing: Easing.out(Easing.cubic) }))

    // Icon float animation - subtle continuous movement
    iconTranslateY.value = withDelay(baseDelay + 300, withRepeat(
      withSequence(
        withTiming(-3, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        withTiming(3, { duration: 1500, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    ))

    // Icon subtle pulse
    iconScale.value = withDelay(baseDelay + 300, withRepeat(
      withSequence(
        withTiming(1.08, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    ))
  }, [])

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }]
  }))

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: iconScale.value },
      { translateY: iconTranslateY.value }
    ]
  }))

  return (
    <Animated.View style={[styles.benefitCard, cardStyle]}>
      <Animated.View style={[styles.benefitIconContainer, iconStyle, { backgroundColor: color + '15' }]}>
        {icon}
      </Animated.View>
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
  const safeBottom = Math.min(insets.bottom, 8)
  const footerHeight = 44 + safeBottom

  // Main content animation
  const mainOpacity = useSharedValue(0)
  const mainTranslateY = useSharedValue(20)

  useEffect(() => {
    mainOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) })
    mainTranslateY.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) })
  }, [])

  const mainStyle = useAnimatedStyle(() => ({
    opacity: mainOpacity.value,
    transform: [{ translateY: mainTranslateY.value }]
  }))

  const benefits = [
    {
      id: 'easy',
      icon: <Camera size={18} color={organicPalette.moss} strokeWidth={1.5} />,
      title: 'Simple',
      description: 'Photo, voix ou scan',
      color: organicPalette.moss,
    },
    {
      id: 'personalized',
      icon: <Sparkles size={18} color={organicPalette.lavender} strokeWidth={1.5} />,
      title: 'Sur-mesure',
      description: 'Adapté à toi',
      color: organicPalette.lavender,
    },
    {
      id: 'kind',
      icon: <Heart size={18} color={organicPalette.clay} strokeWidth={1.5} />,
      title: 'Bienveillant',
      description: 'Sans culpabilité',
      color: organicPalette.clay,
    },
    {
      id: 'smart',
      icon: <Brain size={18} color={organicPalette.ocean} strokeWidth={1.5} />,
      title: 'Intelligent',
      description: 'Coach IA personnel',
      color: organicPalette.ocean,
    },
  ]

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Floating blobs background - smaller than main screens */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <SmallBlob
          color={organicPalette.sage}
          size={width * 0.35}
          top={height * 0.08}
          left={width * 0.65}
          delay={0}
        />
        <SmallBlob
          color={organicPalette.clay}
          size={width * 0.28}
          top={height * 0.55}
          left={-width * 0.1}
          delay={1500}
        />
        <SmallBlob
          color={organicPalette.lavender}
          size={width * 0.25}
          top={height * 0.75}
          left={width * 0.7}
          delay={800}
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: footerHeight + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Image with premium overlay */}
        <View style={styles.imageContainer}>
          <Image
            source={require('../../../assets/Photo1.jpg')}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', isDark ? 'rgba(26,26,26,0.2)' : 'rgba(250,249,247,0.2)', isDark ? 'rgba(26,26,26,0.8)' : 'rgba(250,249,247,0.8)', bgColor]}
            locations={[0, 0.4, 0.7, 1]}
            style={styles.imageOverlay}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.1)', 'transparent', 'transparent']}
            style={styles.vignetteTop}
          />
        </View>

        {/* Content */}
        <Animated.View style={[styles.content, mainStyle]}>
          {/* Brand with leaf accent */}
          <View style={styles.brandContainer}>
            <Leaf size={14} color={colors.accent.primary} strokeWidth={1.5} />
            <Text style={[styles.brandName, { color: colors.accent.primary }]}>
              LYM
            </Text>
          </View>

          {/* Main headline */}
          <Text style={[styles.headline, { color: colors.text.primary }]}>
            Retrouve le plaisir{'\n'}de bien manger
          </Text>

          {/* Elegant divider */}
          <View style={styles.dividerContainer}>
            <View style={[styles.dividerLine, { backgroundColor: colors.accent.primary + '40' }]} />
            <View style={[styles.dividerDot, { backgroundColor: colors.accent.primary }]} />
            <View style={[styles.dividerLine, { backgroundColor: colors.accent.primary + '40' }]} />
          </View>

          {/* Subheadline */}
          <Text style={[styles.subheadline, { color: colors.text.secondary }]}>
            Un compagnon qui s'adapte à toi,{'\n'}sans pression, sans jugement.
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
                textColorMuted={colors.text.secondary}
              />
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      {/* CTA footer */}
      <View style={[styles.footer, { paddingBottom: safeBottom, backgroundColor: bgColor }]}>
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.03)']}
          style={styles.footerShadow}
        />

        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            onGetStarted()
          }}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={[organicPalette.moss, '#3A5A32']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaButton}
          >
            <Text style={styles.ctaText}>
              Commencer mon parcours
            </Text>
            <View style={styles.ctaIconContainer}>
              <ChevronRight size={18} color="#FFFFFF" strokeWidth={2.5} />
            </View>
          </LinearGradient>
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
  // Small blobs
  smallBlob: {
    position: 'absolute',
    opacity: 0.25,
  },
  // Image
  imageContainer: {
    height: Math.min(height * 0.38, 320),
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
    height: 150,
  },
  vignetteTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  // Content
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: 0,
    marginTop: -spacing.md,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  brandName: {
    fontSize: 13,
    fontFamily: fonts.serif.semibold,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  headline: {
    fontSize: 34,
    lineHeight: 42,
    fontFamily: fonts.serif.bold,
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  dividerLine: {
    height: 1,
    width: 32,
  },
  dividerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  subheadline: {
    fontSize: 16,
    fontFamily: fonts.sans.regular,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  // Benefits Grid
  benefitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
    marginHorizontal: -spacing.xs,
  },
  benefitCard: {
    width: '50%',
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.md,
  },
  benefitIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  benefitTitle: {
    fontSize: 14,
    fontFamily: fonts.sans.semibold,
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  benefitDescription: {
    fontSize: 12,
    fontFamily: fonts.sans.regular,
    lineHeight: 16,
  },
  // Footer
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
  },
  footerShadow: {
    position: 'absolute',
    top: -20,
    left: 0,
    right: 0,
    height: 20,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    gap: spacing.sm,
    shadowColor: organicPalette.moss,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: fonts.sans.semibold,
    letterSpacing: 0.3,
  },
  ctaIconContainer: {
    marginLeft: spacing.xs,
  },
  haveAccountButton: {
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  haveAccountText: {
    fontSize: 14,
    fontFamily: fonts.sans.medium,
    letterSpacing: 0.2,
  },
})

export default OnboardingHero
