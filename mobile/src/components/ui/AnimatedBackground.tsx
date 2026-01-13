import React, { useEffect, useRef } from 'react'
import { View, StyleSheet, Dimensions, Animated, Easing } from 'react-native'
import { useTheme } from '../../contexts/ThemeContext'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

interface Circle {
  id: number
  size: number
  x: number
  y: number
  color: string
  opacity: number
  animX: Animated.Value
  animY: Animated.Value
  animScale: Animated.Value
  duration: number
}

interface AnimatedBackgroundProps {
  /** Number of circles to display */
  circleCount?: number
  /** Minimum circle size */
  minSize?: number
  /** Maximum circle size */
  maxSize?: number
  /** Animation speed multiplier (1 = normal, 2 = faster) */
  speed?: number
  /** Opacity of circles (0-1) */
  intensity?: number
  /** Custom colors (uses theme colors by default) */
  colors?: string[]
}

export function AnimatedBackground({
  circleCount = 5,
  minSize = 150,
  maxSize = 350,
  speed = 1,
  intensity = 0.08,
  colors: customColors,
}: AnimatedBackgroundProps) {
  const { colors, isDark } = useTheme()
  const circlesRef = useRef<Circle[]>([])

  // Use theme colors or custom colors
  const circleColors = customColors || [
    colors.accent.primary,    // Vert Mousse
    colors.accent.secondary,  // Vert Mousse clair
    colors.secondary.primary, // Terre Cuite
    colors.accent.muted,      // Vert désaturé
    isDark ? colors.accent.light : colors.secondary.muted, // Variation selon le thème
  ]

  // Initialize circles only once
  if (circlesRef.current.length === 0) {
    circlesRef.current = Array.from({ length: circleCount }, (_, i) => ({
      id: i,
      size: minSize + Math.random() * (maxSize - minSize),
      x: Math.random() * SCREEN_WIDTH,
      y: Math.random() * SCREEN_HEIGHT,
      color: circleColors[i % circleColors.length],
      opacity: intensity * (0.5 + Math.random() * 0.5),
      animX: new Animated.Value(0),
      animY: new Animated.Value(0),
      animScale: new Animated.Value(1),
      duration: (15000 + Math.random() * 10000) / speed,
    }))
  }

  useEffect(() => {
    const animations = circlesRef.current.map((circle) => {
      // Horizontal movement
      const animateX = Animated.loop(
        Animated.sequence([
          Animated.timing(circle.animX, {
            toValue: 30 + Math.random() * 40,
            duration: circle.duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(circle.animX, {
            toValue: -(30 + Math.random() * 40),
            duration: circle.duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      )

      // Vertical movement
      const animateY = Animated.loop(
        Animated.sequence([
          Animated.timing(circle.animY, {
            toValue: 20 + Math.random() * 30,
            duration: circle.duration * 1.2,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(circle.animY, {
            toValue: -(20 + Math.random() * 30),
            duration: circle.duration * 1.2,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      )

      // Subtle scale pulse
      const animateScale = Animated.loop(
        Animated.sequence([
          Animated.timing(circle.animScale, {
            toValue: 1.1,
            duration: circle.duration * 1.5,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(circle.animScale, {
            toValue: 0.95,
            duration: circle.duration * 1.5,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      )

      return Animated.parallel([animateX, animateY, animateScale])
    })

    animations.forEach((anim) => anim.start())

    return () => {
      animations.forEach((anim) => anim.stop())
    }
  }, [])

  return (
    <View style={styles.container} pointerEvents="none">
      {circlesRef.current.map((circle) => (
        <Animated.View
          key={circle.id}
          style={[
            styles.circle,
            {
              width: circle.size,
              height: circle.size,
              borderRadius: circle.size / 2,
              backgroundColor: circle.color,
              opacity: circle.opacity,
              left: circle.x - circle.size / 2,
              top: circle.y - circle.size / 2,
              transform: [
                { translateX: circle.animX },
                { translateY: circle.animY },
                { scale: circle.animScale },
              ],
            },
          ]}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  circle: {
    position: 'absolute',
  },
})

export default AnimatedBackground
