import React from 'react'
import { StyleSheet, View, ViewStyle } from 'react-native'
import { BlurView } from 'expo-blur'
import { useTheme } from '../../contexts/ThemeContext'
import { radius, shadows } from '../../constants/theme'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'

interface GlassCardProps {
    children: React.ReactNode
    style?: ViewStyle
    intensity?: number
    delay?: number
    variant?: 'default' | 'elevated' | 'subtle'
    noPadding?: boolean
}

export const GlassCard = ({
    children,
    style,
    intensity = 25,
    delay = 0,
    variant = 'default',
    noPadding = false,
}: GlassCardProps) => {
    const { isDark } = useTheme()

    const tint = isDark ? 'dark' : 'light'

    // Couleurs organiques pour le glassmorphism
    const overlayColor = isDark
        ? 'rgba(30, 35, 30, 0.5)'   // Teinte verte subtile dark
        : 'rgba(253, 252, 250, 0.7)' // Crème semi-transparent light

    // Bordure gradient subtile
    const borderColors = isDark
        ? ['rgba(122, 158, 126, 0.2)', 'rgba(122, 158, 126, 0.05)'] // Sauge
        : ['rgba(74, 103, 65, 0.12)', 'rgba(74, 103, 65, 0.03)']    // Mousse

    // Shadow selon variant
    const shadowStyle = variant === 'elevated'
        ? styles.elevatedShadow
        : variant === 'subtle'
        ? styles.subtleShadow
        : styles.defaultShadow

    return (
        <Animated.View
            entering={FadeInDown.delay(delay).springify().damping(12)}
            style={[styles.container, shadowStyle, style]}
        >
            {/* Bordure gradient subtile */}
            <LinearGradient
                colors={borderColors as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.borderGradient}
            >
                <View style={styles.innerContainer}>
                    <BlurView intensity={intensity} tint={tint} style={styles.blur}>
                        <View style={[
                            styles.content,
                            noPadding && styles.noPadding,
                            { backgroundColor: overlayColor }
                        ]}>
                            {children}
                        </View>
                    </BlurView>
                </View>
            </LinearGradient>
        </Animated.View>
    )
}

const styles = StyleSheet.create({
    container: {
        borderRadius: radius['2xl'],
    },
    borderGradient: {
        borderRadius: radius['2xl'],
        padding: 1, // Épaisseur de la bordure
    },
    innerContainer: {
        borderRadius: radius['2xl'] - 1,
        overflow: 'hidden',
    },
    blur: {
        width: '100%',
    },
    content: {
        padding: 20,
        width: '100%',
    },
    noPadding: {
        padding: 0,
    },
    // Shadows organiques
    defaultShadow: {
        shadowColor: '#4A6741',    // Vert mousse
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 6,
    },
    elevatedShadow: {
        shadowColor: '#4A6741',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 32,
        elevation: 10,
    },
    subtleShadow: {
        shadowColor: '#4A6741',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
    },
})
