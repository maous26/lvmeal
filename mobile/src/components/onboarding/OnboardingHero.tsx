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
import {
  ChevronRight,
  Camera,
  Sparkles,
  Heart,
  Brain,
  Leaf,
} from 'lucide-react-native'
import { useTheme } from '../../contexts/ThemeContext'
import { spacing, radius, typography, fonts, organicPalette } from '../../constants/theme'

const { width, height } = Dimensions.get('window')

interface OnboardingHeroProps {
  onGetStarted: () => void
  onHaveAccount?: () => void
}

export function OnboardingHero({ onGetStarted, onHaveAccount }: OnboardingHeroProps) {
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const offWhite = '#FAF9F7'
  const cream = '#F8F6F1'
  const footerHeight = 52 + spacing.lg + spacing.md + insets.bottom

  // Smooth fade-in animation
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 900,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 900,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

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
      description: 'Coach IA',
      color: organicPalette.ocean,
    },
  ]

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
          {/* Multi-layer gradient for depth */}
          <LinearGradient
            colors={['transparent', 'rgba(250,249,247,0.2)', 'rgba(250,249,247,0.8)', offWhite]}
            locations={[0, 0.4, 0.7, 1]}
            style={styles.imageOverlay}
          />
          {/* Subtle vignette effect */}
          <LinearGradient
            colors={['rgba(0,0,0,0.1)', 'transparent', 'transparent']}
            style={styles.vignetteTop}
          />
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Brand with leaf accent */}
          <View style={styles.brandContainer}>
            <Leaf size={14} color={organicPalette.sage} strokeWidth={1.5} />
            <Text style={[styles.brandName, { color: organicPalette.moss }]}>
              LYM
            </Text>
          </View>

          {/* Main headline - serif luxury */}
          <Text style={[styles.headline, { color: colors.text.primary }]}>
            Retrouve le plaisir{'\n'}de bien manger
          </Text>

          {/* Elegant divider */}
          <View style={styles.dividerContainer}>
            <View style={[styles.dividerLine, { backgroundColor: organicPalette.sage + '40' }]} />
            <View style={[styles.dividerDot, { backgroundColor: organicPalette.sage }]} />
            <View style={[styles.dividerLine, { backgroundColor: organicPalette.sage + '40' }]} />
          </View>

          {/* Subheadline */}
          <Text style={[styles.subheadline, { color: colors.text.secondary }]}>
            Un compagnon qui s'adapte à toi,{'\n'}sans pression, sans jugement.
          </Text>

          {/* Benefits Grid 2x2 - Premium cards */}
          <View style={styles.benefitsGrid}>
            {benefits.map((benefit) => (
              <View
                key={benefit.id}
                style={[styles.benefitCard, { backgroundColor: cream }]}
              >
                <View style={[styles.benefitIcon, { backgroundColor: benefit.color + '12' }]}>
                  {benefit.icon}
                </View>
                <Text style={[styles.benefitTitle, { color: colors.text.primary }]}>
                  {benefit.title}
                </Text>
                <Text style={[styles.benefitDescription, { color: colors.text.tertiary }]}>
                  {benefit.description}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Premium CTA footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md, backgroundColor: offWhite }]}>
        {/* Subtle top shadow */}
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
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
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
    marginBottom: spacing.md,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
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
    marginBottom: spacing.xl,
  },
  benefitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  benefitCard: {
    width: (width - spacing.xl * 2 - spacing.sm) / 2,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    alignItems: 'center',
    // Premium subtle shadow via border
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  benefitTitle: {
    fontSize: 13,
    fontFamily: fonts.sans.semibold,
    letterSpacing: 0.2,
    marginBottom: 2,
    textAlign: 'center',
  },
  benefitDescription: {
    fontSize: 11,
    fontFamily: fonts.sans.regular,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
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
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    gap: spacing.sm,
    // Premium shadow
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
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  haveAccountText: {
    fontSize: 14,
    fontFamily: fonts.sans.medium,
    letterSpacing: 0.2,
  },
})

export default OnboardingHero
