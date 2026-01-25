import React from 'react'
import { StyleSheet, View, ViewStyle } from 'react-native'
import { useTheme } from '../../contexts/ThemeContext'
import { radius, shadows } from '../../constants/theme'
import Animated, { FadeInDown } from 'react-native-reanimated'

interface GlassCardProps {
    children: React.ReactNode
    style?: ViewStyle
    intensity?: number // Kept for backward compatibility, ignored
    delay?: number
    variant?: 'default' | 'elevated' | 'subtle'
    noPadding?: boolean
}

/**
 * GlassCard - iOS-style flat card component
 * Simplified from glassmorphism to clean, minimal cards
 */
export const GlassCard = ({
    children,
    style,
    delay = 0,
    variant = 'default',
    noPadding = false,
}: GlassCardProps) => {
    const { colors } = useTheme()

    // Variant styles
    const getVariantStyles = () => {
        switch (variant) {
            case 'elevated':
                return {
                    container: {
                        backgroundColor: colors.bg.elevated,
                        borderWidth: 1,
                        borderColor: colors.border.light,
                        ...shadows.sm,
                    },
                }
            case 'subtle':
                return {
                    container: {
                        backgroundColor: colors.bg.secondary,
                        borderWidth: 0,
                        borderColor: 'transparent',
                    },
                }
            default:
                return {
                    container: {
                        backgroundColor: colors.bg.elevated,
                        borderWidth: 1,
                        borderColor: colors.border.light,
                    },
                }
        }
    }

    const variantStyles = getVariantStyles()

    return (
        <Animated.View
            entering={FadeInDown.delay(delay).springify().damping(12)}
            style={[
                styles.container,
                variantStyles.container,
                style,
            ]}
        >
            <View style={[styles.content, noPadding && styles.noPadding]}>
                {children}
            </View>
        </Animated.View>
    )
}

const styles = StyleSheet.create({
    container: {
        borderRadius: radius.lg, // 12px instead of 24px
        overflow: 'hidden',
    },
    content: {
        padding: 16,
        width: '100%',
    },
    noPadding: {
        padding: 0,
    },
})
