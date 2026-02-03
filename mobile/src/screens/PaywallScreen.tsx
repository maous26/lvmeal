/**
 * PaywallScreen - Premium subscription paywall with RevenueCat
 *
 * Features:
 * - Display subscription plans from RevenueCat
 * - Handle purchases via App Store / Google Play
 * - Restore previous purchases
 * - Show trial status
 * - Premium benefits showcase
 */

import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native'
import { useToast } from '../components/ui/Toast'
import { LinearGradient } from 'expo-linear-gradient'
import {
  X,
  Heart,
  Sparkles,
  Shield,
  Clock,
  Zap,
  Brain,
  Check,
  Crown,
  Star,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { useNavigation } from '@react-navigation/native'

import { useTheme } from '../contexts/ThemeContext'
import { analytics } from '../services/analytics-service'
import { useSubscriptionStore, useTrialDaysRemaining } from '../stores/subscription-store'
import type { SubscriptionPlan } from '../services/revenuecat-service'
import { fonts, spacing, radius, lymBrand } from '../constants/theme'

export default function PaywallScreen() {
  const navigation = useNavigation()
  const { colors } = useTheme()
  const toast = useToast()

  const {
    plans,
    isLoading,
    isPremium,
    isInTrial,
    fetchPlans,
    purchase,
    restore,
    startTrial,
  } = useSubscriptionStore()

  const trialDaysRemaining = useTrialDaysRemaining()

  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null)
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)

  // Fetch plans on mount
  useEffect(() => {
    fetchPlans()
    analytics.trackPaywallViewed('paywall_screen', 'v2_revenuecat')
  }, [])

  // Auto-select popular plan
  useEffect(() => {
    if (plans.length > 0 && !selectedPlan) {
      const popularPlan = plans.find((p) => p.popular) || plans[0]
      setSelectedPlan(popularPlan)
    }
  }, [plans])

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedPlan(plan)
  }

  const handlePurchase = async () => {
    if (!selectedPlan) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setIsPurchasing(true)

    try {
      const result = await purchase(selectedPlan)

      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        toast.success('Bienvenue dans LYM Premium !')
        navigation.goBack()
      } else if (result.cancelled) {
        // User cancelled - do nothing
      } else if (result.error) {
        toast.error(result.error)
      }
    } catch (error: any) {
      toast.error('Une erreur est survenue')
    } finally {
      setIsPurchasing(false)
    }
  }

  const handleRestore = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setIsRestoring(true)

    try {
      const result = await restore()

      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        toast.success('Achats restaurés avec succès !')
        navigation.goBack()
      } else {
        toast.info(result.error || 'Aucun achat à restaurer')
      }
    } catch (error: any) {
      toast.error('Erreur lors de la restauration')
    } finally {
      setIsRestoring(false)
    }
  }

  const handleStartTrial = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    startTrial()
    toast.success('Essai gratuit de 7 jours activé !')
    navigation.goBack()
  }

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    navigation.goBack()
  }

  // If already premium, show success state
  if (isPremium && !isInTrial) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
        <View style={styles.successContainer}>
          <View style={[styles.successIcon, { backgroundColor: colors.success + '20' }]}>
            <Crown size={48} color={colors.success} />
          </View>
          <Text style={[styles.successTitle, { color: colors.text.primary }]}>
            Tu es Premium !
          </Text>
          <Text style={[styles.successSubtitle, { color: colors.text.secondary }]}>
            Profite de toutes les fonctionnalités LYM
          </Text>
          <TouchableOpacity
            style={[styles.successButton, { backgroundColor: colors.accent.primary }]}
            onPress={handleClose}
          >
            <Text style={styles.successButtonText}>Continuer</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.closeButton, { backgroundColor: colors.bg.secondary }]}
          onPress={handleClose}
        >
          <X size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.restoreButton}
          onPress={handleRestore}
          disabled={isRestoring}
        >
          <Text style={[styles.restoreText, { color: colors.accent.primary }]}>
            {isRestoring ? 'Restauration...' : 'Restaurer'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.heroSection}>
          <LinearGradient
            colors={[lymBrand.green, lymBrand.greenLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroIcon}
          >
            <Crown size={40} color="#FFFFFF" />
          </LinearGradient>

          <Text style={[styles.heroTitle, { color: colors.text.primary }]}>
            Passe à LYM Premium
          </Text>

          <Text style={[styles.heroSubtitle, { color: colors.text.secondary }]}>
            Débloques toutes les fonctionnalités et atteins tes objectifs plus vite
          </Text>

          {/* Trial badge */}
          {isInTrial && trialDaysRemaining > 0 && (
            <View style={[styles.trialBadge, { backgroundColor: colors.warning + '20' }]}>
              <Clock size={16} color={colors.warning} />
              <Text style={[styles.trialBadgeText, { color: colors.warning }]}>
                {trialDaysRemaining} jour{trialDaysRemaining > 1 ? 's' : ''} d'essai restant{trialDaysRemaining > 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Plans */}
        <View style={styles.plansSection}>
          {isLoading ? (
            <ActivityIndicator size="large" color={colors.accent.primary} />
          ) : (
            plans.map((plan) => (
              <TouchableOpacity
                key={plan.id}
                style={[
                  styles.planCard,
                  { backgroundColor: colors.bg.elevated, borderColor: colors.border.default },
                  selectedPlan?.id === plan.id && {
                    borderColor: colors.accent.primary,
                    borderWidth: 2,
                  },
                  plan.popular && styles.planCardPopular,
                ]}
                onPress={() => handleSelectPlan(plan)}
                activeOpacity={0.8}
              >
                {plan.popular && (
                  <View style={[styles.popularBadge, { backgroundColor: colors.accent.primary }]}>
                    <Star size={12} color="#FFFFFF" />
                    <Text style={styles.popularBadgeText}>POPULAIRE</Text>
                  </View>
                )}

                <View style={styles.planHeader}>
                  <View>
                    <Text style={[styles.planTitle, { color: colors.text.primary }]}>
                      {plan.period === 'monthly' ? 'Mensuel' : plan.period === 'yearly' ? 'Annuel' : 'À Vie'}
                    </Text>
                    {plan.pricePerMonth && (
                      <Text style={[styles.planSubtitle, { color: colors.text.tertiary }]}>
                        {plan.pricePerMonth}/mois
                      </Text>
                    )}
                  </View>
                  <View style={styles.planPriceContainer}>
                    <Text style={[styles.planPrice, { color: colors.text.primary }]}>
                      {plan.price}
                    </Text>
                    {plan.savings && (
                      <View style={[styles.savingsBadge, { backgroundColor: colors.success + '20' }]}>
                        <Text style={[styles.savingsText, { color: colors.success }]}>
                          -{plan.savings}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {plan.trialDuration && (
                  <Text style={[styles.trialText, { color: colors.accent.primary }]}>
                    {plan.trialDuration}
                  </Text>
                )}

                {/* Selection indicator */}
                <View
                  style={[
                    styles.radioOuter,
                    { borderColor: selectedPlan?.id === plan.id ? colors.accent.primary : colors.border.medium },
                  ]}
                >
                  {selectedPlan?.id === plan.id && (
                    <View style={[styles.radioInner, { backgroundColor: colors.accent.primary }]} />
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Benefits */}
        <View style={[styles.benefitsCard, { backgroundColor: colors.bg.elevated }]}>
          <Text style={[styles.benefitsTitle, { color: colors.text.primary }]}>
            Inclus dans Premium
          </Text>

          <View style={styles.benefitsList}>
            <BenefitItem
              icon={<Brain size={20} color={lymBrand.green} />}
              title="Coach IA illimité"
              subtitle="Conseils personnalisés 24/7"
              colors={colors}
            />
            <BenefitItem
              icon={<Sparkles size={20} color={lymBrand.orange} />}
              title="Analyses avancées"
              subtitle="Sommeil, stress, énergie"
              colors={colors}
            />
            <BenefitItem
              icon={<Zap size={20} color={colors.warning} />}
              title="Programme métabolique"
              subtitle="4 phases pour te transformer"
              colors={colors}
            />
            <BenefitItem
              icon={<Shield size={20} color={colors.info} />}
              title="Sauvegarde cloud"
              subtitle="Tes données en sécurité"
              colors={colors}
            />
            <BenefitItem
              icon={<Heart size={20} color={colors.error} />}
              title="Pas de publicité"
              subtitle="Expérience 100% zen"
              colors={colors}
            />
          </View>
        </View>

        {/* CTA Button */}
        <TouchableOpacity
          style={[
            styles.ctaButton,
            { backgroundColor: colors.accent.primary },
            (isPurchasing || !selectedPlan) && styles.ctaButtonDisabled,
          ]}
          onPress={handlePurchase}
          disabled={isPurchasing || !selectedPlan}
          activeOpacity={0.8}
        >
          {isPurchasing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.ctaText}>
                {selectedPlan?.trialDuration
                  ? 'Commencer l\'essai gratuit'
                  : 'S\'abonner maintenant'}
              </Text>
              {selectedPlan && (
                <Text style={styles.ctaPriceText}>
                  puis {selectedPlan.price}
                  {selectedPlan.period === 'monthly' ? '/mois' : selectedPlan.period === 'yearly' ? '/an' : ''}
                </Text>
              )}
            </>
          )}
        </TouchableOpacity>

        {/* Start free trial button (if not in trial) */}
        {!isInTrial && (
          <TouchableOpacity
            style={styles.trialButton}
            onPress={handleStartTrial}
            activeOpacity={0.7}
          >
            <Text style={[styles.trialButtonText, { color: colors.accent.primary }]}>
              Essayer 7 jours gratuitement
            </Text>
          </TouchableOpacity>
        )}

        {/* Legal */}
        <Text style={[styles.legalText, { color: colors.text.muted }]}>
          {Platform.OS === 'ios'
            ? 'L\'abonnement sera facturé sur votre compte iTunes. Il se renouvellera automatiquement sauf annulation 24h avant la fin de la période. '
            : 'L\'abonnement sera facturé sur votre compte Google Play. Il se renouvellera automatiquement sauf annulation. '}
          En continuant, vous acceptez nos{' '}
          <Text style={{ textDecorationLine: 'underline' }}>CGU</Text> et{' '}
          <Text style={{ textDecorationLine: 'underline' }}>Politique de confidentialité</Text>.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

// Benefit item component
function BenefitItem({
  icon,
  title,
  subtitle,
  colors,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  colors: ReturnType<typeof useTheme>['colors']
}) {
  return (
    <View style={styles.benefitItem}>
      <View style={[styles.benefitIcon, { backgroundColor: colors.bg.secondary }]}>
        {icon}
      </View>
      <View style={styles.benefitContent}>
        <Text style={[styles.benefitTitle, { color: colors.text.primary }]}>
          {title}
        </Text>
        <Text style={[styles.benefitSubtitle, { color: colors.text.tertiary }]}>
          {subtitle}
        </Text>
      </View>
      <Check size={20} color={colors.success} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.default,
    paddingVertical: spacing.sm,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restoreButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  restoreText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 40,
  },
  // Hero
  heroSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: fonts.serif.bold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing.md,
  },
  trialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  trialBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Plans
  plansSection: {
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  planCard: {
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    position: 'relative',
  },
  planCardPopular: {
    marginTop: spacing.sm,
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    gap: 4,
  },
  popularBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  planSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  planPriceContainer: {
    alignItems: 'flex-end',
  },
  planPrice: {
    fontSize: 20,
    fontWeight: '700',
  },
  savingsBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginTop: 4,
  },
  savingsText: {
    fontSize: 11,
    fontWeight: '700',
  },
  trialText: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: spacing.xs,
  },
  radioOuter: {
    position: 'absolute',
    right: spacing.md,
    top: '50%',
    transform: [{ translateY: -10 }],
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  // Benefits
  benefitsCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: fonts.serif.semibold,
    marginBottom: spacing.md,
  },
  benefitsList: {
    gap: spacing.md,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  benefitSubtitle: {
    fontSize: 13,
  },
  // CTA
  ctaButton: {
    paddingVertical: spacing.md + 4,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  ctaButtonDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  ctaPriceText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 4,
  },
  trialButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  trialButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // Legal
  legalText: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: spacing.sm,
  },
  // Success state
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: fonts.serif.bold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  successSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  successButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing['2xl'],
    borderRadius: radius.lg,
  },
  successButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
})
