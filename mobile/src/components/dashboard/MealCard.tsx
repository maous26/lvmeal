import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { GlassCard } from '../ui/GlassCard'
import { useTheme } from '../../contexts/ThemeContext'
import { spacing, typography, fonts } from '../../constants/theme'
import { ArrowRight } from 'lucide-react-native'

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
        padding: 16,
        width: 130, // Square-ish aspect ratio
        height: 160,
        marginRight: 12,
        borderRadius: 24,
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    content: {
        gap: 4
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        fontFamily: typography.h3.fontFamily,
    },
    description: {
        fontSize: 12,
        fontFamily: fonts.sans.regular,
    },
    calories: {
        fontSize: 14,
        fontWeight: '600',
        marginTop: 4,
    }
})
