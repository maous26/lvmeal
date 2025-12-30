import React from 'react'
import { View, StyleSheet, ViewStyle, Pressable, StyleProp } from 'react-native'
import { useTheme } from '../../contexts/ThemeContext'
import { shadows, radius, spacing } from '../../constants/theme'

interface CardProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  padding?: 'none' | 'sm' | 'default' | 'lg'
  onPress?: () => void
  elevated?: boolean
  variant?: 'default' | 'outlined' | 'filled'
}

export function Card({
  children,
  style,
  padding = 'default',
  onPress,
  elevated = true,
  variant = 'default',
}: CardProps) {
  const { colors } = useTheme()

  const paddingValue = {
    none: 0,
    sm: spacing.sm,
    default: spacing.default,
    lg: spacing.lg,
  }[padding]

  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'outlined':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.border.light,
        }
      case 'filled':
        return {
          backgroundColor: colors.bg.secondary,
          borderWidth: 0,
        }
      default:
        return {
          backgroundColor: colors.bg.elevated,
          borderWidth: 1,
          borderColor: colors.border.light,
        }
    }
  }

  const cardStyle: ViewStyle[] = [
    styles.card,
    getVariantStyles(),
    elevated && variant === 'default' && shadows.sm,
    { padding: paddingValue },
    style as ViewStyle,
  ].filter(Boolean) as ViewStyle[]

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          ...cardStyle,
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
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },
})

export default Card
