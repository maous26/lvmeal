import React, { useEffect } from 'react'
import { View, StyleSheet, Text } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Stop, Filter, FeGaussianBlur, FeMerge, FeMergeNode } from 'react-native-svg'
import Animated, {
    useSharedValue,
    useAnimatedProps,
    withTiming,
    withRepeat,
    withSequence,
    Easing,
    interpolateColor,
    useDerivedValue
} from 'react-native-reanimated'
import { useTheme } from '../../contexts/ThemeContext'
import { typography, fonts } from '../../constants/theme'
import { formatNumber } from '../../lib/utils'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

interface LiquidProgressProps {
    value: number
    max: number
    size?: number
    strokeWidth?: number
}

export const LiquidProgress = ({ value, max, size = 260, strokeWidth = 18 }: LiquidProgressProps) => {
    const { colors } = useTheme()
    const center = size / 2
    const r = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * r

    const progressValue = useSharedValue(0)
    const pulseValue = useSharedValue(1)
    const rotateValue = useSharedValue(0)

    useEffect(() => {
        // Animate progress smoothly
        progressValue.value = withTiming(Math.min(value / max, 1), {
            duration: 1500,
            easing: Easing.out(Easing.exp),
        })

        // Breathing/Pulse animation
        pulseValue.value = withRepeat(
            withSequence(
                withTiming(1.05, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        )

        // Slow rotation for organic feel
        rotateValue.value = withRepeat(
            withTiming(360, { duration: 20000, easing: Easing.linear }),
            -1,
            false
        )
    }, [value, max])

    const animatedProps = useAnimatedProps(() => {
        const strokeDashoffset = circumference * (1 - progressValue.value)
        return {
            strokeDashoffset,
        }
    })

    const glowStyle = useAnimatedProps(() => {
        return {
            opacity: (pulseValue.value - 0.5) * 0.8 // Varies glow opacity
        }
    })

    const rotationStyle = useAnimatedProps(() => {
        return {
            transform: [{ rotate: `${rotateValue.value}deg` }]
        }
    })

    const remaining = Math.max(0, max - value)

    return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            {/* Background Glow Layer - CSS Shadow equivalent */}
            <View style={[
                StyleSheet.absoluteFill,
                {
                    alignItems: 'center',
                    justifyContent: 'center',
                    // Shadow/Glow specific to organic luxury
                    shadowColor: colors.accent.primary,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.4,
                    shadowRadius: 30,
                }
            ]}>
                {/* React Native specific shadow trick for Android/iOS consistency could go here, 
             but simplest is standard shadow properties on View */}
            </View>

            <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
                <Defs>
                    <LinearGradient id="organicGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor={colors.accent.primary} />
                        <Stop offset="50%" stopColor={colors.accent.secondary} />
                        <Stop offset="100%" stopColor={colors.accent.muted} />
                    </LinearGradient>

                    <Filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                        <FeGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                        <FeMerge>
                            <FeMergeNode in="blur" />
                            <FeMergeNode in="SourceGraphic" />
                        </FeMerge>
                    </Filter>
                </Defs>

                {/* Track Circle */}
                <Circle
                    cx={center}
                    cy={center}
                    r={r}
                    stroke={colors.border.light}
                    strokeWidth={strokeWidth}
                    strokeOpacity={0.3}
                    fill="none"
                />

                {/* Progress Circle with Glow & Animation */}
                <AnimatedCircle
                    cx={center}
                    cy={center}
                    r={r}
                    stroke="url(#organicGradient)"
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeDasharray={circumference}
                    strokeLinecap="round" // We can work on custom linecap later if needed
                    animatedProps={animatedProps}
                />

                {/* Extra Organic "Tip" or Flow feel can be added here */}
            </Svg>

            {/* Center Content Typography */}
            <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                <Animated.View>
                    <Text style={[styles.mainValue, { color: colors.text.primary }]}>
                        {formatNumber(remaining)}
                    </Text>
                </Animated.View>
                <Text style={[styles.label, { color: colors.text.secondary }]}>
                    kcal restantes
                </Text>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    mainValue: {
        fontFamily: fonts.serif.bold,
        fontSize: 42,
        lineHeight: 48,
        textAlign: 'center',
    },
    label: {
        fontFamily: fonts.sans.medium,
        fontSize: 14,
        marginTop: 4,
        opacity: 0.8,
    }
})
