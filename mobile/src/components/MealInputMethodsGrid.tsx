/**
 * MealInputMethodsGrid
 *
 * Affiche les méthodes d'ajout de repas avec :
 * - Méthodes épinglées en priorité (max 4)
 * - Bouton "Plus" pour accéder aux autres méthodes
 * - Modal de personnalisation avec option épingler/désépingler
 */

import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native'
import {
  Search,
  Camera,
  Mic,
  Barcode,
  Sparkles,
  Globe,
  Heart,
  ChefHat,
  MoreHorizontal,
  Pin,
  PinOff,
  X,
  Check,
  Info,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'

import { colors, spacing, typography, radius, shadows } from '../constants/theme'
import {
  useMealInputPreferencesStore,
  ALL_INPUT_METHODS,
  MAX_PINNED_METHODS,
  MIN_PINNED_METHODS,
  type MealInputMethod,
  type MealInputMethodConfig,
} from '../stores/meal-input-preferences-store'

// Map icon names to components
const ICON_MAP: Record<string, React.ComponentType<{ size: number; color: string }>> = {
  Search,
  Camera,
  Mic,
  Barcode,
  Sparkles,
  Globe,
  Heart,
  ChefHat,
}

interface MealInputMethodsGridProps {
  onMethodSelect: (methodId: string) => void
}

export function MealInputMethodsGrid({ onMethodSelect }: MealInputMethodsGridProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const {
    pinnedMethods,
    getPinnedMethodConfigs,
    getUnpinnedMethodConfigs,
    togglePin,
    isPinned,
    recordUsage,
    getSuggestedMethod,
  } = useMealInputPreferencesStore()

  const pinnedConfigs = getPinnedMethodConfigs()
  const unpinnedConfigs = getUnpinnedMethodConfigs()
  const suggestedMethod = getSuggestedMethod()

  const handleMethodPress = useCallback((methodId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    recordUsage(methodId as MealInputMethod)
    onMethodSelect(methodId)
  }, [onMethodSelect, recordUsage])

  const handleMorePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setIsModalOpen(true)
  }, [])

  const handleTogglePin = useCallback((methodId: MealInputMethod) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const success = togglePin(methodId)
    if (!success) {
      // Feedback si impossible
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    }
  }, [togglePin])

  const renderMethodButton = useCallback((config: MealInputMethodConfig, isCompact = false) => {
    const Icon = ICON_MAP[config.iconName] || Search

    return (
      <TouchableOpacity
        key={config.id}
        style={[styles.methodButton, isCompact && styles.methodButtonCompact]}
        onPress={() => handleMethodPress(config.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.methodIconContainer, { backgroundColor: config.bgColor }]}>
          <Icon size={isCompact ? 20 : 24} color={config.color} />
        </View>
        <Text style={[styles.methodLabel, isCompact && styles.methodLabelCompact]} numberOfLines={1}>
          {isCompact ? config.labelShort : config.label}
        </Text>
      </TouchableOpacity>
    )
  }, [handleMethodPress])

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Comment ajouter ?</Text>

      <View style={styles.methodsGrid}>
        {/* Méthodes épinglées */}
        {pinnedConfigs.map(config => renderMethodButton(config))}

        {/* Bouton "Plus" */}
        <TouchableOpacity
          style={styles.methodButton}
          onPress={handleMorePress}
          activeOpacity={0.7}
        >
          <View style={[styles.methodIconContainer, styles.moreIconContainer]}>
            <MoreHorizontal size={24} color={colors.text.secondary} />
            {unpinnedConfigs.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unpinnedConfigs.length}</Text>
              </View>
            )}
          </View>
          <Text style={styles.methodLabel}>Plus</Text>
        </TouchableOpacity>
      </View>

      {/* Suggestion intelligente */}
      {suggestedMethod && !isPinned(suggestedMethod) && (
        <TouchableOpacity
          style={styles.suggestionBanner}
          onPress={() => handleTogglePin(suggestedMethod)}
          activeOpacity={0.8}
        >
          <Info size={16} color={colors.accent.primary} />
          <Text style={styles.suggestionText}>
            Tu utilises souvent "{ALL_INPUT_METHODS.find(m => m.id === suggestedMethod)?.label}".
            <Text style={styles.suggestionAction}> Épingler ?</Text>
          </Text>
        </TouchableOpacity>
      )}

      {/* Modal "Plus de méthodes" */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Méthodes d'ajout</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsModalOpen(false)}
            >
              <X size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Méthodes épinglées */}
            <View style={styles.modalSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>Épinglées</Text>
                <Text style={styles.sectionCount}>
                  {pinnedMethods.length}/{MAX_PINNED_METHODS}
                </Text>
              </View>

              {pinnedConfigs.map(config => (
                <MethodRow
                  key={config.id}
                  config={config}
                  isPinned={true}
                  canUnpin={pinnedMethods.length > MIN_PINNED_METHODS}
                  onPress={() => handleMethodPress(config.id)}
                  onTogglePin={() => handleTogglePin(config.id)}
                  onCloseModal={() => setIsModalOpen(false)}
                />
              ))}
            </View>

            {/* Autres méthodes */}
            {unpinnedConfigs.length > 0 && (
              <View style={styles.modalSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionLabel}>Autres méthodes</Text>
                </View>

                {unpinnedConfigs.map(config => (
                  <MethodRow
                    key={config.id}
                    config={config}
                    isPinned={false}
                    canPin={pinnedMethods.length < MAX_PINNED_METHODS}
                    onPress={() => handleMethodPress(config.id)}
                    onTogglePin={() => handleTogglePin(config.id)}
                    onCloseModal={() => setIsModalOpen(false)}
                  />
                ))}
              </View>
            )}

            {/* Note explicative */}
            <View style={styles.noteContainer}>
              <Text style={styles.noteText}>
                Épinglez jusqu'à {MAX_PINNED_METHODS} méthodes pour un accès rapide.
                Toutes les méthodes restent accessibles ici.
              </Text>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}

