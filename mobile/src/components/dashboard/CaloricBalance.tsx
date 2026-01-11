import React, { useState } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView, Modal, SafeAreaView } from 'react-native'
import { Gift, TrendingUp, Calendar, Info, X, Check, Heart } from 'lucide-react-native'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { colors, radius, spacing, typography } from '../../constants/theme'

interface DailyBalance {
  day: string
  date: string
  consumed: number
  target: number
  balance: number
}

interface CaloricBalanceProps {
  dailyBalances: DailyBalance[]
  currentDay: number
  daysUntilNewWeek: number
  dailyTarget: number
  isFirstTimeSetup?: boolean
  onConfirmStart?: () => void
}

const MAX_VARIANCE_PERCENT = 0.10

function clampBalance(balance: number, target: number): number {
  const maxVariance = target * MAX_VARIANCE_PERCENT
  return Math.max(-maxVariance, Math.min(maxVariance, balance))
}

function formatNumber(num: number): string {
  return num.toLocaleString('fr-FR')
}

export function CaloricBalance({
  dailyBalances,
  currentDay,
  daysUntilNewWeek,
  dailyTarget,
  isFirstTimeSetup = false,
  onConfirmStart,
}: CaloricBalanceProps) {
  const [showInfoModal, setShowInfoModal] = useState(false)

  const maxDailyVariance = Math.round(dailyTarget * MAX_VARIANCE_PERCENT)
  const maxCredit = maxDailyVariance * 6

  const cumulativeSavings = dailyBalances.slice(0, currentDay).reduce((acc, day) => {
    const cappedBalance = clampBalance(day.balance, day.target || dailyTarget)
    return acc + cappedBalance
  }, 0)

  const availableCredit = Math.round(cumulativeSavings)
  const creditPercentage = maxCredit > 0 ? Math.max(0, (availableCredit / maxCredit) * 100) : 0

  const getStatus = () => {
    if (availableCredit >= maxCredit * 0.6) {
      return { label: 'Super !', variant: 'success' as const }
    }
    if (availableCredit >= maxCredit * 0.3) {
      return { label: 'Bien parti', variant: 'info' as const }
    }
    if (availableCredit > 0) {
      return { label: 'En route', variant: 'info' as const }
    }
    return { label: 'Nouveau cycle', variant: 'default' as const }
  }

  const status = getStatus()

  return (
    <>
      <Card style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Gift size={20} color={colors.accent.primary} />
            <Text style={styles.title}>Solde Plaisir</Text>
            <Pressable onPress={() => setShowInfoModal(true)} style={styles.infoButton}>
              <Info size={16} color={colors.text.tertiary} />
            </Pressable>
          </View>
          <Badge variant={status.variant} size="sm">
            <Text style={styles.statusText}>{status.label}</Text>
          </Badge>
        </View>

        {/* First time setup banner */}
        {isFirstTimeSetup && (
          <View style={styles.setupBanner}>
            <View style={styles.setupContent}>
              <Gift size={20} color={colors.accent.primary} />
              <View style={styles.setupText}>
                <Text style={styles.setupTitle}>Ton cycle plaisir commence !</Text>
                <Text style={styles.setupSubtitle}>Economisez 200 kcal pour debloquer un repas plaisir des le jour 3</Text>
              </View>
            </View>
            <Button
              variant="primary"
              size="sm"
              onPress={onConfirmStart || (() => {})}
              icon={<Check size={16} color="#FFFFFF" />}
            >
              C'est parti !
            </Button>
          </View>
        )}

        {/* Credit display */}
        <View style={styles.creditDisplay}>
          <Text style={styles.creditLabel}>Solde disponible</Text>
          <View style={styles.creditValue}>
            <Text style={styles.creditNumber}>{formatNumber(Math.max(0, availableCredit))}</Text>
            <Text style={styles.creditUnit}>kcal</Text>
          </View>
          <Text style={styles.creditMax}>sur {formatNumber(maxCredit)} kcal max possible</Text>
        </View>

        {/* Credit gauge */}
        <View style={styles.gaugeContainer}>
          <View style={styles.gaugeTrack}>
            <View
              style={[
                styles.gaugeFill,
                { width: `${Math.min(creditPercentage, 100)}%` }
              ]}
            />
          </View>
          <View style={styles.gaugeLabels}>
            <Text style={styles.gaugeLabel}>0</Text>
            <Text style={styles.gaugeLabel}>{formatNumber(Math.round(maxCredit / 2))}</Text>
            <Text style={styles.gaugeLabel}>{formatNumber(maxCredit)}</Text>
          </View>
        </View>

        {/* Info box */}
        <View style={styles.infoBox}>
          <View style={styles.infoBoxIcon}>
            <Gift size={16} color="#FFFFFF" />
          </View>
          <View style={styles.infoBoxContent}>
            <Text style={styles.infoBoxTitle}>1 a 2 repas plaisir par semaine</Text>
            <Text style={styles.infoBoxText}>
              Des le jour 3 avec 200 kcal economisees, debloque un repas plaisir (max 600 kcal/repas).
            </Text>
          </View>
        </View>

        {/* Next cycle info */}
        <View style={styles.cycleInfo}>
          <View style={styles.cycleInfoLeft}>
            <Calendar size={16} color={colors.text.tertiary} />
            <View>
              <Text style={styles.cycleInfoTitle}>Nouveau cycle</Text>
              <Text style={styles.cycleInfoSubtitle}>
                {daysUntilNewWeek > 0
                  ? `Dans ${daysUntilNewWeek} jour${daysUntilNewWeek > 1 ? 's' : ''}`
                  : 'Demain'
                }
              </Text>
            </View>
          </View>
          <Badge variant="info" size="sm">
            <Text style={styles.dayBadgeText}>Jour {currentDay + 1}/7</Text>
          </Badge>
        </View>
      </Card>

      {/* Info Modal */}
      <Modal
        visible={showInfoModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHandle} />

          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View style={styles.modalIcon}>
                <Gift size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.modalTitle}>Solde Plaisir</Text>
            </View>
            <Pressable onPress={() => setShowInfoModal(false)} style={styles.modalClose}>
              <X size={20} color={colors.text.tertiary} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* What is it */}
            <View style={styles.modalSection}>
              <View style={styles.modalSectionHeader}>
                <Heart size={20} color={colors.accent.primary} />
                <Text style={styles.modalSectionTitle}>Le principe</Text>
              </View>
              <Text style={styles.modalSectionText}>
                Economisez des calories au quotidien et debloque jusqu'a 2 repas plaisir par semaine !
              </Text>
              <View style={styles.modalExample}>
                <Text style={styles.modalExampleText}>
                  Des 200 kcal economisees (a partir du jour 3), tu peux te faire plaisir avec
                  <Text style={styles.modalExampleHighlight}> max 600 kcal</Text> par repas bonus.
                </Text>
              </View>
            </View>

            {/* How it works */}
            <View style={styles.modalSection}>
              <View style={styles.modalSectionHeader}>
                <TrendingUp size={20} color="#10B981" />
                <Text style={styles.modalSectionTitle}>Comment ca marche</Text>
              </View>
              <View style={styles.stepsList}>
                <Text style={styles.stepItem}>
                  <Text style={styles.stepNumber}>1. </Text>
                  Mange legerement sous ton objectif pour accumuler des calories
                </Text>
                <Text style={styles.stepItem}>
                  <Text style={styles.stepNumber}>2. </Text>
                  A partir du jour 3 et 200 kcal economisees : repas plaisir debloque !
                </Text>
                <Text style={styles.stepItem}>
                  <Text style={styles.stepNumber}>3. </Text>
                  Max 600 kcal par repas plaisir, jusqu'a 2 fois par semaine
                </Text>
              </View>
            </View>

            {/* Plaisir day */}
            <View style={[styles.modalSection, styles.plaisirSection]}>
              <View style={styles.modalSectionHeader}>
                <Gift size={20} color="#10B981" />
                <Text style={styles.modalSectionTitle}>Tes repas plaisir</Text>
              </View>
              <Text style={styles.modalSectionText}>
                Choisis quelque chose qui te fait vraiment envie — pas juste plus de la meme chose.
                Si ton solde depasse 600 kcal, repartis-le sur 2 repas.
              </Text>
              <Text style={styles.plaisirHint}>
                C'est ta recompense bien meritee, savoure-la !
              </Text>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Button variant="primary" size="lg" fullWidth onPress={() => setShowInfoModal(false)}>
              Super, merci !
            </Button>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.default,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.default,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  infoButton: {
    padding: spacing.xs,
  },
  statusText: {
    ...typography.caption,
  },
  setupBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.accent.light,
    borderRadius: radius.lg,
    marginBottom: spacing.default,
    gap: spacing.md,
  },
  setupContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  setupText: {
    flex: 1,
  },
  setupTitle: {
    ...typography.smallMedium,
    color: colors.text.primary,
  },
  setupSubtitle: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  setupButtonText: {
    ...typography.smallMedium,
    color: '#FFFFFF',
    marginLeft: spacing.xs,
  },
  creditDisplay: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  creditLabel: {
    ...typography.small,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  creditValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  creditNumber: {
    fontSize: 40,
    fontWeight: '700',
    color: colors.accent.primary,
  },
  creditUnit: {
    fontSize: 18,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
  creditMax: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  gaugeContainer: {
    marginBottom: spacing.lg,
  },
  gaugeTrack: {
    height: 16,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  gaugeFill: {
    height: '100%',
    backgroundColor: colors.accent.primary,
    borderRadius: radius.full,
  },
  gaugeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  gaugeLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  infoBox: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: radius.lg,
    marginBottom: spacing.default,
    gap: spacing.md,
  },
  infoBoxIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBoxContent: {
    flex: 1,
  },
  infoBoxTitle: {
    ...typography.smallMedium,
    color: colors.text.primary,
  },
  infoBoxText: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  cycleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.default,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  cycleInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cycleInfoTitle: {
    ...typography.small,
    color: colors.text.secondary,
  },
  cycleInfoSubtitle: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  dayBadgeText: {
    ...typography.caption,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border.default,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  modalIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    ...typography.h4,
    color: colors.text.primary,
  },
  modalClose: {
    padding: spacing.sm,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  modalSection: {
    padding: spacing.default,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    marginBottom: spacing.default,
  },
  modalSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  modalSectionTitle: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  modalSectionText: {
    ...typography.small,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  modalExample: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.md,
  },
  modalExampleText: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  modalExampleHighlight: {
    color: colors.success,
    fontWeight: '500',
  },
  stepsList: {
    gap: spacing.sm,
  },
  stepItem: {
    ...typography.small,
    color: colors.text.secondary,
  },
  stepNumber: {
    color: colors.success,
  },
  plaisirSection: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  plaisirHint: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
  },
  modalFooter: {
    padding: spacing.lg,
  },
})

export default CaloricBalance
