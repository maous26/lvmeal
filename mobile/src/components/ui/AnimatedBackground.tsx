import React from 'react'
import { View, StyleSheet, Dimensions } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '../../contexts/ThemeContext'

const { width, height } = Dimensions.get('window')

interface AnimatedBackgroundProps {
  // Props kept for backward compatibility (not used anymore)
  circleCount?: number
  minSize?: number
  maxSize?: number
  speed?: number
  intensity?: number
  colors?: string[]
}

/**
 * Simple static background with white base and subtle orange pastel gradient
 * Replaces the animated blobs for a cleaner, more performant look
 */
export function AnimatedBackground(_props: AnimatedBackgroundProps) {
  const { colors, isDark } = useTheme()

  // In dark mode, use a simple dark background
  if (isDark) {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg.primary }]} pointerEvents="none" />
    )
  }

  // Light mode: White with subtle orange pastel gradient
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Base white background */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF' }]} />

      {/* Subtle orange pastel gradient overlay - top right corner */}
      <LinearGradient
        colors={['rgba(255, 200, 144, 0.25)', 'rgba(255, 228, 196, 0.15)', 'transparent']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 0.6 }}
        style={styles.topRightGradient}
      />

      {/* Very subtle warm gradient at bottom */}
      <LinearGradient
        colors={['transparent', 'rgba(255, 212, 163, 0.1)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.bottomGradient}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  topRightGradient: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: width * 0.8,
    height: height * 0.5,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.3,
  },
})

export default AnimatedBackground
