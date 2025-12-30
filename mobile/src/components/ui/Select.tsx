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
import { ChevronDown, Check } from 'lucide-react-native'
import { useTheme } from '../../contexts/ThemeContext'
import { radius, spacing, typography, shadows } from '../../constants/theme'

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
  placeholder = 'Sélectionner',
  value,
  options,
  onChange,
  disabled = false,
  error,
  containerStyle,
}: SelectProps<T>) {
  const { colors } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const insets = useSafeAreaInsets()

  const selectedOption = options.find((opt) => opt.value === value)

  const handleSelect = (option: SelectOption<T>) => {
    onChange(option.value)
    setIsOpen(false)
  }

  return (
    <View style={containerStyle}>
      {label && (
        <Text style={[styles.label, { color: colors.text.secondary }]}>
          {label}
        </Text>
      )}

      <Pressable
        onPress={() => !disabled && setIsOpen(true)}
        style={[
          styles.trigger,
          {
            backgroundColor: colors.bg.elevated,
            borderColor: error ? colors.error : colors.border.light,
          },
          disabled && styles.triggerDisabled,
        ]}
      >
        {selectedOption?.icon && (
          <Text style={styles.triggerIcon}>{selectedOption.icon}</Text>
        )}
        <Text
          style={[
            styles.triggerText,
            { color: selectedOption ? colors.text.primary : colors.text.muted },
          ]}
        >
          {selectedOption?.label || placeholder}
        </Text>
        <ChevronDown size={18} color={colors.text.tertiary} />
      </Pressable>

      {error && (
        <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
      )}

      <Modal
        visible={isOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.bg.overlay }]}
          onPress={() => setIsOpen(false)}
        />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.bg.elevated,
              paddingBottom: insets.bottom + spacing.lg,
            },
          ]}
        >
          <View style={[styles.sheetHeader, { borderBottomColor: colors.border.light }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border.default }]} />
            <Text style={[styles.sheetTitle, { color: colors.text.primary }]}>
              {label || 'Sélectionner'}
            </Text>
          </View>

          <FlatList
            data={options}
            keyExtractor={(item) => String(item.value)}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleSelect(item)}
                style={[
                  styles.option,
                  { borderBottomColor: colors.border.light },
                  item.value === value && { backgroundColor: colors.accent.light },
                ]}
              >
                {item.icon && <Text style={styles.optionIcon}>{item.icon}</Text>}
                <View style={styles.optionContent}>
                  <Text
                    style={[
                      styles.optionLabel,
                      {
                        color: item.value === value
                          ? colors.accent.primary
                          : colors.text.primary,
                        fontWeight: item.value === value ? '600' : '400',
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                  {item.description && (
                    <Text style={[styles.optionDescription, { color: colors.text.tertiary }]}>
                      {item.description}
                    </Text>
                  )}
                </View>
                {item.value === value && (
                  <Check size={20} color={colors.accent.primary} strokeWidth={2.5} />
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
    ...typography.label,
    marginBottom: spacing.xs,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: spacing.default,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  triggerDisabled: {
    opacity: 0.5,
  },
  triggerIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  triggerText: {
    flex: 1,
    ...typography.body,
  },
  error: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    maxHeight: '70%',
    ...shadows.lg,
  },
  sheetHeader: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
  },
  sheetTitle: {
    ...typography.bodySemibold,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.default,
    borderBottomWidth: 1,
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
  },
  optionDescription: {
    ...typography.caption,
    marginTop: 2,
  },
})

export default Select
