/**
 * Animated Splash Screen
 *
 * Shows the LYM logo with a fade animation while the app loads.
 * Works in Expo Go (unlike native splash screen).
 */

import React, { useEffect, useRef } from 'react'
import {
  View,
  Image,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
} from 'react-native'

const { width, height } = Dimensions.get('window')

interface SplashScreenProps {
  onFinish: () => void
}

export function SplashScreen({ onFinish }: SplashScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.85)).current
  const glowAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Phase 1: Fade in with gentle scale (800ms)
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1), // ease-out cubic
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.elastic(1.2), // gentle bounce
        useNativeDriver: true,
      }),
    ]).start()

    // Phase 2: Subtle breathing/glow effect
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start()

    // Phase 3: Wait then fade out smoothly (after 2.5s total)
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 600,
        easing: Easing.bezier(0.55, 0.055, 0.675, 0.19), // ease-in cubic
        useNativeDriver: true,
      }).start(() => {
        onFinish()
      })
    }, 2500)

    return () => clearTimeout(timer)
  }, [fadeAnim, scaleAnim, glowAnim, onFinish])

  // Interpolate glow for subtle scale pulse
  const pulseScale = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.03],
  })

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [
              { scale: Animated.multiply(scaleAnim, pulseScale) },
            ],
          },
        ]}
      >
        <Image
          source={require('../../logo1.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logo: {
    width: width * 0.5,
    height: width * 0.5,
  },
})

export default SplashScreen
