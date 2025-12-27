import React from 'react'
import {
  View,
  Modal as RNModal,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radius, spacing, typography, shadows } from '../../constants/theme'

interface ModalProps {
  visible: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  children: React.ReactNode
  showCloseButton?: boolean
  fullScreen?: boolean
}

export function Modal({
  visible,
  onClose,
  title,
  subtitle,
  children,
  showCloseButton = true,
  fullScreen = false,
}: ModalProps) {
  const insets = useSafeAreaInsets()

  return (
    <RNModal
      visible={visible}
      animationType="slide"
      transparent={!fullScreen}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        {!fullScreen && (
          <Pressable style={styles.backdrop} onPress={onClose} />
        )}

        <View
          style={[
            styles.container,
            fullScreen && styles.fullScreen,
            fullScreen && { paddingTop: insets.top, paddingBottom: insets.bottom },
          ]}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <View style={styles.header}>
              <View style={styles.headerText}>
                {title && <Text style={styles.title}>{title}</Text>}
                {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
              </View>

              {showCloseButton && (
                <Pressable onPress={onClose} style={styles.closeButton}>
                  <Text style={styles.closeText}>✕</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Content */}
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  )
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg.overlay,
  },
  container: {
    backgroundColor: colors.bg.elevated,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    maxHeight: '90%',
    ...shadows.lg,
  },
  fullScreen: {
    flex: 1,
    maxHeight: '100%',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...typography.h4,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.small,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.bg.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
  },
  closeText: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
  },
})

export default Modal
