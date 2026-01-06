/**
 * PaywallScreen - Écran d'abonnement LYM
 *
 * Philosophie LYM:
 * - Ton calme, non vendeur
 * - Relation installée après 7 jours
 * - Focus sur la continuité, pas les features
 * - Prix transparent: 12,90€/mois
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native'
import { useToast } from '../components/ui/Toast'
import { LinearGradient } from 'expo-linear-gradient'
import {
  X,
  Check,
  Heart,
  Sparkles,
  Shield,
  Clock,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { useNavigation } from '@react-navigation/native'

import { useTheme } from '../contexts/ThemeContext'
import { useOnboardingStore, SUBSCRIPTION_PRICE } from '../stores/onboarding-store'
import { useUserStore } from '../stores/user-store'
import { fonts } from '../constants/theme'

export default function PaywallScreen() {
  const navigation = useNavigation()
  const { colors } = useTheme()
  const toast = useToast()
  const { profile } = useUserStore()
  const {
    subscribe,
    markPaywallSeen,
    getDaysSinceSignup,
    getTrialDaysRemaining,
  } = useOnboardingStore()

  const [isLoading, setIsLoading] = useState(false)

  const daysSinceSignup = getDaysSinceSignup()
  const trialDaysRemaining = getTrialDaysRemaining()
  const userName = profile?.firstName || 'toi'

  const handleSubscribe = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setIsLoading(true)

    try {
      // TODO: Intégrer RevenueCat ou autre système de paiement
      // Pour l'instant, simulation
      await new Promise(resolve => setTimeout(resolve, 1500))

      subscribe()
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      Alert.alert(
        'Bienvenue ! 💜',
        'Ton abonnement est activé. LYM est maintenant à tes côtés sans limite.',
        [{ text: 'Parfait', onPress: () => navigation.goBack() }]
      )
    } catch (error) {
      toast.error('Une erreur est survenue. Reessaie plus tard.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    markPaywallSeen()
    navigation.goBack()
  }

  const handleRestorePurchases = () => {
    // TODO: Intégrer RevenueCat restore
    toast.info('Aucun achat a restaurer')
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
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.heroSection}>
          <LinearGradient
            colors={[colors.accent.primary, colors.secondary.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroIcon}
          >
            <Heart size={40} color="#FFFFFF" />
          </LinearGradient>

          <Text style={[styles.heroTitle, { color: colors.text.primary }]}>
            LYM commence à{'\n'}bien te connaître
          </Text>

          <Text style={[styles.heroSubtitle, { color: colors.text.secondary }]}>
            {daysSinceSignup} jours ensemble, {userName}.{'\n'}
            Pour continuer cet accompagnement...
          </Text>
        </View>

        {/* Benefits - Ton LYM */}
        <View style={[styles.benefitsCard, { backgroundColor: colors.bg.elevated }]}>
          <Text style={[styles.benefitsTitle, { color: colors.text.primary }]}>
            Avec LYM Premium
          </Text>

          <View style={styles.benefitsList}>
            <BenefitItem
              icon={<Sparkles size={20} color={colors.accent.primary} />}
              text="Un coach qui te comprend vraiment"
              colors={colors}
            />
            <BenefitItem
              icon={<Heart size={20} color={colors.secondary.primary} />}
              text="Des suggestions adaptées à ton rythme"
              colors={colors}
            />
            <BenefitItem
              icon={<Shield size={20} color={colors.success} />}
              text="Zéro pression, zéro culpabilité"
              colors={colors}
            />
            <BenefitItem
              icon={<Clock size={20} color={colors.info} />}
              text="Ton historique et ta progression"
              colors={colors}
            />
          </View>
        </View>

        {/* Pricing */}
        <View style={styles.pricingSection}>
          <TouchableOpacity
            style={[styles.priceCard, { borderColor: colors.accent.primary }]}
            activeOpacity={0.9}
            onPress={handleSubscribe}
            disabled={isLoading}
          >
            <LinearGradient
              colors={[colors.accent.primary + '10', colors.secondary.primary + '10']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.priceCardGradient}
            >
              <View style={styles.priceHeader}>
                <Text style={[styles.priceLabel, { color: colors.text.secondary }]}>
                  Abonnement mensuel
                </Text>
                <View style={[styles.popularBadge, { backgroundColor: colors.accent.primary }]}>
                  <Text style={styles.popularText}>Recommandé</Text>
                </View>
              </View>

              <View style={styles.priceRow}>
                <Text style={[styles.priceAmount, { color: colors.text.primary }]}>
                  {SUBSCRIPTION_PRICE.toFixed(2).replace('.', ',')} €
                </Text>
                <Text style={[styles.pricePeriod, { color: colors.text.tertiary }]}>
                  / mois
                </Text>
              </View>

              <Text style={[styles.priceNote, { color: colors.text.tertiary }]}>
                Résiliable à tout moment, sans engagement
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* CTA Button */}
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={handleSubscribe}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[colors.accent.primary, colors.secondary.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.ctaGradient, isLoading && styles.ctaLoading]}
          >
            <Text style={styles.ctaText}>
              {isLoading ? 'Chargement...' : 'Continuer avec LYM'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Trial reminder */}
        {trialDaysRemaining > 0 && (
          <Text style={[styles.trialReminder, { color: colors.text.tertiary }]}>
            Il te reste {trialDaysRemaining} jour{trialDaysRemaining > 1 ? 's' : ''} d'essai gratuit
          </Text>
        )}

        {/* Footer links */}
        <View style={styles.footerLinks}>
          <TouchableOpacity onPress={handleRestorePurchases}>
            <Text style={[styles.footerLink, { color: colors.text.tertiary }]}>
              Restaurer mes achats
            </Text>
          </TouchableOpacity>

          <Text style={[styles.footerDot, { color: colors.text.muted }]}>•</Text>

          <TouchableOpacity onPress={handleClose}>
            <Text style={[styles.footerLink, { color: colors.text.tertiary }]}>
              Plus tard
            </Text>
          </TouchableOpacity>
        </View>

        {/* Legal */}
        <Text style={[styles.legalText, { color: colors.text.muted }]}>
          L'abonnement sera facturé sur ton compte iTunes.{'\n'}
          Tu peux gérer ou annuler ton abonnement à tout moment{'\n'}
          dans les réglages de ton compte.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

