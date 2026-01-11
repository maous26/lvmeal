import React, { useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg'
import Animated, { useSharedValue, useAnimatedProps, withTiming, Easing, withRepeat, withSequence } from 'react-native-reanimated'
import { useTheme } from '../../contexts/ThemeContext'
import { typography, fonts } from '../../constants/theme'
import { GlassCard } from '../ui/GlassCard'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

interface HeroRingProps {
    calories: number
    target: number
}

export const HeroRing = ({ calories, target }: HeroRingProps) => {
    const { colors } = useTheme()
    const progress = Math.min(calories / target, 1)

    const size = 260
    const strokeWidth = 20
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

    const remaining = target - calories

    return (
        <View style={styles.container}>
            <Svg width={size} height={size} style={styles.svg}>
                <Defs>
                    <LinearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor="#E6B02E" stopOpacity="1" />
                        <Stop offset="50%" stopColor="#FFF7DD" stopOpacity="1" />
                        <Stop offset="100%" stopColor="#D67669" stopOpacity="1" />
                    </LinearGradient>
                    <LinearGradient id="trackGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor="#C8C4B7" stopOpacity="0.4" />
                        <Stop offset="100%" stopColor="#E6E2D6" stopOpacity="0.2" />
                    </LinearGradient>
                </Defs>

                {/* Backing Plate (Subtle background to anchor the ring) */}
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="rgba(255, 255, 255, 0.3)"
                    stroke="none"
                />

                {/* Track Circle */}
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="url(#trackGradient)"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    fill="transparent"
                />

                {/* Progress Circle with Gold Gradient */}
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
                    fill="transparent"
                />
            </Svg>

            {/* Center Content */}
            <View style={styles.absoluteCenter}>
                <View style={styles.textContainer}>
                    <Text style={[styles.caloriesValue, { color: colors.text.primary }]}>
                        {Math.round(remaining)}
                    </Text>
                    <Text style={[styles.caloriesUnit, { color: colors.text.primary }]}>kcal</Text>
                </View>
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
        marginVertical: 10,
        width: 260,
        height: 260,
    },
    svg: {
        position: 'absolute',
        zIndex: 1,
    },
    absoluteCenter: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    textContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
    },
    caloriesValue: {
        fontSize: 48,
        fontFamily: fonts.serif.bold,
        lineHeight: 56,
    },
    caloriesUnit: {
        fontSize: 18,
        fontFamily: fonts.serif.regular,
        marginBottom: 8,
    },
    subText: {
        fontSize: 16,
        fontFamily: fonts.sans.regular,
        marginTop: -4,
    }
})
