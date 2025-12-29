import React from 'react'
import { View, Text, StyleSheet, ViewStyle } from 'react-native'
import { radius } from '../../constants/theme'
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

const styles = StyleSheet.create({
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
})

export default NutriScoreBadge
