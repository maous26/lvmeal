import React from 'react'
import {
  Pressable,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  View,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../../contexts/ThemeContext'
import { radius, spacing, typography, shadows } from '../../constants/theme'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'default'
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
  iconPosition?: 'left' | 'right'
  style?: ViewStyle
}

export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'default',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  style,
}: ButtonProps) {
  const { colors } = useTheme()

  const handlePress = () => {
    if (!disabled && !loading) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      onPress()
    }
  }

  const getVariantStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (variant) {
      case 'primary':
        return {
          container: {
            backgroundColor: colors.accent.primary,
            ...shadows.default,
          },
          text: { color: '#FFFFFF' },
        }
      case 'secondary':
        return {
          container: {
            backgroundColor: colors.secondary.primary,
            ...shadows.default,
          },
          text: { color: '#FFFFFF' },
        }
      case 'outline':
        return {
          container: {
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderColor: colors.border.default,
          },
          text: { color: colors.text.primary },
        }
      case 'ghost':
        return {
          container: {
            backgroundColor: 'transparent',
          },
          text: { color: colors.accent.primary },
        }
      case 'danger':
        return {
          container: {
            backgroundColor: colors.error,
            ...shadows.default,
          },
          text: { color: '#FFFFFF' },
        }
      case 'success':
        return {
          container: {
            backgroundColor: colors.success,
            ...shadows.default,
          },
          text: { color: '#FFFFFF' },
        }
      default:
        return {
          container: { backgroundColor: colors.accent.primary },
          text: { color: '#FFFFFF' },
        }
    }
  }

  const getSizeStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (size) {
      case 'sm':
        return {
          container: {
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: radius.md,
          },
          text: { ...typography.buttonSm },
        }
      case 'lg':
        return {
          container: {
            paddingVertical: spacing.lg,
            paddingHorizontal: spacing.xl,
            borderRadius: radius.xl,
          },
          text: { ...typography.button, fontSize: 17 },
        }
      default:
        return {
          container: {
            paddingVertical: spacing.default,
            paddingHorizontal: spacing.lg,
            borderRadius: radius.lg,
          },
          text: { ...typography.button },
        }
    }
  }

  const variantStyles = getVariantStyles()
  const sizeStyles = getSizeStyles()

  // Extract backgroundColor from style prop to ensure it overrides variant
  const styleObj = style as ViewStyle | undefined
  const customBgColor = styleObj?.backgroundColor

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        variantStyles.container,
        sizeStyles.container,
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
        // Force backgroundColor override at the end
        customBgColor ? { backgroundColor: customBgColor } : undefined,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variantStyles.text.color as string}
        />
      ) : (
        <View style={styles.content}>
          {icon && iconPosition === 'left' && (
            <View style={styles.iconLeft}>{icon}</View>
          )}
          <Text
            style={[
              styles.text,
              variantStyles.text,
              sizeStyles.text,
            ]}
          >
            {children}
          </Text>
          {icon && iconPosition === 'right' && (
            <View style={styles.iconRight}>{icon}</View>
          )}
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    textAlign: 'center',
  },
  iconLeft: {
    marginRight: spacing.sm,
  },
  iconRight: {
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
