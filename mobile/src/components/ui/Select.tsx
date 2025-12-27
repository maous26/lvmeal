import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  FlatList,
  ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radius, spacing, typography, shadows } from '../../constants/theme'

interface SelectOption<T> {
  value: T
  label: string
  description?: string
  icon?: string
}

interface SelectProps<T> {
  label?: string
  placeholder?: string
  value?: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  disabled?: boolean
  error?: string
  containerStyle?: ViewStyle
}

export function Select<T extends string | number>({
  label,
  placeholder = 'Selectionner',
  value,
  options,
  onChange,
  disabled = false,
  error,
  containerStyle,
}: SelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const insets = useSafeAreaInsets()

  const selectedOption = options.find((opt) => opt.value === value)

  const handleSelect = (option: SelectOption<T>) => {
    onChange(option.value)
    setIsOpen(false)
  }

  return (
    <View style={containerStyle}>
      {label && <Text style={styles.label}>{label}</Text>}

      <Pressable
        onPress={() => !disabled && setIsOpen(true)}
        style={[
          styles.trigger,
          disabled && styles.triggerDisabled,
          error && styles.triggerError,
        ]}
      >
        {selectedOption?.icon && (
          <Text style={styles.triggerIcon}>{selectedOption.icon}</Text>
        )}
        <Text
          style={[
            styles.triggerText,
            !selectedOption && styles.triggerPlaceholder,
          ]}
        >
          {selectedOption?.label || placeholder}
        </Text>
        <Text style={styles.chevron}>▼</Text>
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}

      <Modal
        visible={isOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)} />

        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{label || 'Selectionner'}</Text>
          </View>

          <FlatList
            data={options}
            keyExtractor={(item) => String(item.value)}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleSelect(item)}
                style={[
                  styles.option,
                  item.value === value && styles.optionSelected,
                ]}
              >
                {item.icon && <Text style={styles.optionIcon}>{item.icon}</Text>}
                <View style={styles.optionContent}>
                  <Text
                    style={[
                      styles.optionLabel,
                      item.value === value && styles.optionLabelSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {item.description && (
                    <Text style={styles.optionDescription}>{item.description}</Text>
                  )}
                </View>
                {item.value === value && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </Pressable>
            )}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  label: {
    ...typography.smallMedium,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.elevated,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    borderRadius: radius.md,
    paddingHorizontal: spacing.default,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  triggerDisabled: {
    opacity: 0.5,
  },
  triggerError: {
    borderColor: colors.error,
  },
  triggerIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  triggerText: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
  },
  triggerPlaceholder: {
    color: colors.text.muted,
  },
  chevron: {
    fontSize: 10,
    color: colors.text.tertiary,
    marginLeft: spacing.sm,
  },
  error: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg.overlay,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bg.elevated,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    maxHeight: '70%',
    ...shadows.lg,
  },
  sheetHeader: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: colors.border.default,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
  },
  sheetTitle: {
    ...typography.bodySemibold,
    color: colors.text.primary,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  optionSelected: {
    backgroundColor: colors.accent.light,
  },
  optionIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    ...typography.body,
    color: colors.text.primary,
  },
  optionLabelSelected: {
    color: colors.accent.primary,
    fontWeight: '600',
  },
  optionDescription: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  checkmark: {
    fontSize: 18,
    color: colors.accent.primary,
    fontWeight: '600',
  },
})

export default Select
