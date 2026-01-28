/**
 * AnimatedSplash - Elegant animated splash screen
 *
 * Shows after the native splash with beautiful animations:
 * - Logo fade-in with spring scale
 * - Pulsing glow effect
 * - Tagline slide-up
 * - Smooth fade-out transition
 */

import React, { useEffect } from 'react'
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  Text,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'

const { width, height } = Dimensions.get('window')

// Brand colors
const BRAND_GREEN = '#34C759'
const BRAND_PURPLE = '#AF52DE'

interface AnimatedSplashProps {
  onAnimationComplete: () => void
}

export function AnimatedSplash({ onAnimationComplete }: AnimatedSplashProps) {
  // Animation values
  const logoOpacity = useSharedValue(0)
  const logoScale = useSharedValue(0.7)
  const glowScale = useSharedValue(0.8)
  const glowOpacity = useSharedValue(0)
  const taglineOpacity = useSharedValue(0)
  const taglineTranslateY = useSharedValue(30)
  const containerOpacity = useSharedValue(1)

  useEffect(() => {
    // Phase 1: Logo appears with spring (0-600ms)
    logoOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) })
    logoScale.value = withSpring(1, { damping: 12, stiffness: 100 })

    // Phase 2: Glow pulse starts (200ms delay)
    glowOpacity.value = withDelay(200, withTiming(0.6, { duration: 400 }))
    glowScale.value = withDelay(200,
      withRepeat(
        withSequence(
          withTiming(1.1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.9, { duration: 1200, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    )

    // Phase 3: Tagline slides up (500ms delay)
    taglineOpacity.value = withDelay(500, withTiming(1, { duration: 400 }))
    taglineTranslateY.value = withDelay(500, withSpring(0, { damping: 15, stiffness: 120 }))

    // Phase 4: Fade out (after 2s)
    const finishTimeout = setTimeout(() => {
      containerOpacity.value = withTiming(0, { duration: 400, easing: Easing.inOut(Easing.ease) }, (finished) => {
        if (finished) {
          runOnJS(onAnimationComplete)()
        }
      })
    }, 2000)

    return () => clearTimeout(finishTimeout)
  }, [])

  // Animated styles
  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }))

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }))

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }))

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [{ translateY: taglineTranslateY.value }],
  }))

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* Background gradient */}
      <LinearGradient
        colors={['#FFFFFF', '#F8FAFC', '#F1F5F9']}
        style={styles.gradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Glow effect */}
      <Animated.View style={[styles.glowContainer, glowStyle]}>
        <LinearGradient
          colors={[`${BRAND_GREEN}30`, `${BRAND_PURPLE}20`, 'transparent']}
          style={styles.glow}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      {/* Logo */}
      <Animated.View style={[styles.logoContainer, logoStyle]}>
        <Image
          source={require('../../assets/photo5.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Tagline */}
      <Animated.View style={[styles.taglineContainer, taglineStyle]}>
        <Text style={styles.tagline}>Nutrition intelligente</Text>
        <View style={styles.taglineDot} />
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    zIndex: 1000,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  glowContainer: {
    position: 'absolute',
    width: width * 0.8,
    height: width * 0.8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    width: '100%',
    height: '100%',
    borderRadius: width * 0.4,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    // Subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
  },
  logo: {
    width: width * 0.5,
    height: width * 0.5,
  },
  taglineContainer: {
    position: 'absolute',
    bottom: height * 0.18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  taglineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BRAND_GREEN,
  },
})

export default AnimatedSplash
