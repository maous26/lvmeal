import React, { useEffect } from 'react'
import { View, StyleSheet, Dimensions } from 'react-native'
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    Easing,
    withDelay
} from 'react-native-reanimated'
import { useTheme } from '../../contexts/ThemeContext'

const { width, height } = Dimensions.get('window')

const Blob = ({ color, size, top, left, delay = 0 }: { color: string, size: number, top: number, left: number, delay?: number }) => {
    const scale = useSharedValue(1)
    const translateY = useSharedValue(0)
    const translateX = useSharedValue(0)

    useEffect(() => {
        scale.value = withDelay(delay, withRepeat(
            withSequence(
                withTiming(1.2, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        ))

        translateY.value = withDelay(delay, withRepeat(
            withSequence(
                withTiming(-30, { duration: 5000, easing: Easing.inOut(Easing.quad) }),
                withTiming(0, { duration: 5000, easing: Easing.inOut(Easing.quad) })
            ),
            -1,
            true
        ))
    }, [])

    const style = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value },
            { translateY: translateY.value },
            { translateX: translateX.value }
        ]
    }))

    return (
        <Animated.View
            style={[
                styles.blob,
                style,
                {
                    backgroundColor: color,
                    width: size,
                    height: size,
                    top,
                    left,
                    borderRadius: size / 2,
                }
            ]}
        />
    )
}

export const BackgroundOrbs = () => {
    const { colors } = useTheme()

    // Use the new organic luxury palette colors
    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {/* Top Right - Sage Green glow */}
            <Blob
                color={colors.accent.primary}
                size={width * 0.8}
                top={-width * 0.2}
                left={width * 0.4}
            />

            {/* Middle Left - Terracotta/Coral glow */}
            <Blob
                color={colors.secondary.primary}
                size={width * 0.7}
                top={height * 0.3}
                left={-width * 0.3}
                delay={2000}
            />

            {/* Bottom Right - Accent glow (Gold) */}
            <Blob
                color={colors.warning}
                size={width * 0.9}
                top={height * 0.7}
                left={width * 0.3}
                delay={1000}
            />

            {/* Overlay to diffuse everything */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg.primary, opacity: 0.85 }]} />
        </View>
    )
}

const styles = StyleSheet.create({
    blob: {
        position: 'absolute',
        opacity: 0.6,
    }
})
