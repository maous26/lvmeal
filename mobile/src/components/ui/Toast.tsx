import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radius, spacing, typography, shadows } from '../../constants/theme'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastProps {
  visible: boolean
  message: string
  type?: ToastType
  duration?: number
  onDismiss: () => void
  action?: {
    label: string
    onPress: () => void
  }
}

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
}

const COLORS: Record<ToastType, string> = {
  success: colors.success,
  error: colors.error,
  warning: colors.warning,
  info: colors.info,
}

export function Toast({
  visible,
  message,
  type = 'info',
  duration = 3000,
  onDismiss,
  action,
}: ToastProps) {
  const insets = useSafeAreaInsets()
  const translateY = useRef(new Animated.Value(-100)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start()

      if (duration > 0) {
        const timer = setTimeout(() => {
          hideToast()
        }, duration)

        return () => clearTimeout(timer)
      }
    }
  }, [visible])

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss()
    })
  }

  if (!visible) return null

  return (
    <Animated.View
      style={[
        styles.container,
        { top: insets.top + spacing.md },
        { transform: [{ translateY }], opacity },
      ]}
    >
      <View style={[styles.toast, { borderLeftColor: COLORS[type] }]}>
        <View style={[styles.iconContainer, { backgroundColor: COLORS[type] }]}>
          <Text style={styles.icon}>{ICONS[type]}</Text>
        </View>

        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>

        {action && (
          <Pressable onPress={action.onPress} style={styles.action}>
            <Text style={styles.actionText}>{action.label}</Text>
          </Pressable>
        )}

        <Pressable onPress={hideToast} style={styles.dismiss}>
          <Text style={styles.dismissText}>✕</Text>
        </Pressable>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.default,
    right: spacing.default,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    ...shadows.md,
  },
  iconContainer: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  icon: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  message: {
    flex: 1,
    ...typography.small,
    color: colors.text.primary,
  },
  action: {
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  actionText: {
    ...typography.smallMedium,
    color: colors.accent.primary,
  },
  dismiss: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
  dismissText: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
})

export default Toast
