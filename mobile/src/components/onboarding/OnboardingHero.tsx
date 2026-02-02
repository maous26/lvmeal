/**
 * OnboardingHero - Nouvelle version avec thème et UI améliorés
 *
 * Features:
 * - Clean, minimal iOS design with strong visual hierarchy
 * - Hero image with gradient fade
 * - Grille de bénéfices en 2x2
 * - High-contrast green CTA button
 * - Support du thème clair/sombre
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
  Brain,
  Sparkles,
  Zap,
  Heart,
  ChevronRight,
} from 'lucide-react-native'
import { useTheme } from '../../contexts/ThemeContext'
import { spacing, radius, fonts } from '../../constants/theme'

const { height } = Dimensions.get('window')

const iosColors = {
  purple: '#AF52DE',
  blue: '#007AFF',
  orange: '#FF9500',
  green: '#34C759',
}

// Carte animée pour les bénéfices
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
    opacity.value = withDelay(
      baseDelay,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) })
    )
    translateY.value = withDelay(
      baseDelay,
      withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) })
    )
  }, [])

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }))

  return (
    <Animated.View style={[styles.benefitCard, cardStyle]}>
      <View style={[styles.benefitIconContainer, { backgroundColor: color + '15' }]}>
        {icon}
      </View>
      <Text style={[styles.benefitTitle, { color: textColor }]}>{title}</Text>
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

export function OnboardingHero({
  onGetStarted,
  onHaveAccount,
}: OnboardingHeroProps) {
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const bgColor = colors.bg.primary
  const safeBottom = Math.max(insets.bottom, 16)

  const mainOpacity = useSharedValue(0)
  const mainTranslateY = useSharedValue(20)

  useEffect(() => {
    mainOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) })
    mainTranslateY.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) })
  }, [])

  const mainStyle = useAnimatedStyle(() => ({
    opacity: mainOpacity.value,
    transform: [{ translateY: mainTranslateY.value }],
  }))

  const benefits = [
    {
      id: 'coach',
      icon: <Brain size={20} color={iosColors.purple} strokeWidth={2} />,
      title: 'Coach IA',
      description: 'Conseils sur‑mesure en temps réel',
      color: iosColors.purple,
    },
    {
      id: 'analysis',
      icon: <Sparkles size={20} color={iosColors.blue} strokeWidth={2} />,
      title: 'Analyses croisées',
      description: 'Nutrition, sommeil, stress, énergie',
      color: iosColors.blue,
    },
    {
      id: 'program',
      icon: <Zap size={20} color={iosColors.orange} strokeWidth={2} />,
      title: 'Programme métabolique',
      description: '4 phases pour te transformer',
      color: iosColors.orange,
    },
    {
      id: 'wellness',
      icon: <Heart size={20} color={iosColors.green} strokeWidth={2} />,
      title: 'Bien‑être 360°',
      description: 'Sommeil, stress, humeur, hydratation',
      color: iosColors.green,
    },
  ]

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 160 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Image de fond */}
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

        {/* Contenu principal */}
        <Animated.View style={[styles.content, mainStyle]}>
          {/* Marque */}
          <View style={styles.brandContainer}>
            <Brain size={14} color={iosColors.purple} strokeWidth={2} />
            <Text style={[styles.brandName, { color: iosColors.purple }]}>LYM</Text>
          </View>

          {/* Titre */}
          <Text style={[styles.headline, { color: colors.text.primary }]}>
            La nutrition qui te transforme
          </Text>

          {/* Sous‑titre */}
          <Text style={[styles.subheadline, { color: colors.text.secondary }]}>
            Un coach IA complet pour ton alimentation et ton bien‑être. Analyses croisées et programme métabolique : bien plus qu'un tracker.
          </Text>

          {/* Grille des bénéfices */}
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

      {/* Footer avec CTA */}
      <View style={[styles.footer, { paddingBottom: safeBottom, backgroundColor: bgColor }]}>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            onGetStarted()
          }}
          activeOpacity={0.9}
          style={[styles.ctaButton, { backgroundColor: iosColors.green }]}
        >
          <Text style={styles.ctaText}>Commencer — 7 jours gratuits</Text>
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
            <Text style={[styles.haveAccountText, { color: colors.text.tertiary }]}>J'ai déjà un compte</Text>
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
    marginBottom: spacing.xl,
  },
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