// Composant MethodRow pour le modal
interface MethodRowProps {
  config: MealInputMethodConfig
  isPinned: boolean
  canPin?: boolean
  canUnpin?: boolean
  onPress: () => void
  onTogglePin: () => void
  onCloseModal: () => void
}

function MethodRow({
  config,
  isPinned,
  canPin = true,
  canUnpin = true,
  onPress,
  onTogglePin,
  onCloseModal,
}: MethodRowProps) {
  const Icon = ICON_MAP[config.iconName] || Search
  const canToggle = isPinned ? canUnpin : canPin

  const handlePress = () => {
    onPress()
    onCloseModal()
  }

  return (
    <View style={styles.methodRow}>
      <TouchableOpacity
        style={styles.methodRowMain}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <View style={[styles.methodRowIcon, { backgroundColor: config.bgColor }]}>
          <Icon size={22} color={config.color} />
        </View>
        <View style={styles.methodRowContent}>
          <Text style={styles.methodRowTitle}>{config.label}</Text>
          <Text style={styles.methodRowDescription} numberOfLines={1}>
            {config.description}
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.pinButton,
          isPinned && styles.pinButtonActive,
          !canToggle && styles.pinButtonDisabled,
        ]}
        onPress={canToggle ? onTogglePin : undefined}
        disabled={!canToggle}
        activeOpacity={0.7}
      >
        {isPinned ? (
          <PinOff size={18} color={canToggle ? colors.text.secondary : colors.text.muted} />
        ) : (
          <Pin size={18} color={canToggle ? config.color : colors.text.muted} />
        )}
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  methodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  methodButton: {
    width: '30%',
    alignItems: 'center',
    padding: spacing.default,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.default, // iOS 8px
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  methodButtonCompact: {
    width: '22%',
    padding: spacing.sm,
  },
  methodIconContainer: {
    width: 52,
    height: 52,
    borderRadius: radius.default, // iOS 8px
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  moreIconContainer: {
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderStyle: 'dashed',
  },
  methodLabel: {
    ...typography.smallMedium,
    color: colors.text.primary,
    textAlign: 'center',
  },
  methodLabelCompact: {
    ...typography.caption,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#34C759', // iOS Green
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Suggestion banner
  suggestionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.accent.light,
    borderRadius: radius.default, // iOS 8px
  },
  suggestionText: {
    ...typography.small,
    color: colors.text.secondary,
    flex: 1,
  },
  suggestionAction: {
    color: colors.accent.primary,
    fontWeight: '600',
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.default,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: spacing.default,
  },
  modalSection: {
    paddingVertical: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
  },
  sectionCount: {
    ...typography.small,
    color: colors.text.muted,
  },

  // Method row
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  methodRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  methodRowIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.default, // iOS 8px
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodRowContent: {
    flex: 1,
  },
  methodRowTitle: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  methodRowDescription: {
    ...typography.small,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  pinButton: {
    padding: spacing.sm,
    borderRadius: radius.default, // iOS 8px
  },
  pinButtonActive: {
    backgroundColor: colors.bg.secondary,
  },
  pinButtonDisabled: {
    opacity: 0.4,
  },

  // Note
  noteContainer: {
    padding: spacing.md,
    marginVertical: spacing.lg,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.default, // iOS 8px
  },
  noteText: {
    ...typography.small,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
})

export default MealInputMethodsGrid
