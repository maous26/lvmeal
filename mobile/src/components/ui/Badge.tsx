import React from 'react'
import { View, Text, StyleSheet, ViewStyle } from 'react-native'
import { colors, radius, spacing, typography } from '../../constants/theme'

type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'error'
type BadgeSize = 'sm' | 'default'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  size?: BadgeSize
  style?: ViewStyle
}

export function Badge({
  children,
  variant = 'default',
  size = 'default',
  style,
}: BadgeProps) {
  const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
    default: {
      bg: colors.accent.light,
      text: colors.accent.primary,
    },
    secondary: {
      bg: colors.bg.tertiary,
      text: colors.text.secondary,
    },
    success: {
      bg: `${colors.success}20`,
      text: colors.success,
    },
    warning: {
      bg: `${colors.warning}20`,
      text: colors.warning,
    },
    error: {
      bg: `${colors.error}20`,
      text: colors.error,
    },
  }

  const sizeStyles: Record<BadgeSize, ViewStyle> = {
    sm: {
      paddingVertical: 2,
      paddingHorizontal: spacing.sm,
    },
    default: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
    },
  }

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: variantStyles[variant].bg },
        sizeStyles[size],
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          size === 'sm' ? typography.caption : typography.small,
          { color: variantStyles[variant].text },
        ]}
      >
        {children}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '500',
  },
})

export default Badge
