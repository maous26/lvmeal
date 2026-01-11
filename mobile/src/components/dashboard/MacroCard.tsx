import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { GlassCard } from '../ui/GlassCard'
import { useTheme } from '../../contexts/ThemeContext'
import { spacing, typography, radius, fonts } from '../../constants/theme'
import Svg, { Circle } from 'react-native-svg'

interface MacroCardProps {
    label: string
    value: number
    target: number
    unit: string
    color: string
    icon: any // lucide icon component
}

export const MacroCardHeader = ({ label, value, target, unit, color, icon: Icon }: MacroCardProps) => {
    const { colors } = useTheme()
    const progress = Math.min((value / target) * 100, 100)

    // Mini circular progress
    const size = 24
    const strokeWidth = 3
    const r = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * r
    const strokeDashoffset = circumference - (progress / 100) * circumference

    return (
        <GlassCard style={styles.card} intensity={40}>
            <View style={styles.header}>
                <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
                    <Icon size={16} color={color} />
                </View>
                <View style={{ marginLeft: 8 }}>
                    <Text style={[styles.label, { color: colors.text.secondary }]}>{label}</Text>
                </View>
            </View>

            <View style={styles.content}>
                <Text style={styles.valueText}>
                    <Text style={{ fontFamily: typography.h3.fontFamily, fontSize: 18, color: colors.text.primary }}>{Math.round(value)}</Text>
                    <Text style={{ fontSize: 12, color: colors.text.tertiary }}> / {target}{unit}</Text>
                </Text>

                {/* Progress Bar instead of circle for better fit in small card */}
                <View style={[styles.progressTrack, { backgroundColor: colors.bg.tertiary }]}>
                    <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: color }]} />
                </View>
            </View>
        </GlassCard>
    )
}

const styles = StyleSheet.create({
    card: {
        padding: 12, // Small padding
        flex: 1,
        marginHorizontal: 4,
        borderRadius: 20,
        minHeight: 100,
        justifyContent: 'space-between'
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    iconContainer: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        fontFamily: fonts.sans.medium,
    },
    content: {
        gap: 6
    },
    valueText: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    progressTrack: {
        height: 6,
        borderRadius: 3,
        width: '100%',
        overflow: 'hidden',
        marginTop: 4,
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    }
})
