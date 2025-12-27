import React from 'react'
import { View, Text, StyleSheet, ViewStyle } from 'react-native'
import { colors, radius, spacing, typography } from '../../constants/theme'

export type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'outline'
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
  const variantStyles: Record<BadgeVariant, { bg: string; text: string; border?: string }> = {
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
    info: {
      bg: 'rgba(59, 130, 246, 0.15)',
      text: '#3B82F6',
    },
    outline: {
      bg: 'transparent',
      text: colors.text.secondary,
      border: colors.border.default,
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

  const currentVariant = variantStyles[variant]

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: currentVariant.bg },
        currentVariant.border ? { borderWidth: 1, borderColor: currentVariant.border } : null,
        sizeStyles[size],
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          size === 'sm' ? typography.caption : typography.small,
          { color: currentVariant.text },
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
