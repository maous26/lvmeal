import React from 'react'
import { View, StyleSheet } from 'react-native'
import { useTheme } from '../../contexts/ThemeContext'

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
 * iOS-style clean background
 * Simple solid color - white in light mode, black in dark mode
 */
export function AnimatedBackground(_props: AnimatedBackgroundProps) {
  const { colors } = useTheme()

  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg.primary }]}
      pointerEvents="none"
    />
  )
}

export default AnimatedBackground
