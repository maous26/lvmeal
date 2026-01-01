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
} from 'react-native'

const { width, height } = Dimensions.get('window')

interface SplashScreenProps {
  onFinish: () => void
}

export function SplashScreen({ onFinish }: SplashScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.8)).current

  useEffect(() => {
    // Fade in and scale up
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start()

    // Wait then fade out and finish
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        onFinish()
      })
    }, 1500)

    return () => clearTimeout(timer)
  }, [fadeAnim, scaleAnim, onFinish])

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
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