// Benefit item component
function BenefitItem({
  icon,
  text,
  colors,
}: {
  icon: React.ReactNode
  text: string
  colors: ReturnType<typeof useTheme>['colors']
}) {
  return (
    <View style={styles.benefitItem}>
      <View style={[styles.benefitIcon, { backgroundColor: colors.bg.secondary }]}>
        {icon}
      </View>
      <Text style={[styles.benefitText, { color: colors.text.secondary }]}>
        {text}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  // Hero
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  heroIcon: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: fonts.serif.bold,
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  // Benefits
  benefitsCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: fonts.serif.semibold,
    marginBottom: 20,
  },
  benefitsList: {
    gap: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
  },
  // Pricing
  pricingSection: {
    marginBottom: 24,
  },
  priceCard: {
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
  },
  priceCardGradient: {
    padding: 24,
  },
  priceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  popularBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  priceAmount: {
    fontSize: 36,
    fontWeight: '700',
    fontFamily: fonts.serif.bold,
  },
  pricePeriod: {
    fontSize: 16,
    marginLeft: 4,
  },
  priceNote: {
    fontSize: 13,
  },
  // CTA
  ctaButton: {
    marginBottom: 16,
  },
  ctaGradient: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  ctaLoading: {
    opacity: 0.7,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Trial reminder
  trialReminder: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
  },
  // Footer
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  footerLink: {
    fontSize: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  footerDot: {
    fontSize: 14,
  },
  legalText: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
})
