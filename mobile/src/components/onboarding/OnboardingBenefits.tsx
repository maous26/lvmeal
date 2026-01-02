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
import {
  Camera,
  Mic,
  Sparkles,
  Heart,
  TrendingUp,
  ChevronRight,
} from 'lucide-react-native'
import { useTheme } from '../../contexts/ThemeContext'
import { spacing, radius, typography, shadows } from '../../constants/theme'
import { MockHomePreview } from './MockHomePreview'

const { width, height } = Dimensions.get('window')

interface BenefitSlide {
  id: string
  icon: React.ReactNode
  title: string
  subtitle: string
  description: string
  imagePlaceholder: string
  image?: any // Optional real image
  useMockPreview?: boolean // Use MockHomePreview instead of image
  accentColor: string
}

interface OnboardingBenefitsProps {
  onComplete: () => void
  onBack: () => void
}

export function OnboardingBenefits({ onComplete, onBack }: OnboardingBenefitsProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const flatListRef = useRef<FlatList>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  const benefits: BenefitSlide[] = [
    {
      id: 'easy',
      icon: <Camera size={28} color="#FFFFFF" />,
      title: 'Simple, vraiment.',
      subtitle: 'FACILITE',
      description:
        "Un repas, une photo, quelques mots.\nPas besoin d'etre precis ou parfait : LYM te comprend et t'aide a avancer.",
      imagePlaceholder: 'Photo de quelqu\'un prenant en photo son assiette',
      image: require('../../../assets/photo2.jpg'),
      accentColor: colors.accent.primary,
    },
    {
      id: 'personalized',
      icon: <Sparkles size={28} color="#FFFFFF" />,
      title: 'Adapte a ton rythme.',
      subtitle: 'PERSONNALISATION',
      description:
        "Ton quotidien, ton energie, tes habitudes.\nLYM s'adapte a toi dans le temps, sans te demander d'en faire plus.",
      imagePlaceholder: 'Interface personnalisee',
      useMockPreview: true,
      accentColor: '#A855F7',
    },
    {
      id: 'kind',
      icon: <Heart size={28} color="#FFFFFF" />,
      title: 'Sans jugement. Jamais.',
      subtitle: 'CONFIANCE',
      description:
        "Les ecarts, les pauses, les semaines chargees font partie du chemin.\nLYM t'aide a reprendre, pas a te reprocher.",
      imagePlaceholder: 'Personnes epanouies',
      accentColor: colors.secondary.primary,
    },
    {
      id: 'duration',
      icon: <TrendingUp size={28} color="#FFFFFF" />,
      title: 'Un equilibre qui tient.',
      subtitle: 'DUREE',
      description:
        "Pas de regime.\nPas de pression constante.\nUne structure souple pour avancer dans la vraie vie.",
      imagePlaceholder: 'Equilibre de vie',
      image: require('../../../assets/photo3.jpeg'),
      accentColor: colors.success,
    },
  ]

  const handleNext = () => {
    if (currentIndex < benefits.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 })
    } else {
      onComplete()
    }
  }

  const handleSkip = () => {
    onComplete()
  }

  const renderSlide = ({ item, index }: { item: BenefitSlide; index: number }) => (
    <View style={[styles.slide, { width }]}>
      {/* Image, MockPreview, or placeholder */}
      <View style={styles.imageContainer}>
        {item.useMockPreview ? (
          <View style={styles.mockPreviewContainer}>
            <MockHomePreview />
          </View>
        ) : item.image ? (
          <Image
            source={item.image}
            style={styles.slideImage}
            resizeMode="cover"
          />
        ) : (
          <LinearGradient
            colors={[item.accentColor + '20', item.accentColor + '40']}
            style={styles.imagePlaceholder}
          >
            <View style={styles.placeholderContent}>
              <View style={[styles.iconCircle, { backgroundColor: item.accentColor }]}>
                {item.icon}
              </View>
              <Text style={[styles.placeholderText, { color: item.accentColor }]}>
                {item.imagePlaceholder}
              </Text>
            </View>
          </LinearGradient>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.3)', colors.bg.primary]}
          locations={[0, 0.5, 1]}
          style={styles.imageOverlay}
        />
      </View>

      {/* Content */}
      <View style={styles.slideContent}>
        <Text style={[styles.subtitle, { color: item.accentColor }]}>
          {item.subtitle}
        </Text>
        <Text style={[styles.title, { color: colors.text.primary }]}>
          {item.title}
        </Text>
        <Text style={[styles.description, { color: colors.text.secondary }]}>
          {item.description}
        </Text>
      </View>
    </View>
  )

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      {/* Header with skip */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.text.tertiary }]}>← Retour</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
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
      />

      {/* Bottom section */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.xl }]}>
        {/* Progress dots */}
        <View style={styles.dots}>
          {benefits.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    index === currentIndex
                      ? colors.accent.primary
                      : colors.border.default,
                  width: index === currentIndex ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* CTA Button */}
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            handleNext()
          }}
          activeOpacity={0.8}
          style={[
            styles.ctaButton,
            { backgroundColor: colors.accent.primary },
            shadows.glowPrimary,
          ]}
        >
          <Text style={styles.ctaText}>
            {currentIndex === benefits.length - 1 ? 'C\'est parti !' : 'Continuer'}
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
    paddingBottom: spacing.sm,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  backButton: {
    padding: spacing.sm,
  },
  backText: {
    ...typography.small,
  },
  skipButton: {
    padding: spacing.sm,
  },
  skipText: {
    ...typography.small,
  },
  slide: {
    flex: 1,
  },
  imageContainer: {
    height: height * 0.45,
    position: 'relative',
  },
  slideImage: {
    width: '100%',
    height: '100%',
  },
  mockPreviewContainer: {
    flex: 1,
    transform: [{ scale: 0.85 }],
    borderRadius: radius.lg,
    overflow: 'hidden',
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
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  placeholderText: {
    ...typography.small,
    textAlign: 'center',
    fontStyle: 'italic',
    maxWidth: 200,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  slideContent: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  subtitle: {
    ...typography.captionMedium,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.h2,
    marginBottom: spacing.md,
  },
  description: {
    ...typography.body,
    lineHeight: 26,
  },
  bottom: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  dot: {
    height: 8,
    borderRadius: 4,
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
})

export default OnboardingBenefits
