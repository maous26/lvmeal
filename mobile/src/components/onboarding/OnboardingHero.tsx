/**
 * OnboardingHero - iOS-style welcome screen
 *
 * Features:
 * - Clean, minimal iOS design with strong visual hierarchy
 * - Hero image with gradient fade
 * - Airy benefits grid with uniform icons
 * - High-contrast green CTA button with reassurance text
 * - Auto-scrolling testimonials carousel
 */

import React, { useEffect, useRef } from 'react'
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
  Sparkles,
  Heart,
  Brain,
  Leaf,
  Star,
  Shield,
  Quote,
} from 'lucide-react-native'
import { useTheme } from '../../contexts/ThemeContext'
import { spacing, radius, fonts, lymBrand } from '../../constants/theme'

const { width, height } = Dimensions.get('window')

// Color palette using LYM brand colors from logo
const brandColors = {
  cta: lymBrand.green,               // LYM sage green (flat, like logo)
  ctaPressed: lymBrand.greenLight,   // Lighter for pressed state
  purple: '#AF52DE',
  orange: lymBrand.orange,           // LYM orange accent
  blue: '#007AFF',
  trust: '#6B7280',
}

// Testimonials data
const testimonials = [
  {
    id: 1,
    text: "Enfin une app qui ne me culpabilise pas. Je comprends mieux mon corps.",
    author: "Marie",
    age: 34,
    rating: 5,
  },
  {
    id: 2,
    text: "J'ai perdu 8kg en 3 mois sans me priver. L'IA comprend vraiment mes besoins.",
    author: "Thomas",
    age: 28,
    rating: 5,
  },
  {
    id: 3,
    text: "Le programme métabolisme a changé ma vie. Plus d'effet yo-yo !",
    author: "Sophie",
    age: 41,
    rating: 5,
  },
  {
    id: 4,
    text: "Simple, efficace, bienveillant. Exactement ce que je cherchais.",
    author: "Lucas",
    age: 32,
    rating: 5,
  },
  {
    id: 5,
    text: "Les conseils personnalisés sont incroyables. On sent que l'app nous connaît.",
    author: "Emma",
    age: 26,
    rating: 5,
  },
]

// Animated benefit card - more airy design
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
    const baseDelay = 300 + index * 100
    opacity.value = withDelay(baseDelay, withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) }))
    translateY.value = withDelay(baseDelay, withTiming(0, { duration: 450, easing: Easing.out(Easing.cubic) }))
  }, [])

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }]
  }))

  return (
    <Animated.View style={[styles.benefitCard, cardStyle]}>
      <View style={[styles.benefitIconContainer, { backgroundColor: color + '12' }]}>
        {icon}
      </View>
      <View style={styles.benefitTextContainer}>
        <Text style={[styles.benefitTitle, { color: textColor }]}>
          {title}
        </Text>
        <Text style={[styles.benefitDescription, { color: textColorMuted }]}>
          {description}
        </Text>
      </View>
    </Animated.View>
  )
}

// Single testimonial card
const TestimonialCard = ({
  testimonial,
  bgColor,
  textColor,
  textColorMuted,
}: {
  testimonial: typeof testimonials[0]
  bgColor: string
  textColor: string
  textColorMuted: string
}) => (
  <View style={[styles.testimonialCard, { backgroundColor: bgColor }]}>
    <View style={styles.testimonialHeader}>
      <Quote size={16} color={brandColors.purple} strokeWidth={2} />
      <View style={styles.testimonialStars}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} size={12} color="#FFB800" fill="#FFB800" />
        ))}
      </View>
    </View>
    <Text style={[styles.testimonialText, { color: textColor }]} numberOfLines={3}>
      "{testimonial.text}"
    </Text>
    <Text style={[styles.testimonialAuthor, { color: textColorMuted }]}>
      — {testimonial.author}, {testimonial.age} ans
    </Text>
  </View>
)

