import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { GlassCard } from '../ui/GlassCard'
import { useTheme } from '../../contexts/ThemeContext'
import { spacing, typography, radius, componentSizes } from '../../constants/theme'

interface MealCardProps {
    label: string
    calories: number
    itemCount: number
    icon: string
    onPress: () => void
    color: string
}

export const MealCard = ({ label, calories, itemCount, icon, onPress, color }: MealCardProps) => {
    const { colors } = useTheme()

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
            <GlassCard style={styles.card} intensity={30}>
                <View style={[styles.iconContainer, { backgroundColor: colors.bg.secondary }]}>
                    <Text style={{ fontSize: 24 }}>{icon}</Text>
                </View>

                <View style={styles.content}>
                    <Text style={[styles.label, { color: colors.text.primary }]}>{label}</Text>
                    <Text style={[styles.description, { color: colors.text.tertiary }]}>
                        {itemCount > 0 ? `${itemCount} aliment${itemCount > 1 ? 's' : ''}` : 'Vide'}
                    </Text>
                    <Text style={[styles.calories, { color: color }]}>{calories} kcal</Text>
                </View>

                {/* Subtle arrow or indicator could go here */}
            </GlassCard>
        </TouchableOpacity>
    )
}

const styles = StyleSheet.create({
    card: {
        padding: spacing.default,
        width: 130,
        height: 160,
        marginRight: spacing.md,
        borderRadius: radius['2xl'],
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    iconContainer: {
        width: componentSizes.avatar.lg,
        height: componentSizes.avatar.lg,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.sm,
    },
    content: {
        gap: spacing.xs,
    },
    label: {
        ...typography.bodyMedium,
        fontWeight: '600',
    },
    description: {
        ...typography.caption,
    },
    calories: {
        ...typography.smallMedium,
        marginTop: spacing.xs,
    },
})
