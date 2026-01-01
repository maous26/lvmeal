import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { ArrowLeft, Leaf, ChefHat, ShoppingCart, Database, Check } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { Card } from '../components/ui'
import { useTheme } from '../contexts/ThemeContext'
import { spacing, typography, radius } from '../constants/theme'
import { useUserStore } from '../stores/user-store'
import type { MealSourcePreference } from '../types'

const mealSourceOptions: Array<{
  key: MealSourcePreference
  label: string
  description: string
  details: string
  icon: 'Leaf' | 'ChefHat' | 'ShoppingCart' | 'Database'
}> = [
  {
    key: 'fresh',
    label: 'Produits frais',
    description: 'Priorité aux fruits, légumes, viandes',
    details: 'Données nutritionnelles officielles CIQUAL (ANSES). Idéal pour ceux qui cuisinent avec des ingrédients frais.',
    icon: 'Leaf',
  },
  {
    key: 'recipes',
    label: 'Recettes maison',
    description: 'Priorité aux plats élaborés',
    details: 'Recettes complètes avec instructions. Parfait pour découvrir de nouveaux plats équilibrés.',
    icon: 'ChefHat',
  },
  {
    key: 'quick',
    label: 'Rapide & pratique',
    description: 'Priorité aux produits du commerce',
    details: 'Base Open Food Facts avec Nutriscore. Idéal pour les repas rapides et les produits tout prêts.',
    icon: 'ShoppingCart',
  },
  {
    key: 'balanced',
    label: 'Équilibré',
    description: 'Mix intelligent de toutes les sources',
    details: 'L\'IA sélectionne la meilleure source selon le type de repas et vos objectifs. Recommandé pour la plupart des utilisateurs.',
    icon: 'Database',
  },
]

const IconComponents = {
  Leaf,
  ChefHat,
  ShoppingCart,
  Database,
}

export default function MealSourceSettingsScreen() {
  const navigation = useNavigation()
  const { colors } = useTheme()
  const { profile, updateProfile } = useUserStore()

  const currentPreference = profile?.mealSourcePreference || 'balanced'

  const handleSelectSource = (key: MealSourcePreference) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    updateProfile({ mealSourcePreference: key })
  }

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
        <Text style={[styles.title, { color: colors.text.primary }]}>Sources de repas</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Description */}
        <Text style={[styles.description, { color: colors.text.secondary }]}>
          Choisissez d'où viennent les suggestions du "Repas IA". Cette préférence influence la génération de repas et les plans alimentaires.
        </Text>

        {/* Options */}
        <View style={styles.optionsContainer}>
          {mealSourceOptions.map((option) => {
            const IconComponent = IconComponents[option.icon]
            const isSelected = currentPreference === option.key

            return (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: colors.bg.elevated,
                    borderColor: isSelected ? colors.accent.primary : colors.border.light,
                  },
                  isSelected && { borderWidth: 2 },
                ]}
                onPress={() => handleSelectSource(option.key)}
                activeOpacity={0.7}
              >
                <View style={styles.optionHeader}>
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: isSelected ? colors.accent.light : colors.bg.secondary },
                    ]}
                  >
                    <IconComponent
                      size={24}
                      color={isSelected ? colors.accent.primary : colors.text.secondary}
                    />
                  </View>
                  <View style={styles.optionTitles}>
                    <Text style={[styles.optionLabel, { color: colors.text.primary }]}>
                      {option.label}
                    </Text>
                    <Text style={[styles.optionDescription, { color: colors.text.tertiary }]}>
                      {option.description}
                    </Text>
                  </View>
                  {isSelected && (
                    <View style={[styles.checkmark, { backgroundColor: colors.accent.primary }]}>
                      <Check size={16} color="#FFFFFF" />
                    </View>
                  )}
                </View>
                <Text style={[styles.optionDetails, { color: colors.text.secondary }]}>
                  {option.details}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Info */}
        <Card style={[styles.infoCard, { backgroundColor: colors.accent.light }]}>
          <Text style={[styles.infoText, { color: colors.accent.primary }]}>
            💡 Vous pouvez changer cette préférence à tout moment. Les nouveaux repas générés utiliseront la source sélectionnée.
          </Text>
        </Card>
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
  title: {
    ...typography.h4,
  },
  headerSpacer: {
    width: 40,
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
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  optionsContainer: {
    gap: spacing.md,
  },
  optionCard: {
    padding: spacing.default,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionTitles: {
    flex: 1,
    marginLeft: spacing.md,
  },
  optionLabel: {
    ...typography.bodySemibold,
  },
  optionDescription: {
    ...typography.small,
    marginTop: 2,
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionDetails: {
    ...typography.small,
    lineHeight: 20,
    marginLeft: 48 + spacing.md,
  },
  infoCard: {
    marginTop: spacing.xl,
    padding: spacing.default,
  },
  infoText: {
    ...typography.small,
    lineHeight: 20,
  },
})
