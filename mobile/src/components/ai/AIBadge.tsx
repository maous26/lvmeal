/**
 * AIBadge - Badge visuel indiquant un contenu généré par l'IA
 *
 * Utilisé pour montrer à l'utilisateur que le conseil est:
 * - 100% personnalisé (pas un template)
 * - Généré par l'IA de LYM
 * - Basé sur ses données personnelles
 */

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Sparkles } from 'lucide-react-native'
import { useTheme } from '../../contexts/ThemeContext'
import { spacing, typography, radius } from '../../constants/theme'

interface AIBadgeProps {
  /** Variante du badge */
  variant?: 'default' | 'subtle' | 'inline'
  /** Texte personnalisé (défaut: "Personnalisé pour toi") */
  text?: string
  /** Afficher l'icône sparkles */
  showIcon?: boolean
  /** Taille du badge */
  size?: 'sm' | 'md'
}

export function AIBadge({
  variant = 'default',
  text = 'Personnalisé pour toi',
  showIcon = true,
  size = 'sm',
}: AIBadgeProps) {
  const { colors } = useTheme()

  const isSmall = size === 'sm'
  const iconSize = isSmall ? 10 : 12

  if (variant === 'inline') {
    return (
      <View style={styles.inlineContainer}>
        {showIcon && <Sparkles size={iconSize} color={colors.accent.primary} />}
        <Text style={[styles.inlineText, { color: colors.accent.primary }]}>
          {text}
        </Text>
      </View>
    )
  }

  if (variant === 'subtle') {
    return (
      <View style={[styles.subtleContainer, { backgroundColor: `${colors.accent.primary}10` }]}>
        {showIcon && <Sparkles size={iconSize} color={colors.accent.primary} />}
        <Text
          style={[
            isSmall ? styles.textSm : styles.textMd,
            { color: colors.accent.primary },
          ]}
        >
          {text}
        </Text>
      </View>
    )
  }

  // Default variant
  return (
    <View style={[styles.container, { backgroundColor: colors.accent.light }]}>
      {showIcon && <Sparkles size={iconSize} color={colors.accent.primary} />}
      <Text
        style={[
          isSmall ? styles.textSm : styles.textMd,
          { color: colors.accent.primary },
        ]}
      >
        {text}
      </Text>
    </View>
  )
}

/**
 * Badge compact pour indiquer le nombre de données analysées
 */
interface DataContextBadgeProps {
  mealsCount?: number
  daysTracked?: number
}

export function DataContextBadge({ mealsCount, daysTracked }: DataContextBadgeProps) {
  const { colors } = useTheme()

  if (!mealsCount && !daysTracked) return null

  const text = mealsCount
    ? `Basé sur ${mealsCount} repas`
    : `Analyse de ${daysTracked} jours`

  return (
    <View style={[styles.dataContextContainer, { backgroundColor: `${colors.text.muted}10` }]}>
      <Text style={[styles.dataContextText, { color: colors.text.muted }]}>
        {text}
      </Text>
    </View>
  )
}

/**
 * Badge pour afficher la source scientifique
 */
interface SourceBadgeProps {
  source: 'ANSES' | 'INSERM' | 'HAS' | 'OMS' | string
}

export function SourceBadge({ source }: SourceBadgeProps) {
  const { colors } = useTheme()

  return (
    <View style={[styles.sourceContainer, { borderColor: `${colors.text.muted}30` }]}>
      <Text style={[styles.sourceText, { color: colors.text.muted }]}>
        Source : {source}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  // Default badge
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  // Subtle variant
  subtleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  // Inline variant
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  inlineText: {
    fontSize: 10,
    fontWeight: '500',
  },
  // Text sizes
  textSm: {
    fontSize: 10,
    fontWeight: '500',
  },
  textMd: {
    fontSize: 11,
    fontWeight: '500',
  },
  // Data context badge
  dataContextContainer: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  dataContextText: {
    fontSize: 9,
    fontWeight: '400',
  },
  // Source badge
  sourceContainer: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  sourceText: {
    fontSize: 9,
    fontWeight: '400',
  },
})

export default AIBadge
