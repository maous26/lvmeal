import React, { useState } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView, Modal, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Gift, TrendingUp, Calendar, Info, X, Check, Heart } from 'lucide-react-native'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { useTheme } from '../../contexts/ThemeContext'
import { radius, spacing, typography } from '../../constants/theme'

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
  const { colors } = useTheme()
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
            <Text style={[styles.title, { color: colors.text.primary }]}>Solde Plaisir</Text>
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
          <View style={[styles.setupBanner, { backgroundColor: colors.accent.light }]}>
            <View style={styles.setupContent}>
              <Gift size={20} color={colors.accent.primary} />
              <View style={styles.setupText}>
                <Text style={[styles.setupTitle, { color: colors.text.primary }]}>Ton cycle plaisir commence !</Text>
                <Text style={[styles.setupSubtitle, { color: colors.text.tertiary }]}>Économise 200 kcal pour débloquer un bonus repas dès le jour 3</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onConfirmStart || (() => {})}
              style={{
                backgroundColor: colors.accent.primary,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                borderRadius: radius.md,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
              }}
              activeOpacity={0.8}
            >
              <Check size={16} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>
                C'est parti !
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Credit display */}
        <View style={styles.creditDisplay}>
          <Text style={[styles.creditLabel, { color: colors.text.tertiary }]}>Solde disponible</Text>
          <View style={styles.creditValue}>
            <Text style={[styles.creditNumber, { color: colors.accent.primary }]}>{formatNumber(Math.max(0, availableCredit))}</Text>
            <Text style={[styles.creditUnit, { color: colors.text.secondary }]}>kcal</Text>
          </View>
          <Text style={[styles.creditMax, { color: colors.text.tertiary }]}>sur {formatNumber(maxCredit)} kcal max possible</Text>
        </View>

        {/* Credit gauge */}
        <View style={styles.gaugeContainer}>
          <View style={[styles.gaugeTrack, { backgroundColor: colors.bg.tertiary }]}>
            <View
              style={[
                styles.gaugeFill,
                { width: `${Math.min(creditPercentage, 100)}%`, backgroundColor: colors.accent.primary }
              ]}
            />
          </View>
          <View style={styles.gaugeLabels}>
            <Text style={[styles.gaugeLabel, { color: colors.text.tertiary }]}>0</Text>
            <Text style={[styles.gaugeLabel, { color: colors.text.tertiary }]}>{formatNumber(Math.round(maxCredit / 2))}</Text>
            <Text style={[styles.gaugeLabel, { color: colors.text.tertiary }]}>{formatNumber(maxCredit)}</Text>
          </View>
        </View>

        {/* Info box */}
        <View style={styles.infoBox}>
          <View style={[styles.infoBoxIcon, { backgroundColor: colors.success }]}>
            <Gift size={16} color="#FFFFFF" />
          </View>
          <View style={styles.infoBoxContent}>
            <Text style={[styles.infoBoxTitle, { color: colors.text.primary }]}>1 à 2 repas plaisir par semaine</Text>
            <Text style={[styles.infoBoxText, { color: colors.text.secondary }]}>
              Dès le jour 3 avec 200 kcal économisées, ajoute jusqu'à +600 kcal bonus sur un repas.
            </Text>
          </View>
        </View>

        {/* Next cycle info */}
        <View style={[styles.cycleInfo, { borderTopColor: colors.border.light }]}>
          <View style={styles.cycleInfoLeft}>
            <Calendar size={16} color={colors.text.tertiary} />
            <View>
              <Text style={[styles.cycleInfoTitle, { color: colors.text.secondary }]}>Nouveau cycle</Text>
              <Text style={[styles.cycleInfoSubtitle, { color: colors.text.tertiary }]}>
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
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.bg.primary }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border.default }]} />

          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View style={[styles.modalIcon, { backgroundColor: colors.accent.primary }]}>
                <Gift size={20} color="#FFFFFF" />
              </View>
              <Text style={[styles.modalTitle, { color: colors.text.primary }]}>Solde Plaisir</Text>
            </View>
            <Pressable onPress={() => setShowInfoModal(false)} style={styles.modalClose}>
              <X size={20} color={colors.text.tertiary} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* What is it */}
            <View style={[styles.modalSection, { backgroundColor: colors.bg.secondary }]}>
              <View style={styles.modalSectionHeader}>
                <Heart size={20} color={colors.accent.primary} />
                <Text style={[styles.modalSectionTitle, { color: colors.text.primary }]}>Le principe</Text>
              </View>
              <Text style={[styles.modalSectionText, { color: colors.text.secondary }]}>
                Économise des calories au quotidien et débloque jusqu'à 2 bonus repas par semaine !
              </Text>
              <View style={[styles.modalExample, { backgroundColor: colors.bg.tertiary }]}>
                <Text style={[styles.modalExampleText, { color: colors.text.tertiary }]}>
                  Dès 200 kcal économisées (à partir du jour 3), ajoute jusqu'à
                  <Text style={[styles.modalExampleHighlight, { color: colors.success }]}> +600 kcal bonus</Text> sur un repas de ton choix.
                </Text>
              </View>
            </View>

            {/* How it works */}
            <View style={[styles.modalSection, { backgroundColor: colors.bg.secondary }]}>
              <View style={styles.modalSectionHeader}>
                <TrendingUp size={20} color={colors.success} />
                <Text style={[styles.modalSectionTitle, { color: colors.text.primary }]}>Comment ça marche</Text>
              </View>
              <View style={styles.stepsList}>
                <Text style={[styles.stepItem, { color: colors.text.secondary }]}>
                  <Text style={[styles.stepNumber, { color: colors.success }]}>1. </Text>
                  Mange légèrement sous ton objectif pour accumuler des calories
                </Text>
                <Text style={[styles.stepItem, { color: colors.text.secondary }]}>
                  <Text style={[styles.stepNumber, { color: colors.success }]}>2. </Text>
                  À partir du jour 3 et 200 kcal économisées : bonus débloqué !
                </Text>
                <Text style={[styles.stepItem, { color: colors.text.secondary }]}>
                  <Text style={[styles.stepNumber, { color: colors.success }]}>3. </Text>
                  Ajoute jusqu'à +600 kcal sur un repas, jusqu'à 2 fois par semaine
                </Text>
              </View>
            </View>

            {/* Plaisir day */}
            <View style={[styles.modalSection, styles.plaisirSection]}>
              <View style={styles.modalSectionHeader}>
                <Gift size={20} color={colors.success} />
                <Text style={[styles.modalSectionTitle, { color: colors.text.primary }]}>Ton bonus repas</Text>
              </View>
              <Text style={[styles.modalSectionText, { color: colors.text.secondary }]}>
                Le bonus s'ajoute aux calories de ton repas normal. Par exemple : diner prevu 600 kcal + bonus 400 kcal = 1000 kcal au total.
              </Text>
              <Text style={[styles.plaisirHint, { color: colors.text.tertiary }]}>
                Choisis quelque chose qui te fait vraiment envie !
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
  },
  setupSubtitle: {
    ...typography.caption,
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
    marginBottom: spacing.xs,
  },
  creditValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  creditNumber: {
    fontSize: 40,
    fontWeight: '700',
  },
  creditUnit: {
    fontSize: 18,
    marginLeft: spacing.xs,
  },
  creditMax: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  gaugeContainer: {
    marginBottom: spacing.lg,
  },
  gaugeTrack: {
    height: 16,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  gaugeFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  gaugeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  gaugeLabel: {
    ...typography.caption,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBoxContent: {
    flex: 1,
  },
  infoBoxTitle: {
    ...typography.smallMedium,
  },
  infoBoxText: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  cycleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.default,
    borderTopWidth: 1,
  },
  cycleInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cycleInfoTitle: {
    ...typography.small,
  },
  cycleInfoSubtitle: {
    ...typography.caption,
  },
  dayBadgeText: {
    ...typography.caption,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
  },
  modalHandle: {
    width: 40,
    height: 4,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    ...typography.h4,
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
  },
  modalSectionText: {
    ...typography.small,
    lineHeight: 20,
  },
  modalExample: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  modalExampleText: {
    ...typography.caption,
  },
  modalExampleHighlight: {
    fontWeight: '500',
  },
  stepsList: {
    gap: spacing.sm,
  },
  stepItem: {
    ...typography.small,
  },
  stepNumber: {
    fontWeight: '500',
  },
  plaisirSection: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  plaisirHint: {
    ...typography.caption,
    marginTop: spacing.sm,
  },
  modalFooter: {
    padding: spacing.lg,
  },
})

export default CaloricBalance
