import React from 'react'
import { View, Text, StyleSheet, ViewStyle } from 'react-native'
import RNSlider from '@react-native-community/slider'
import { colors, spacing, typography } from '../../constants/theme'

interface SliderProps {
  value: number
  onValueChange: (value: number) => void
  minimumValue?: number
  maximumValue?: number
  step?: number
  label?: string
  showValue?: boolean
  formatValue?: (value: number) => string
  disabled?: boolean
  containerStyle?: ViewStyle
}

export function Slider({
  value,
  onValueChange,
  minimumValue = 0,
  maximumValue = 100,
  step = 1,
  label,
  showValue = true,
  formatValue = (v) => String(Math.round(v)),
  disabled = false,
  containerStyle,
}: SliderProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      {(label || showValue) && (
        <View style={styles.header}>
          {label && <Text style={styles.label}>{label}</Text>}
          {showValue && (
            <Text style={styles.value}>{formatValue(value)}</Text>
          )}
        </View>
      )}

      <RNSlider
        style={styles.slider}
        value={value}
        onValueChange={onValueChange}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        step={step}
        disabled={disabled}
        minimumTrackTintColor={colors.accent.primary}
        maximumTrackTintColor={colors.bg.tertiary}
        thumbTintColor={colors.accent.primary}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.smallMedium,
    color: colors.text.secondary,
  },
  value: {
    ...typography.bodySemibold,
    color: colors.accent.primary,
  },
  slider: {
    width: '100%',
    height: 40,
  },
})

export default Slider
