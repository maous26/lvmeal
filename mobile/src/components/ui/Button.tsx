import React from 'react'
import {
  Pressable,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { colors, radius, spacing, typography } from '../../constants/theme'

type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'default' | 'lg'

interface ButtonProps {
  children: React.ReactNode
  onPress: () => void
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  fullWidth?: boolean
  icon?: React.ReactNode
  style?: ViewStyle
}

export function Button({
  children,
  onPress,
  variant = 'default',
  size = 'default',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  style,
}: ButtonProps) {
  const handlePress = () => {
    if (!disabled && !loading) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      onPress()
    }
  }

  const variantStyles: Record<ButtonVariant, { container: ViewStyle; text: TextStyle }> = {
    default: {
      container: { backgroundColor: colors.accent.primary },
      text: { color: '#FFFFFF' },
    },
    secondary: {
      container: { backgroundColor: colors.secondary.primary },
      text: { color: '#FFFFFF' },
    },
    outline: {
      container: {
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: colors.border.default,
      },
      text: { color: colors.text.primary },
    },
    ghost: {
      container: { backgroundColor: 'transparent' },
      text: { color: colors.accent.primary },
    },
    danger: {
      container: { backgroundColor: colors.error },
      text: { color: '#FFFFFF' },
    },
  }

  const sizeStyles: Record<ButtonSize, { container: ViewStyle; text: TextStyle }> = {
    sm: {
      container: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
      text: { fontSize: 14 },
    },
    default: {
      container: { paddingVertical: spacing.md, paddingHorizontal: spacing.default },
      text: { fontSize: 16 },
    },
    lg: {
      container: { paddingVertical: spacing.default, paddingHorizontal: spacing.xl },
      text: { fontSize: 18 },
    },
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        variantStyles[variant].container,
        sizeStyles[size].container,
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variantStyles[variant].text.color}
        />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.text,
              variantStyles[variant].text,
              sizeStyles[size].text,
              icon ? styles.textWithIcon : null,
            ]}
          >
            {children}
          </Text>
        </>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
  textWithIcon: {
    marginLeft: spacing.sm,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
})

export default Button
