import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import {
  ArrowLeft,
  Pin,
  PinOff,
  RotateCcw,
  Search,
  Camera,
  Mic,
  Barcode,
  Sparkles,
  Globe,
  Heart,
  Info,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { Card, Button } from '../components/ui'
import { useTheme } from '../contexts/ThemeContext'
import { spacing, typography, radius } from '../constants/theme'
import {
  useMealInputPreferencesStore,
  ALL_INPUT_METHODS,
  DEFAULT_PINNED_METHODS,
  type MealInputMethod,
} from '../stores/meal-input-preferences-store'

const IconComponents: Record<string, React.FC<{ size: number; color: string }>> = {
  Search,
  Camera,
  Mic,
  Barcode,
  Sparkles,
  Globe,
  Heart,
}

export default function MealInputSettingsScreen() {
  const navigation = useNavigation()
  const { colors } = useTheme()
  const {
    pinnedMethods,
    togglePin,
    resetToDefaults,
  } = useMealInputPreferencesStore()

  const handleTogglePin = (methodId: MealInputMethod) => {
    // Check if we're at max and trying to add
    if (!pinnedMethods.includes(methodId) && pinnedMethods.length >= 4) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      Alert.alert(
        'Maximum atteint',
        'Vous pouvez épingler jusqu\'à 4 méthodes. Désépinglez-en une pour en ajouter une autre.',
        [{ text: 'OK' }]
      )
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    togglePin(methodId)
  }

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert(
      'Réinitialiser',
      'Remettre les méthodes d\'ajout par défaut ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          style: 'destructive',
          onPress: () => {
            resetToDefaults()
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          },
        },
      ]
    )
  }

  // Sort methods: pinned first, then unpinned
  const sortedMethods = [...ALL_INPUT_METHODS].sort((a, b) => {
    const aIsPinned = pinnedMethods.includes(a.id)
    const bIsPinned = pinnedMethods.includes(b.id)
    if (aIsPinned && !bIsPinned) return -1
    if (!aIsPinned && bIsPinned) return 1
    // Within same category, maintain order by pinned position
    if (aIsPinned && bIsPinned) {
      return pinnedMethods.indexOf(a.id) - pinnedMethods.indexOf(b.id)
    }
    return 0
  })

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { backgroundColor: colors.bg.secondary }]}
        >
          <ArrowLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text.primary }]}>Ajouter un repas</Text>
        <TouchableOpacity
          onPress={handleReset}
          style={[styles.resetButton, { backgroundColor: colors.bg.secondary }]}
        >
          <RotateCcw size={20} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Description */}
        <Text style={[styles.description, { color: colors.text.secondary }]}>
          Choisissez les méthodes d'ajout de repas épinglées. Elles apparaîtront en raccourci sur l'écran d'ajout.
        </Text>

        {/* Counter */}
        <View style={[styles.counterCard, { backgroundColor: colors.accent.light }]}>
          <Pin size={18} color={colors.accent.primary} />
          <Text style={[styles.counterText, { color: colors.accent.primary }]}>
            {pinnedMethods.length}/4 méthodes épinglées
          </Text>
        </View>

        {/* Methods List */}
        <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>
          Méthodes disponibles
        </Text>

        <Card padding="none" style={{ backgroundColor: colors.bg.elevated }}>
          {sortedMethods.map((method, index) => {
            const IconComponent = IconComponents[method.iconName] || Search
            const isPinned = pinnedMethods.includes(method.id)
            const isLast = index === sortedMethods.length - 1

            return (
              <TouchableOpacity
                key={method.id}
                style={[
                  styles.methodItem,
                  !isLast && [styles.methodItemBorder, { borderBottomColor: colors.border.light }],
                ]}
                onPress={() => handleTogglePin(method.id)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.methodIcon,
                    { backgroundColor: isPinned ? colors.accent.light : colors.bg.secondary },
                  ]}
                >
                  <IconComponent
                    size={22}
                    color={isPinned ? colors.accent.primary : colors.text.secondary}
                  />
                </View>
                <View style={styles.methodInfo}>
                  <Text style={[styles.methodLabel, { color: colors.text.primary }]}>
                    {method.label}
                  </Text>
                  <Text style={[styles.methodDescription, { color: colors.text.tertiary }]}>
                    {method.description}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleTogglePin(method.id)}
                  style={[
                    styles.pinButton,
                    { backgroundColor: isPinned ? colors.accent.primary : colors.bg.secondary },
                  ]}
                >
                  {isPinned ? (
                    <Pin size={18} color="#FFFFFF" />
                  ) : (
                    <PinOff size={18} color={colors.text.tertiary} />
                  )}
                </TouchableOpacity>
              </TouchableOpacity>
            )
          })}
        </Card>

        {/* Info Card */}
        <Card style={[styles.infoCard, { backgroundColor: colors.bg.secondary }]}>
          <View style={styles.infoHeader}>
            <Info size={18} color={colors.text.secondary} />
            <Text style={[styles.infoTitle, { color: colors.text.primary }]}>
              Comment ça marche ?
            </Text>
          </View>
          <Text style={[styles.infoText, { color: colors.text.secondary }]}>
            • Les méthodes épinglées apparaissent en haut de l'écran d'ajout{'\n'}
            • Vous pouvez en épingler jusqu'à 4{'\n'}
            • Les autres restent accessibles dans "Autres méthodes"{'\n'}
            • Personnalisez selon vos habitudes !
          </Text>
        </Card>

        {/* Default Methods Info */}
        <View style={styles.defaultInfo}>
          <Text style={[styles.defaultText, { color: colors.text.muted }]}>
            Par défaut : {DEFAULT_PINNED_METHODS.map(id =>
              ALL_INPUT_METHODS.find(m => m.id === id)?.labelShort
            ).join(', ')}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.default,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typography.h4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.default,
    paddingBottom: spacing['3xl'],
  },
  description: {
    ...typography.body,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  counterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xl,
  },
  counterText: {
    ...typography.bodyMedium,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    marginBottom: spacing.md,
  },
  methodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.default,
    gap: spacing.md,
  },
  methodItemBorder: {
    borderBottomWidth: 1,
  },
  methodIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodInfo: {
    flex: 1,
  },
  methodLabel: {
    ...typography.bodyMedium,
  },
  methodDescription: {
    ...typography.small,
    marginTop: 2,
  },
  pinButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCard: {
    marginTop: spacing.xl,
    padding: spacing.default,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  infoTitle: {
    ...typography.bodySemibold,
  },
  infoText: {
    ...typography.small,
    lineHeight: 22,
  },
  defaultInfo: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  defaultText: {
    ...typography.caption,
  },
})
