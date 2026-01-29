/**
 * Custom Splash Screen with LYM logo
 * Displays Photo5.png with a fade-out animation
 */

import React, { useEffect } from 'react'
import { View, Image, StyleSheet, Dimensions } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated'

const { width, height } = Dimensions.get('window')

interface SplashScreenProps {
  onFinish: () => void
  duration?: number // Total duration in ms before fade out
}

export function SplashScreen({ onFinish, duration = 2000 }: SplashScreenProps) {
  const opacity = useSharedValue(1)
  const scale = useSharedValue(0.9)

  useEffect(() => {
    // Initial scale animation (subtle zoom in)
    scale.value = withTiming(1, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    })

    // Fade out after duration
    opacity.value = withDelay(
      duration,
      withTiming(0, {
        duration: 400,
        easing: Easing.out(Easing.cubic),
      }, (finished) => {
        if (finished) {
          runOnJS(onFinish)()
        }
      })
    )
  }, [duration, onFinish])

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }))

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <View style={styles.logoContainer}>
        <Image
          source={require('../../assets/photo5.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  logoContainer: {
    width: width * 0.5,
    height: width * 0.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
})

export default SplashScreen
