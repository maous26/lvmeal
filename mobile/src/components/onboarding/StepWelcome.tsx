import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { colors, radius, spacing, typography } from '../../constants/theme'

interface StepWelcomeProps {
  onStart: () => void
}

const features = [
  {
    icon: '🍽️',
    title: 'Suivi nutritionnel',
    description: 'Enregistrez vos repas facilement',
  },
  {
    icon: '📈',
    title: 'Objectifs personnalises',
    description: 'Atteignez vos objectifs sante',
  },
  {
    icon: '❤️',
    title: 'Conseils adaptes',
    description: 'LymIA, votre coach a votre ecoute',
  },
  {
    icon: '✨',
    title: 'Recettes sur mesure',
    description: 'Des idees adaptees a vos gouts',
  },
]

export function StepWelcome({ onStart }: StepWelcomeProps) {
  return (
    <View style={styles.container}>
      {/* Hero section */}
      <View style={styles.hero}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>🥗</Text>
        </View>

        <Text style={styles.title}>Bienvenue sur Presence</Text>
        <Text style={styles.description}>
          Votre compagnon nutrition intelligent pour atteindre vos objectifs sante
        </Text>
      </View>

      {/* Features grid */}
      <View style={styles.features}>
        {features.map((feature, index) => (
          <Card key={index} style={styles.featureCard}>
            <View style={styles.featureIcon}>
              <Text style={styles.featureEmoji}>{feature.icon}</Text>
            </View>
            <Text style={styles.featureTitle}>{feature.title}</Text>
            <Text style={styles.featureDescription}>{feature.description}</Text>
          </Card>
        ))}
      </View>

      {/* CTA */}
      <View style={styles.cta}>
        <Button onPress={onStart} fullWidth size="lg">
          Commencer
        </Button>
        <Text style={styles.ctaHint}>Configuration en 2 minutes</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: radius.xl,
    backgroundColor: colors.accent.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  featureCard: {
    width: '47%',
    padding: spacing.default,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.accent.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  featureEmoji: {
    fontSize: 20,
  },
  featureTitle: {
    ...typography.smallMedium,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  featureDescription: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  cta: {
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: spacing.lg,
  },
  ctaHint: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: spacing.md,
  },
})

export default StepWelcome
