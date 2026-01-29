/**
 * CollapsibleSection - Catégorie repliable de messages
 *
 * Permet de regrouper les messages par type avec:
 * - Header avec compteur de non-lus
 * - Animation d'ouverture/fermeture fluide
 * - État replié par défaut (sauf si messages non-lus)
 */

import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native'
import { ChevronDown } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { useTheme } from '../../contexts/ThemeContext'
import { spacing, typography, radius, componentSizes } from '../../constants/theme'

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

interface CollapsibleSectionProps {
  title: string
  icon: React.ReactNode
  color: string
  count: number
  unreadCount: number
  children: React.ReactNode
  defaultExpanded?: boolean
}

export function CollapsibleSection({
  title,
  icon,
  color,
  count,
  unreadCount,
  children,
  defaultExpanded,
}: CollapsibleSectionProps) {
  const { colors } = useTheme()

  // Auto-expand if there are unread messages
  const [isExpanded, setIsExpanded] = useState(defaultExpanded ?? unreadCount > 0)
  const rotateAnim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current

  useEffect(() => {
    Animated.spring(rotateAnim, {
      toValue: isExpanded ? 1 : 0,
      useNativeDriver: true,
      tension: 100,
      friction: 10,
    }).start()
  }, [isExpanded, rotateAnim])

  const toggleExpanded = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setIsExpanded(!isExpanded)
  }

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  })

  if (count === 0) return null

  return (
    <View style={styles.container}>
      {/* Header - always visible */}
      <TouchableOpacity
        style={[
          styles.header,
          {
            backgroundColor: `${color}08`,
            borderColor: `${color}20`,
          },
        ]}
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
            {icon}
          </View>
          <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>
        </View>

        <View style={styles.headerRight}>
          {/* Badge count */}
          <View
            style={[
              styles.countBadge,
              {
                backgroundColor: unreadCount > 0 ? color : colors.bg.tertiary,
              },
            ]}
          >
            <Text
              style={[
                styles.countText,
                { color: unreadCount > 0 ? '#FFFFFF' : colors.text.tertiary },
              ]}
            >
              {count}
            </Text>
          </View>

          {/* Chevron */}
          <Animated.View style={{ transform: [{ rotate: rotation }] }}>
            <ChevronDown size={20} color={colors.text.tertiary} />
          </Animated.View>
        </View>
      </TouchableOpacity>

      {/* Content - collapsible */}
      {isExpanded && <View style={styles.content}>{children}</View>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconContainer: {
    width: componentSizes.avatar.sm,
    height: componentSizes.avatar.sm,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  countBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  countText: {
    ...typography.caption,
    fontWeight: '700',
  },
  content: {
    marginTop: spacing.sm,
    paddingLeft: spacing.xs,
  },
})

export default CollapsibleSection
