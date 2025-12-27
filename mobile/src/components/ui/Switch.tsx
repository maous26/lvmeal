import React from 'react'
import { View, Text, StyleSheet, Pressable, ViewStyle } from 'react-native'
import { colors, radius, spacing, typography } from '../../constants/theme'

interface SwitchProps {
  value: boolean
  onValueChange: (value: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
  containerStyle?: ViewStyle
}

export function Switch({
  value,
  onValueChange,
  label,
  description,
  disabled = false,
  containerStyle,
}: SwitchProps) {
  const handlePress = () => {
    if (!disabled) {
      onValueChange(!value)
    }
  }

  return (
    <Pressable
      onPress={handlePress}
      style={[styles.container, disabled && styles.disabled, containerStyle]}
    >
      <View style={styles.content}>
        {label && <Text style={styles.label}>{label}</Text>}
        {description && <Text style={styles.description}>{description}</Text>}
      </View>

      <View style={[styles.track, value && styles.trackActive]}>
        <View style={[styles.thumb, value && styles.thumbActive]} />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  disabled: {
    opacity: 0.5,
  },
  content: {
    flex: 1,
    marginRight: spacing.md,
  },
  label: {
    ...typography.body,
    color: colors.text.primary,
  },
  description: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  track: {
    width: 52,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.bg.tertiary,
    padding: 2,
  },
  trackActive: {
    backgroundColor: colors.accent.primary,
  },
  thumb: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.bg.elevated,
  },
  thumbActive: {
    transform: [{ translateX: 20 }],
  },
})

export default Switch
