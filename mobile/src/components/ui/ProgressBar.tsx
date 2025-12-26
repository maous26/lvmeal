import React from 'react'
import { View, StyleSheet, ViewStyle } from 'react-native'
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { colors, radius } from '../../constants/theme'

interface ProgressBarProps {
  value: number
  max: number
  color?: string
  backgroundColor?: string
  size?: 'sm' | 'default' | 'lg'
  animated?: boolean
  showOverflow?: boolean
  style?: ViewStyle
}

export function ProgressBar({
  value,
  max,
  color = colors.accent.primary,
  backgroundColor = colors.bg.tertiary,
  size = 'default',
  animated = true,
  showOverflow = false,
  style,
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, showOverflow ? 150 : 100)
  const isOverflow = value > max

  const heights = {
    sm: 4,
    default: 8,
    lg: 12,
  }

  const animatedStyle = useAnimatedStyle(() => {
    const width = animated
      ? withSpring(percentage, { damping: 15, stiffness: 100 })
      : withTiming(percentage, { duration: 300 })

    return {
      width: `${Math.min(width, 100)}%`,
    }
  }, [percentage, animated])

  return (
    <View
      style={[
        styles.container,
        { height: heights[size], backgroundColor },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.fill,
          animatedStyle,
          {
            backgroundColor: isOverflow ? colors.warning : color,
            borderRadius: radius.full,
          },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.full,
  },
})

export default ProgressBar