// Auto-scrolling testimonials carousel
const TestimonialsCarousel = ({
  bgColor,
  textColor,
  textColorMuted,
}: {
  bgColor: string
  textColor: string
  textColorMuted: string
}) => {
  const scrollRef = useRef<Animated.ScrollView>(null)
  const currentIndex = useRef(0)

  // Card width + gap
  const cardWidth = width * 0.75
  const cardGap = spacing.md

  useEffect(() => {
    // Auto-scroll every 4 seconds
    const interval = setInterval(() => {
      currentIndex.current = (currentIndex.current + 1) % testimonials.length
      scrollRef.current?.scrollTo({
        x: currentIndex.current * (cardWidth + cardGap),
        animated: true,
      })
    }, 4000)

    return () => clearInterval(interval)
  }, [cardWidth])

  // Fade in animation
  const carouselOpacity = useSharedValue(0)
  const carouselTranslateY = useSharedValue(20)

  useEffect(() => {
    carouselOpacity.value = withDelay(600, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }))
    carouselTranslateY.value = withDelay(600, withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }))
  }, [])

  const carouselStyle = useAnimatedStyle(() => ({
    opacity: carouselOpacity.value,
    transform: [{ translateY: carouselTranslateY.value }]
  }))

  return (
    <Animated.View style={[styles.carouselContainer, carouselStyle]}>
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + cardGap}
        decelerationRate="fast"
        contentContainerStyle={[
          styles.carouselContent,
          { paddingHorizontal: (width - cardWidth) / 2 }
        ]}
      >
        {testimonials.map((testimonial) => (
          <View key={testimonial.id} style={{ width: cardWidth, marginRight: cardGap }}>
            <TestimonialCard
              testimonial={testimonial}
              bgColor={bgColor}
              textColor={textColor}
              textColorMuted={textColorMuted}
            />
          </View>
        ))}
      </Animated.ScrollView>

      {/* Dots indicator */}
      <View style={styles.dotsContainer}>
        {testimonials.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              { backgroundColor: index === 0 ? brandColors.purple : brandColors.trust + '40' }
            ]}
          />
        ))}
      </View>
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

  // Floating animation for brand badge
  const floatY = useSharedValue(0)
  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    )
  }, [])

  const brandFloatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }]
  }))

  const benefits = [
    {
      id: 'ai',
      icon: <Brain size={22} color={brandColors.purple} strokeWidth={2} />,
      title: 'IA personnalisée',
      description: 'Conseils adaptés à toi',
      color: brandColors.purple,
    },
    {
      id: 'correlations',
      icon: <Sparkles size={22} color={brandColors.blue} strokeWidth={2} />,
      title: 'Analyses',
      description: 'Nutrition & bien-être',
      color: brandColors.blue,
    },
    {
      id: 'boost',
      icon: <Leaf size={22} color={brandColors.orange} strokeWidth={2} />,
      title: 'Métabolisme',
      description: 'Programme 4 phases',
      color: brandColors.orange,
    },
    {
      id: 'wellness',
      icon: <Heart size={22} color={brandColors.cta} strokeWidth={2} />,
      title: 'Bien-être',
      description: 'Sommeil & énergie',
      color: brandColors.cta,
    },
  ]

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 200 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Image - enhanced with better gradient */}
        <View style={styles.imageContainer}>
          <Image
            source={require('../../../assets/Photo1.jpg')}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)', bgColor]}
            locations={[0, 0.4, 1]}
            style={styles.imageOverlay}
          />
        </View>

        {/* Content */}
        <Animated.View style={[styles.content, mainStyle]}>
          {/* Brand badge with floating animation */}
          <Animated.View style={[styles.brandContainer, { backgroundColor: brandColors.purple + '12' }, brandFloatStyle]}>
            <Brain size={14} color={brandColors.purple} strokeWidth={2} />
            <Text style={[styles.brandName, { color: brandColors.purple }]}>
              LYM
            </Text>
          </Animated.View>

          {/* Main headline - LARGER for visual hierarchy */}
          <Text style={[styles.headline, { color: colors.text.primary }]}>
            La nutrition intelligente{'\n'}qui s'adapte à toi
          </Text>

          {/* Subheadline - smaller for contrast */}
          <Text style={[styles.subheadline, { color: colors.text.secondary }]}>
            Conseils personnalisés par IA.{'\n'}Sans jugement, sans régime.
          </Text>

          {/* Benefits Grid - 2x2 more airy */}
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

        {/* Auto-scrolling testimonials carousel */}
        <TestimonialsCarousel
          bgColor={colors.bg.secondary}
          textColor={colors.text.secondary}
          textColorMuted={colors.text.muted}
        />

        {/* Trust badges */}
        <View style={[styles.trustBadges, { marginTop: spacing.lg }]}>
          <View style={styles.trustBadge}>
            <Shield size={14} color={brandColors.trust} strokeWidth={2} />
            <Text style={[styles.trustText, { color: brandColors.trust }]}>
              Données sécurisées
            </Text>
          </View>
          <View style={[styles.trustDivider, { backgroundColor: colors.border.light }]} />
          <View style={styles.trustBadge}>
            <Text style={[styles.trustText, { color: brandColors.trust }]}>
              Recommandé par des nutritionnistes
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* CTA footer - clean without separator line */}
      <View style={[styles.footer, { paddingBottom: safeBottom, backgroundColor: bgColor }]}>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            onGetStarted()
          }}
          activeOpacity={0.85}
          style={[styles.ctaButton, { backgroundColor: brandColors.cta }]}
        >
          <Text style={styles.ctaText}>
            Commencer — 7 jours gratuits
          </Text>
          <ChevronRight size={20} color="#FFFFFF" strokeWidth={2.5} />
        </TouchableOpacity>

        {/* Reassurance text under CTA */}
        <Text style={[styles.reassuranceText, { color: colors.text.muted }]}>
          Sans engagement · Annulation facile
        </Text>

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
  // Image - slightly taller for more impact
  imageContainer: {
    height: Math.min(height * 0.35, 300),
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
    height: 200,
  },
  // Content - more generous spacing
  content: {
    paddingHorizontal: spacing.xl,
    marginTop: -spacing.md,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginBottom: spacing.md,
  },
  brandName: {
    fontSize: 12,
    fontFamily: fonts.sans.bold,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  // Headline - LARGER (36px vs 32px)
  headline: {
    fontSize: 34,
    lineHeight: 42,
    fontFamily: fonts.sans.bold,
    letterSpacing: -0.8,
    marginBottom: spacing.sm,
  },
  // Subheadline - smaller (15px vs 16px) for contrast
  subheadline: {
    fontSize: 15,
    fontFamily: fonts.sans.regular,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  // Benefits Grid - more airy
  benefitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
    marginBottom: spacing.md,
  },
  benefitCard: {
    width: '50%',
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  benefitIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitTextContainer: {
    flex: 1,
    paddingTop: 2,
  },
  benefitTitle: {
    fontSize: 14,
    fontFamily: fonts.sans.semibold,
    marginBottom: 2,
  },
  benefitDescription: {
    fontSize: 12,
    fontFamily: fonts.sans.regular,
    lineHeight: 16,
  },
  // Testimonials Carousel
  carouselContainer: {
    marginBottom: spacing.md,
  },
  carouselContent: {
    paddingVertical: spacing.xs,
  },
  testimonialCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    minHeight: 120,
  },
  testimonialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  testimonialStars: {
    flexDirection: 'row',
    gap: 2,
  },
  testimonialText: {
    fontSize: 14,
    fontFamily: fonts.sans.regular,
    fontStyle: 'italic',
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  testimonialAuthor: {
    fontSize: 12,
    fontFamily: fonts.sans.medium,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  // Trust badges
  trustBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  trustDivider: {
    width: 1,
    height: 12,
  },
  trustText: {
    fontSize: 11,
    fontFamily: fonts.sans.medium,
  },
  // Footer - clean design without separator
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  // CTA Button - LYM sage green (flat color like logo)
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    gap: spacing.sm,
    // Shadow with LYM green tint
    shadowColor: lymBrand.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: fonts.sans.semibold,
  },
  reassuranceText: {
    fontSize: 12,
    fontFamily: fonts.sans.regular,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  haveAccountButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  haveAccountText: {
    fontSize: 14,
    fontFamily: fonts.sans.medium,
  },
})

export default OnboardingHero
