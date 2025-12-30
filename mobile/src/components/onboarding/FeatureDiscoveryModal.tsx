/**
 * FeatureDiscoveryModal - Modal de découverte des nouvelles features
 *
 * Philosophie LYM:
 * - Courts
 * - Contextuels
 * - Jamais plus d'un à la fois
 * - LYM agit, puis explique
 */

import React from 'react'
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { X } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../../contexts/ThemeContext'

const { width } = Dimensions.get('window')

interface FeatureDiscoveryModalProps {
  visible: boolean
  icon: string
  title: string
  message: string
  onClose: () => void
  dayNumber?: number
}

export default function FeatureDiscoveryModal({
  visible,
  icon,
  title,
  message,
  onClose,
  dayNumber,
}: FeatureDiscoveryModalProps) {
  const { colors } = useTheme()

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.bg.primary }]}>
          {/* Header avec badge jour */}
          {dayNumber && (
            <View style={[styles.dayBadge, { backgroundColor: colors.accent.light }]}>
              <Text style={[styles.dayBadgeText, { color: colors.accent.primary }]}>
                Jour {dayNumber}
              </Text>
            </View>
          )}

          {/* Close button */}
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: colors.bg.secondary }]}
            onPress={handleClose}
          >
            <X size={20} color={colors.text.tertiary} />
          </TouchableOpacity>

          {/* Icon */}
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={[colors.accent.primary, colors.secondary.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconGradient}
            >
              <Text style={styles.icon}>{icon}</Text>
            </LinearGradient>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text.primary }]}>
            {title}
          </Text>

          {/* Message */}
          <Text style={[styles.message, { color: colors.text.secondary }]}>
            {message}
          </Text>

          {/* CTA Button */}
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={handleClose}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[colors.accent.primary, colors.secondary.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              <Text style={styles.ctaText}>C'est parti !</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: width - 48,
    maxWidth: 340,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
  },
  dayBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  dayBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginTop: 16,
    marginBottom: 24,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 28,
  },
  ctaButton: {
    width: '100%',
  },
  ctaGradient: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
})
