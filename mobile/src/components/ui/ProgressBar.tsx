import React from 'react'
import { View, StyleSheet, ViewStyle } from 'react-native'
import { colors, radius } from '../../constants/theme'

interface ProgressBarProps {
  value: number
  max: number
  color?: string
  backgroundColor?: string
  size?: 'sm' | 'md' | 'default' | 'lg'
  showOverflow?: boolean
  style?: ViewStyle
}

export function ProgressBar({
  value,
  max,
  color = colors.accent.primary,
  backgroundColor = colors.bg.tertiary,
  size = 'default',
  showOverflow = false,
  style,
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, showOverflow ? 150 : 100)
  const isOverflow = value > max

  const heights = {
    sm: 4,
    md: 6,
    default: 8,
    lg: 12,
  }

  return (
    <View
      style={[
        styles.container,
        { height: heights[size], backgroundColor },
        style,
      ]}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${Math.min(percentage, 100)}%`,
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
