import React from 'react'
import { View, StyleSheet, ViewStyle, Pressable } from 'react-native'
import { colors, shadows, radius, spacing } from '../../constants/theme'

interface CardProps {
  children: React.ReactNode
  style?: ViewStyle
  padding?: 'none' | 'sm' | 'default' | 'lg'
  onPress?: () => void
  elevated?: boolean
}

export function Card({
  children,
  style,
  padding = 'default',
  onPress,
  elevated = true,
}: CardProps) {
  const paddingValue = {
    none: 0,
    sm: spacing.sm,
    default: spacing.default,
    lg: spacing.lg,
  }[padding]

  const cardStyle = [
    styles.card,
    elevated && shadows.sm,
    { padding: paddingValue },
    style,
  ]

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          cardStyle,
          pressed && styles.pressed,
        ]}
      >
        {children}
      </Pressable>
    )
  }

  return <View style={cardStyle}>{children}</View>
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
})

export default Card
