import React from 'react'
import { View, StyleSheet, Text } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { colors, typography } from '../../constants/theme'

interface CircularProgressProps {
  value: number
  max: number
  size?: number
  strokeWidth?: number
  color?: string
  backgroundColor?: string
  showValue?: boolean
  label?: string
  unit?: string
}

export function CircularProgress({
  value,
  max,
  size = 120,
  strokeWidth = 10,
  color = colors.accent.primary,
  backgroundColor = colors.bg.tertiary,
  showValue = true,
  label,
  unit = '',
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const percentage = Math.min(value / max, 1)
  const strokeDashoffset = circumference * (1 - percentage)

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      {showValue && (
        <View style={styles.textContainer}>
          <Text style={[styles.value, { color }]}>
            {Math.round(value)}
            {unit && <Text style={styles.unit}>{unit}</Text>}
          </Text>
          {label && <Text style={styles.label}>{label}</Text>}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  value: {
    ...typography.h3,
    fontWeight: '700',
  },
  unit: {
    ...typography.small,
  },
  label: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
})

export default CircularProgress
