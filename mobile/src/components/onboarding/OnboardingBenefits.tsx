/**
 * OnboardingBenefits - iOS-style benefits carousel
 *
 * Features:
 * - Clean iOS design with dynamic accent colors
 * - Hybrid layout: visual top, content bottom
 * - Smooth animations with Reanimated
 * - Progress dots with animated width
 */

import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { FadeInUp } from 'react-native-reanimated'
import {
  Camera,
  Sparkles,
  Heart,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react-native'
import { useTheme } from '../../contexts/ThemeContext'
import { spacing, radius, typography, fonts } from '../../constants/theme'
import { MockHomePreview } from './MockHomePreview'

const { width, height } = Dimensions.get('window')

interface BenefitSlide {
  id: string
  icon: React.ReactNode
  title: string
  subtitle: string
  description: string
  image?: any
  useMockPreview?: boolean
  accentColor: string
  gradient: readonly [string, string]
}

interface OnboardingBenefitsProps {
  onComplete: () => void
  onBack: () => void
}

export function OnboardingBenefits({ onComplete, onBack }: OnboardingBenefitsProps) {
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const flatListRef = useRef<FlatList>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  const benefits: BenefitSlide[] = [
    {
      id: 'easy',
      icon: <Camera size={24} color="#FFFFFF" />,
      title: 'Simple comme bonjour',
      subtitle: 'FACILITÉ',
      description: 'Une photo, quelques mots, c\'est tout. Pas de calculs, pas de pesée. Tu manges, tu notes, tu avances.',
      image: require('../../../assets/photo2.jpg'),
      accentColor: '#2C2520',
      gradient: ['#2C2520', '#5C5550'] as const,
    },
    {
      id: 'personalized',
      icon: <Sparkles size={24} color="#FFFFFF" />,
      title: 'Fait pour toi',
      subtitle: 'PERSONNALISATION',
      description: 'Tes goûts, ton rythme, ta vie. Tout est pensé autour de qui tu es vraiment.',
      useMockPreview: true,
      accentColor: '#9B8BB8',
      gradient: ['#9B8BB8', '#8A7AA8'] as const,
    },
    {
      id: 'kind',
      icon: <Heart size={24} color="#FFFFFF" />,
      title: 'Zéro culpabilité',
      subtitle: 'BIENVEILLANCE',
      description: 'Un écart ? Une pause ? C\'est humain. Ici, chaque jour est une nouvelle chance.',
      accentColor: '#7A9E7E',
      gradient: ['#7A9E7E', '#5C8A61'] as const,
    },
    {
      id: 'duration',
      icon: <TrendingUp size={24} color="#FFFFFF" />,
      title: 'Résultats durables',
      subtitle: 'DURABILITÉ',
      description: 'Fini les régimes yo-yo. Tu construis des habitudes saines, à ton rythme, pour la vie.',
      image: require('../../../assets/photo3.jpeg'),
      accentColor: '#C4956A',
      gradient: ['#C4956A', '#B5845A'] as const,
    },
  ]

  const currentBenefit = benefits[currentIndex]

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (currentIndex < benefits.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 })
    } else {
      onComplete()
    }
  }

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onComplete()
  }

  const renderSlide = ({ item }: { item: BenefitSlide }) => (
    <View style={[styles.slide, { width }]}>
      {/* Visual Area - Top */}
      <View style={styles.visualArea}>
        {item.useMockPreview ? (
          <View style={styles.mockPreviewWrapper}>
            <View style={[
              styles.mockPreviewCard,
              {
                backgroundColor: colors.bg.elevated,
                borderColor: colors.border.light,
              }
            ]}>
              <MockHomePreview />
            </View>
          </View>
        ) : item.image ? (
          <View style={styles.imageWrapper}>
            <Image
              source={item.image}
              style={styles.slideImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['transparent', isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)']}
              style={styles.imageGradient}
            />
          </View>
        ) : (
          <LinearGradient
            colors={item.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientPlaceholder}
          >
            <View style={styles.iconLarge}>
              {React.cloneElement(item.icon as React.ReactElement, { size: 48 })}
            </View>
          </LinearGradient>
        )}
      </View>
    </View>
  )

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <TouchableOpacity
          onPress={onBack}
          style={[styles.headerButton, { backgroundColor: colors.bg.secondary }]}
          activeOpacity={0.7}
        >
          <ChevronLeft size={20} color={colors.text.secondary} />
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSkip} style={styles.skipButton} activeOpacity={0.7}>
          <Text style={[styles.skipText, { color: colors.text.tertiary }]}>Passer</Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={benefits}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width)
          setCurrentIndex(index)
        }}
        scrollEventThrottle={16}
        style={styles.flatList}
      />

      {/* Content Card - Bottom */}
      <Animated.View
        entering={FadeInUp.delay(100).springify()}
        style={[styles.contentCard, { backgroundColor: colors.bg.primary }]}
        key={currentIndex}
      >
        {/* Badge */}
        <View style={[styles.badge, { backgroundColor: currentBenefit.accentColor + '15' }]}>
          <View style={[styles.badgeIcon, { backgroundColor: currentBenefit.accentColor }]}>
            {React.cloneElement(currentBenefit.icon as React.ReactElement, { size: 14 })}
          </View>
          <Text style={[styles.badgeText, { color: currentBenefit.accentColor }]}>
            {currentBenefit.subtitle}
          </Text>
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.text.primary }]}>
          {currentBenefit.title}
        </Text>

        {/* Description */}
        <Text style={[styles.description, { color: colors.text.secondary }]}>
          {currentBenefit.description}
        </Text>

        {/* Progress dots */}
        <View style={styles.dotsContainer}>
          {benefits.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor: index === currentIndex
                    ? currentBenefit.accentColor
                    : colors.border.light,
                  width: index === currentIndex ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>
      </Animated.View>

      {/* Bottom Action */}
      <View style={[styles.bottomAction, { paddingBottom: insets.bottom + spacing.lg }]}>
        <TouchableOpacity
          onPress={handleNext}
          activeOpacity={0.9}
          style={[styles.nextButton, { backgroundColor: currentBenefit.accentColor }]}
        >
          <Text style={styles.nextButtonText}>
            {currentIndex === benefits.length - 1 ? "C'est parti" : 'Continuer'}
          </Text>
          <ChevronRight size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  skipText: {
    ...typography.small,
    fontFamily: fonts.sans.medium,
  },
  flatList: {
    flex: 1,
  },
  slide: {
    flex: 1,
  },
  visualArea: {
    height: height * 0.5,
    position: 'relative',
  },
  imageWrapper: {
    flex: 1,
    position: 'relative',
  },
  slideImage: {
    width: '100%',
    height: '100%',
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  mockPreviewWrapper: {
    flex: 1,
    padding: spacing.lg,
    paddingTop: spacing.xl * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockPreviewCard: {
    width: '100%',
    height: '100%',
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    transform: [{ scale: 0.9 }],
  },
  gradientPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLarge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentCard: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  badgeIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    ...typography.captionMedium,
    fontFamily: fonts.sans.semibold,
    letterSpacing: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: fonts.sans.bold,
    marginBottom: spacing.sm,
    letterSpacing: -0.5,
  },
  description: {
    ...typography.body,
    fontFamily: fonts.sans.regular,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  bottomAction: {
    paddingHorizontal: spacing.xl,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: fonts.sans.semibold,
  },
})

export default OnboardingBenefits
