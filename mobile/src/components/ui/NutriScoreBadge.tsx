import React, { useState } from 'react'
import { View, Text, StyleSheet, ViewStyle, Pressable, Modal } from 'react-native'
import { X, Info } from 'lucide-react-native'
import { radius, spacing, typography, colors as themeColors } from '../../constants/theme'
import type { NutriScoreGrade } from '../../types'

// Official Nutri-Score colors
const NUTRISCORE_COLORS: Record<NutriScoreGrade, { bg: string; text: string }> = {
  a: { bg: '#038141', text: '#FFFFFF' }, // Dark green
  b: { bg: '#85BB2F', text: '#FFFFFF' }, // Light green
  c: { bg: '#FECB02', text: '#000000' }, // Yellow
  d: { bg: '#EE8100', text: '#FFFFFF' }, // Orange
  e: { bg: '#E63E11', text: '#FFFFFF' }, // Red
  unknown: { bg: '#9CA3AF', text: '#FFFFFF' }, // Gray
}

interface NutriScoreBadgeProps {
  grade: NutriScoreGrade
  size?: 'sm' | 'md' | 'lg'
  style?: ViewStyle
  showLabel?: boolean
}

export function NutriScoreBadge({
  grade,
  size = 'md',
  style,
  showLabel = false,
}: NutriScoreBadgeProps) {
  const colors = NUTRISCORE_COLORS[grade]

  const sizeConfig = {
    sm: { width: 24, height: 24, fontSize: 12, borderRadius: 4 },
    md: { width: 32, height: 32, fontSize: 16, borderRadius: 6 },
    lg: { width: 44, height: 44, fontSize: 22, borderRadius: 8 },
  }

  const config = sizeConfig[size]

  if (grade === 'unknown') {
    return null
  }

  return (
    <View style={[styles.container, style]}>
      {showLabel && <Text style={styles.label}>Nutri-Score</Text>}
      <View
        style={[
          styles.badge,
          {
            backgroundColor: colors.bg,
            width: config.width,
            height: config.height,
            borderRadius: config.borderRadius,
          },
        ]}
      >
        <Text
          style={[
            styles.gradeText,
            {
              color: colors.text,
              fontSize: config.fontSize,
            },
          ]}
        >
          {grade.toUpperCase()}
        </Text>
      </View>
    </View>
  )
}

