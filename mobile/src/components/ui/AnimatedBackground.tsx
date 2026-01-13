import React, { useEffect } from 'react'
import { View, StyleSheet, Dimensions } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  withDelay
} from 'react-native-reanimated'
import { useTheme } from '../../contexts/ThemeContext'
import { blobPalettes } from '../../constants/theme'
import { useUserStore } from '../../stores/user-store'

const { width, height } = Dimensions.get('window')

interface AnimatedBackgroundProps {
  circleCount?: number
  minSize?: number
  maxSize?: number
  speed?: number
  intensity?: number
  colors?: string[]
}

const Blob = ({ color, size, top, left, delay = 0 }: { color: string, size: number, top: number, left: number, delay?: number }) => {
  const scale = useSharedValue(1)
  const translateY = useSharedValue(0)
  const translateX = useSharedValue(0)

  useEffect(() => {
    // Fluid breathing animation (scale)
    scale.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(1.25, { duration: 8000, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    ))

    // Vertical floating - large range for fluidity
    translateY.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(-40, { duration: 10000, easing: Easing.inOut(Easing.sin) }),
        withTiming(20, { duration: 9000, easing: Easing.inOut(Easing.sin) }),
        withTiming(-20, { duration: 9000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    ))

    // Horizontal floating
    translateX.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(30, { duration: 11000, easing: Easing.inOut(Easing.sin) }),
        withTiming(-30, { duration: 11000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    ))
  }, [])

  const style = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
      { translateX: translateX.value }
    ]
  }))

  return (
    <Animated.View
      style={[
        styles.blob,
        style,
        {
          backgroundColor: color,
          width: size,
          height: size,
          top,
          left,
          borderRadius: size / 2,
        }
      ]}
    />
  )
}

export function AnimatedBackground({
  circleCount = 4, // kept for prop compatibility
  intensity = 0.08, // kept for prop compatibility
}: AnimatedBackgroundProps) {
  const { colors, isDark } = useTheme()
  const blobPaletteId = useUserStore((s) => s.blobPalette)

  // Get the selected palette (only applies in light mode)
  // In dark mode, we use the theme's accent colors
  const palette = isDark ? null : blobPalettes[blobPaletteId] || blobPalettes.default

  // Determine blob colors based on mode and palette
  const blobColors = isDark
    ? {
        topRight: colors.accent.primary,
        middleLeft: colors.secondary.primary,
        bottomRight: colors.warning,
        topLeft: '#8B6914', // Dark mode pastel
      }
    : {
        topRight: palette?.colors.topRight || colors.accent.primary,
        middleLeft: palette?.colors.middleLeft || colors.secondary.primary,
        bottomRight: palette?.colors.bottomRight || colors.warning,
        topLeft: palette?.colors.topLeft || '#FFD8B1',
      }

  // We use the curated blobs approach which is cleaner and more aesthetic than random circles
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Top Right blob */}
      <Blob
        color={blobColors.topRight}
        size={width * 0.85}
        top={-width * 0.25}
        left={width * 0.35}
      />

      {/* Middle Left blob */}
      <Blob
        color={blobColors.middleLeft}
        size={width * 0.75}
        top={height * 0.25}
        left={-width * 0.35}
        delay={2000}
      />

      {/* Bottom Right blob */}
      <Blob
        color={blobColors.bottomRight}
        size={width * 0.9}
        top={height * 0.65}
        left={width * 0.25}
        delay={1000}
      />

      {/* Top Left pastel touch */}
      <Blob
        color={blobColors.topLeft}
        size={width * 0.7}
        top={height * 0.1}
        left={-width * 0.1}
        delay={3000}
      />

      {/* Overlay to diffuse everything */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg.primary, opacity: isDark ? 0.5 : 0.3 }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
    opacity: 0.6, // Base opacity of blobs
  }
})

export default AnimatedBackground
