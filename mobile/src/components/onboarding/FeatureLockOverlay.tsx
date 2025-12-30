/**
 * FeatureLockOverlay - Overlay pour les features verrouillées
 *
 * Affiche un overlay discret sur les features non encore débloquées
 * avec indication du jour de déverrouillage
 */

import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native'
import { Lock, Clock } from 'lucide-react-native'
import { useTheme } from '../../contexts/ThemeContext'
import { useNavigation } from '@react-navigation/native'

interface FeatureLockOverlayProps {
  daysUntilUnlock?: number | null
  message?: string
  onPress?: () => void
  showSubscribeButton?: boolean
}

export default function FeatureLockOverlay({
  daysUntilUnlock,
  message,
  onPress,
  showSubscribeButton = false,
}: FeatureLockOverlayProps) {
  const { colors } = useTheme()
  const navigation = useNavigation()

  const handlePress = () => {
    if (onPress) {
      onPress()
    } else if (showSubscribeButton) {
      // @ts-ignore
      navigation.navigate('Paywall')
    }
  }

  return (
    <TouchableOpacity
      style={styles.overlay}
      activeOpacity={0.95}
      onPress={handlePress}
    >
      <View style={[styles.content, { backgroundColor: colors.bg.primary + 'F5' }]}>
        <View style={[styles.iconContainer, { backgroundColor: colors.border.light }]}>
          {daysUntilUnlock ? (
            <Clock size={24} color={colors.text.tertiary} />
          ) : (
            <Lock size={24} color={colors.text.tertiary} />
          )}
        </View>

        {daysUntilUnlock && daysUntilUnlock > 0 ? (
          <>
            <Text style={[styles.title, { color: colors.text.primary }]}>
              Disponible dans {daysUntilUnlock} jour{daysUntilUnlock > 1 ? 's' : ''}
            </Text>
            <Text style={[styles.subtitle, { color: colors.text.tertiary }]}>
              {message || 'Continue à utiliser LYM pour débloquer cette fonctionnalité'}
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: colors.text.primary }]}>
              Fonctionnalité Premium
            </Text>
            <Text style={[styles.subtitle, { color: colors.text.tertiary }]}>
              {message || 'Abonne-toi pour continuer avec LYM'}
            </Text>
            {showSubscribeButton && (
              <View style={[styles.subscribeButton, { backgroundColor: colors.accent.primary }]}>
                <Text style={styles.subscribeText}>Découvrir</Text>
              </View>
            )}
          </>
        )}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    overflow: 'hidden',
  },
  content: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    maxWidth: '90%',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  subscribeButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  subscribeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})