// Full Nutri-Score scale display (A-B-C-D-E)
export function NutriScoreScale({
  grade,
  size = 'sm',
  style,
}: {
  grade: NutriScoreGrade
  size?: 'sm' | 'md'
  style?: ViewStyle
}) {
  const grades: NutriScoreGrade[] = ['a', 'b', 'c', 'd', 'e']

  const sizeConfig = {
    sm: { width: 18, height: 18, fontSize: 10, gap: 2 },
    md: { width: 24, height: 24, fontSize: 12, gap: 3 },
  }

  const config = sizeConfig[size]

  if (grade === 'unknown') {
    return null
  }

  return (
    <View style={[styles.scaleContainer, { gap: config.gap }, style]}>
      {grades.map((g) => {
        const colors = NUTRISCORE_COLORS[g]
        const isActive = g === grade

        return (
          <View
            key={g}
            style={[
              styles.scaleItem,
              {
                backgroundColor: colors.bg,
                width: isActive ? config.width * 1.3 : config.width,
                height: isActive ? config.height * 1.3 : config.height,
                opacity: isActive ? 1 : 0.4,
                borderRadius: 3,
              },
            ]}
          >
            <Text
              style={[
                styles.scaleText,
                {
                  color: colors.text,
                  fontSize: isActive ? config.fontSize * 1.2 : config.fontSize,
                  fontWeight: isActive ? '700' : '500',
                },
              ]}
            >
              {g.toUpperCase()}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

// NEW: Detailed Nutri-Score component with breakdown explanation
interface NutriScoreDetailedProps {
  grade: NutriScoreGrade
  score?: number // -15 to +40
  breakdown?: {
    positivePoints?: number // 0-10 (fruits, vegetables, fiber, proteins)
    negativePoints?: number // 0-40 (energy, sugars, saturated fat, sodium)
    fruits?: number
    fiber?: number
    proteins?: number
    energy?: number
    sugars?: number
    saturatedFat?: number
    sodium?: number
  }
  nova?: 1 | 2 | 3 | 4 // NOVA classification
  style?: ViewStyle
}

const NOVA_LABELS: Record<number, { label: string; color: string; description: string }> = {
  1: { label: 'NOVA 1', color: '#038141', description: 'Aliments non transformés' },
  2: { label: 'NOVA 2', color: '#85BB2F', description: 'Ingrédients culinaires' },
  3: { label: 'NOVA 3', color: '#FECB02', description: 'Aliments transformés' },
  4: { label: 'NOVA 4', color: '#E63E11', description: 'Ultra-transformés' },
}

const GRADE_DESCRIPTIONS: Record<NutriScoreGrade, string> = {
  a: 'Excellente qualité nutritionnelle. Privilégiez ce produit.',
  b: 'Bonne qualité nutritionnelle. Bon choix au quotidien.',
  c: 'Qualité nutritionnelle moyenne. À consommer avec modération.',
  d: 'Qualité nutritionnelle médiocre. À limiter.',
  e: 'Qualité nutritionnelle faible. À éviter au quotidien.',
  unknown: 'Score non disponible.',
}

export function NutriScoreDetailed({
  grade,
  score,
  breakdown,
  nova,
  style,
}: NutriScoreDetailedProps) {
  const [showModal, setShowModal] = useState(false)
  const colors = NUTRISCORE_COLORS[grade]

  if (grade === 'unknown') {
    return null
  }

  return (
    <>
      <Pressable
        style={[styles.detailedContainer, style]}
        onPress={() => setShowModal(true)}
      >
        {/* Nutri-Score Badge */}
        <View style={styles.detailedRow}>
          <NutriScoreScale grade={grade} size="md" />
          <View style={styles.detailedInfo}>
            <Text style={styles.detailedLabel}>Nutri-Score {grade.toUpperCase()}</Text>
            <Text style={styles.detailedDescription} numberOfLines={1}>
              {GRADE_DESCRIPTIONS[grade].split('.')[0]}
            </Text>
          </View>
          <Info size={16} color={themeColors.text.muted} />
        </View>

        {/* NOVA Classification if available */}
        {nova && (
          <View style={styles.novaRow}>
            <View style={[styles.novaBadge, { backgroundColor: NOVA_LABELS[nova].color }]}>
              <Text style={styles.novaText}>{nova}</Text>
            </View>
            <Text style={styles.novaLabel}>{NOVA_LABELS[nova].description}</Text>
          </View>
        )}
      </Pressable>

      {/* Detail Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Détail Nutri-Score</Text>
              <Pressable onPress={() => setShowModal(false)} hitSlop={8}>
                <X size={24} color={themeColors.text.primary} />
              </Pressable>
            </View>

            {/* Grade Display */}
            <View style={styles.modalGrade}>
              <View style={[styles.bigBadge, { backgroundColor: colors.bg }]}>
                <Text style={[styles.bigGradeText, { color: colors.text }]}>
                  {grade.toUpperCase()}
                </Text>
              </View>
              {score !== undefined && (
                <Text style={styles.scoreText}>Score: {score} points</Text>
              )}
              <Text style={styles.gradeDescription}>{GRADE_DESCRIPTIONS[grade]}</Text>
            </View>

            {/* Breakdown if available */}
            {breakdown && (
              <View style={styles.breakdownSection}>
                <Text style={styles.breakdownTitle}>Composition</Text>

                {/* Positive factors */}
                <View style={styles.factorGroup}>
                  <Text style={styles.factorGroupTitle}>Points positifs</Text>
                  {breakdown.fruits !== undefined && (
                    <View style={styles.factorRow}>
                      <Text style={styles.factorLabel}>Fruits, légumes</Text>
                      <View style={[styles.factorBar, styles.positiveBar]}>
                        <View style={[styles.factorFill, { width: `${Math.min(breakdown.fruits * 10, 100)}%`, backgroundColor: '#038141' }]} />
                      </View>
                    </View>
                  )}
                  {breakdown.fiber !== undefined && (
                    <View style={styles.factorRow}>
                      <Text style={styles.factorLabel}>Fibres</Text>
                      <View style={[styles.factorBar, styles.positiveBar]}>
                        <View style={[styles.factorFill, { width: `${Math.min(breakdown.fiber * 10, 100)}%`, backgroundColor: '#038141' }]} />
                      </View>
                    </View>
                  )}
                  {breakdown.proteins !== undefined && (
                    <View style={styles.factorRow}>
                      <Text style={styles.factorLabel}>Protéines</Text>
                      <View style={[styles.factorBar, styles.positiveBar]}>
                        <View style={[styles.factorFill, { width: `${Math.min(breakdown.proteins * 10, 100)}%`, backgroundColor: '#038141' }]} />
                      </View>
                    </View>
                  )}
                </View>

                {/* Negative factors */}
                <View style={styles.factorGroup}>
                  <Text style={styles.factorGroupTitle}>Points négatifs</Text>
                  {breakdown.sugars !== undefined && (
                    <View style={styles.factorRow}>
                      <Text style={styles.factorLabel}>Sucres</Text>
                      <View style={[styles.factorBar, styles.negativeBar]}>
                        <View style={[styles.factorFill, { width: `${Math.min(breakdown.sugars * 10, 100)}%`, backgroundColor: '#E63E11' }]} />
                      </View>
                    </View>
                  )}
                  {breakdown.saturatedFat !== undefined && (
                    <View style={styles.factorRow}>
                      <Text style={styles.factorLabel}>Graisses saturées</Text>
                      <View style={[styles.factorBar, styles.negativeBar]}>
                        <View style={[styles.factorFill, { width: `${Math.min(breakdown.saturatedFat * 10, 100)}%`, backgroundColor: '#E63E11' }]} />
                      </View>
                    </View>
                  )}
                  {breakdown.sodium !== undefined && (
                    <View style={styles.factorRow}>
                      <Text style={styles.factorLabel}>Sel</Text>
                      <View style={[styles.factorBar, styles.negativeBar]}>
                        <View style={[styles.factorFill, { width: `${Math.min(breakdown.sodium * 10, 100)}%`, backgroundColor: '#E63E11' }]} />
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* NOVA Classification */}
            {nova && (
              <View style={styles.novaSection}>
                <Text style={styles.breakdownTitle}>Classification NOVA</Text>
                <View style={styles.novaDetail}>
                  <View style={[styles.novaBadgeLarge, { backgroundColor: NOVA_LABELS[nova].color }]}>
                    <Text style={styles.novaTextLarge}>{nova}</Text>
                  </View>
                  <View style={styles.novaDetailText}>
                    <Text style={styles.novaDetailLabel}>{NOVA_LABELS[nova].label}</Text>
                    <Text style={styles.novaDetailDescription}>{NOVA_LABELS[nova].description}</Text>
                  </View>
                </View>
                <Text style={styles.novaExplanation}>
                  NOVA classe les aliments selon leur degré de transformation. Privilégiez les groupes 1-2.
                </Text>
              </View>
            )}

            {/* Source */}
            <Text style={styles.sourceNote}>
              Source: Santé publique France / Open Food Facts
            </Text>
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  // Basic styles
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
  },
  badge: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  gradeText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  scaleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scaleItem: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scaleText: {
    textAlign: 'center',
  },
  // Detailed component styles
  detailedContainer: {
    backgroundColor: themeColors.bg.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  detailedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  detailedInfo: {
    flex: 1,
  },
  detailedLabel: {
    ...typography.bodyMedium,
    color: themeColors.text.primary,
  },
  detailedDescription: {
    ...typography.caption,
    color: themeColors.text.secondary,
  },
  novaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: themeColors.border.light,
  },
  novaBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  novaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  novaLabel: {
    ...typography.small,
    color: themeColors.text.secondary,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: themeColors.bg.primary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    ...typography.h4,
    color: themeColors.text.primary,
  },
  modalGrade: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  bigBadge: {
    width: 80,
    height: 80,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  bigGradeText: {
    fontSize: 48,
    fontWeight: '700',
  },
  scoreText: {
    ...typography.small,
    color: themeColors.text.tertiary,
    marginBottom: spacing.xs,
  },
  gradeDescription: {
    ...typography.body,
    color: themeColors.text.secondary,
    textAlign: 'center',
  },
  breakdownSection: {
    marginBottom: spacing.lg,
  },
  breakdownTitle: {
    ...typography.bodyMedium,
    color: themeColors.text.primary,
    marginBottom: spacing.md,
  },
  factorGroup: {
    marginBottom: spacing.md,
  },
  factorGroupTitle: {
    ...typography.small,
    color: themeColors.text.tertiary,
    marginBottom: spacing.sm,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  factorLabel: {
    ...typography.small,
    color: themeColors.text.secondary,
    width: 120,
  },
  factorBar: {
    flex: 1,
    height: 8,
    backgroundColor: themeColors.bg.tertiary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  positiveBar: {},
  negativeBar: {},
  factorFill: {
    height: '100%',
    borderRadius: 4,
  },
  novaSection: {
    marginBottom: spacing.lg,
  },
  novaDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  novaBadgeLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  novaTextLarge: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  novaDetailText: {
    flex: 1,
  },
  novaDetailLabel: {
    ...typography.bodyMedium,
    color: themeColors.text.primary,
  },
  novaDetailDescription: {
    ...typography.small,
    color: themeColors.text.secondary,
  },
  novaExplanation: {
    ...typography.caption,
    color: themeColors.text.tertiary,
    fontStyle: 'italic',
  },
  sourceNote: {
    ...typography.xs,
    color: themeColors.text.muted,
    textAlign: 'center',
  },
})

export default NutriScoreBadge
