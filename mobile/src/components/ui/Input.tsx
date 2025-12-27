import React, { useState } from 'react'
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  ViewStyle,
  TextInputProps,
  Pressable,
} from 'react-native'
import { colors, radius, spacing, typography } from '../../constants/theme'

interface InputProps extends TextInputProps {
  label?: string
  hint?: string
  error?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  onRightIconPress?: () => void
  containerStyle?: ViewStyle
}

export function Input({
  label,
  hint,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  style,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false)

  return (
    <View style={containerStyle}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused,
          error && styles.inputContainerError,
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}

        <TextInput
          style={[
            styles.input,
            leftIcon ? styles.inputWithLeftIcon : undefined,
            rightIcon ? styles.inputWithRightIcon : undefined,
            style,
          ]}
          placeholderTextColor={colors.text.muted}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />

        {rightIcon && (
          <Pressable onPress={onRightIconPress} style={styles.rightIcon}>
            {rightIcon}
          </Pressable>
        )}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      {hint && !error && <Text style={styles.hint}>{hint}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  label: {
    ...typography.smallMedium,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.elevated,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    borderRadius: radius.md,
    minHeight: 48,
  },
  inputContainerFocused: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.bg.primary,
  },
  inputContainerError: {
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
    paddingHorizontal: spacing.default,
    paddingVertical: spacing.md,
  },
  inputWithLeftIcon: {
    paddingLeft: spacing.xs,
  },
  inputWithRightIcon: {
    paddingRight: spacing.xs,
  },
  leftIcon: {
    paddingLeft: spacing.md,
  },
  rightIcon: {
    paddingRight: spacing.md,
  },
  hint: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  error: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
})

export default Input
