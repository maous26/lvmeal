import React, { useEffect } from 'react'
import { View, Text, StyleSheet, Dimensions } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg'
import Animated, { useSharedValue, useAnimatedProps, withTiming, Easing } from 'react-native-reanimated'
import { useTheme } from '../../contexts/ThemeContext'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const { width } = Dimensions.get('window')

interface RingChartProps {
    calories: number
    target: number
}

export const RingChart = ({ calories, target }: RingChartProps) => {
    const { colors } = useTheme()
    const progress = Math.min(calories / target, 1)

    // Responsive size: 70% of screen width, max 300
    const size = Math.min(width * 0.7, 300)
    const strokeWidth = 24
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius

    const animatedProgress = useSharedValue(0)

    useEffect(() => {
        animatedProgress.value = withTiming(progress, {
            duration: 1500,
            easing: Easing.out(Easing.exp),
        })
    }, [progress])

    const animatedProps = useAnimatedProps(() => ({
        strokeDashoffset: circumference * (1 - animatedProgress.value),
    }))

    const remaining = Math.max(0, target - calories)

    return (
        <View style={[styles.container, { width: size, height: size }]}>
            <Svg width={size} height={size} style={styles.svg}>
                <Defs>
                    {/* Luxurious Gold Gradient */}
                    <LinearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <Stop offset="0%" stopColor="#E6B02E" stopOpacity="1" />
                        <Stop offset="50%" stopColor="#F6D365" stopOpacity="1" />
                        <Stop offset="100%" stopColor="#D4AF37" stopOpacity="1" />
                    </LinearGradient>

                    {/* Subtle Track Gradient */}
                    <LinearGradient id="trackGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <Stop offset="0%" stopColor={colors.border.default} stopOpacity="0.3" />
                        <Stop offset="100%" stopColor={colors.border.default} stopOpacity="0.1" />
                    </LinearGradient>
                </Defs>

                {/* Background Track - Explicit fill="none" to avoid black circle */}
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="url(#trackGradient)"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    fill="none"
                />

                {/* Animated Progress - Explicit fill="none" */}
                <AnimatedCircle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="url(#goldGradient)"
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${circumference} ${circumference}`}
                    animatedProps={animatedProps}
                    strokeLinecap="round"
                    rotation="-90"
                    origin={`${size / 2}, ${size / 2}`}
                    fill="none"
                />
            </Svg>

            {/* Centered Text Content */}
            <View style={styles.absoluteCenter}>
                {/* Huge Number */}
                <View style={styles.row}>
                    <Text style={[styles.valueText, { color: colors.text.primary }]}>
                        {Math.round(remaining)}
                    </Text>
                    <Text style={[styles.unitText, { color: colors.text.secondary, marginTop: 12 }]}>kcal</Text>
                </View>

                {/* Subtitle */}
                <Text style={[styles.subText, { color: colors.text.tertiary }]}>
                    sur {target} restants
                </Text>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    svg: {
        position: 'absolute',
        transform: [{ rotateZ: '0deg' }] // Fix for some android rendering quirks
    },
    absoluteCenter: {
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 4,
    },
    valueText: {
        fontSize: 52,
        fontFamily: 'PlayfairDisplay_700Bold',
        lineHeight: 62,
        paddingTop: 0,
    },
    unitText: {
        fontSize: 16,
        fontFamily: 'Inter_500Medium',
    },
    subText: {
        fontSize: 15,
        fontFamily: 'Inter_400Regular',
        marginTop: -4,
    }
})
