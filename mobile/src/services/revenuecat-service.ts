/**
 * RevenueCat Service - In-App Purchases & Subscriptions
 *
 * Handles all subscription and purchase logic using RevenueCat SDK:
 * - Initialize RevenueCat with API key
 * - Fetch available packages/products
 * - Purchase subscriptions
 * - Restore purchases
 * - Check entitlements
 * - Handle subscription status changes
 *
 * Subscription Plans:
 * - Monthly: 9.99€/month
 * - Yearly: 59.99€/year (50% savings)
 * - Lifetime: 149.99€ one-time
 *
 * All plans include 7-day free trial
 */

import Purchases, {
  PurchasesPackage,
  CustomerInfo,
  PurchasesOffering,
  LOG_LEVEL,
} from 'react-native-purchases'
import { Platform } from 'react-native'
import { analytics } from './analytics-service'

// ============================================================================
// CONFIGURATION
// ============================================================================

const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ||
  process.env.REVENUE_CAT_API_KEY || ''

// Entitlement identifier from RevenueCat dashboard
const PREMIUM_ENTITLEMENT = 'premium'

// Product identifiers (must match App Store Connect / Google Play Console)
export const PRODUCT_IDS = {
  MONTHLY: 'lym_premium_monthly',
  YEARLY: 'lym_premium_yearly',
  LIFETIME: 'lym_premium_lifetime',
} as const

export type ProductId = typeof PRODUCT_IDS[keyof typeof PRODUCT_IDS]

// ============================================================================
// TYPES
// ============================================================================

export interface SubscriptionPlan {
  id: ProductId
  title: string
  description: string
  price: string
  pricePerMonth?: string
  currency: string
  period: 'monthly' | 'yearly' | 'lifetime'
  savings?: string
  trialDuration?: string
  popular?: boolean
  package?: PurchasesPackage
}

export interface SubscriptionStatus {
  isActive: boolean
  isPremium: boolean
  plan: ProductId | null
  expirationDate: string | null
  willRenew: boolean
  isInTrial: boolean
  isInGracePeriod: boolean
}

export interface PurchaseResult {
  success: boolean
  customerInfo?: CustomerInfo
  error?: string
  cancelled?: boolean
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

class RevenueCatService {
  private initialized = false
  private customerInfo: CustomerInfo | null = null

  /**
   * Initialize RevenueCat SDK
   * Should be called once at app startup
   */
  async initialize(userId?: string): Promise<void> {
    if (this.initialized) {
      console.log('[RevenueCat] Already initialized')
      return
    }

    if (!REVENUECAT_API_KEY) {
      console.warn('[RevenueCat] No API key configured, purchases disabled')
      return
    }

    try {
      // Set log level (DEBUG for development, ERROR for production)
      Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR)

      // Configure with API key
      await Purchases.configure({
        apiKey: REVENUECAT_API_KEY,
        appUserID: userId || undefined,
      })

      // Get initial customer info
      this.customerInfo = await Purchases.getCustomerInfo()
      this.initialized = true

      // Sync user properties with Amplitude
      this.syncAnalyticsUserProperties()

      // Set up listener for subscription changes
      this.setupCustomerInfoListener()

      console.log('[RevenueCat] Initialized successfully')
      console.log('[RevenueCat] User ID:', await Purchases.getAppUserID())
      console.log('[RevenueCat] Is Premium:', this.isPremium())
    } catch (error) {
      console.error('[RevenueCat] Initialization failed:', error)
      throw error
    }
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Login user to RevenueCat (for restoring purchases across devices)
   */
  async login(userId: string): Promise<CustomerInfo> {
    if (!this.initialized) {
      await this.initialize(userId)
    }

    try {
      const { customerInfo } = await Purchases.logIn(userId)
      this.customerInfo = customerInfo
      console.log('[RevenueCat] User logged in:', userId)
      return customerInfo
    } catch (error) {
      console.error('[RevenueCat] Login failed:', error)
      throw error
    }
  }

  /**
   * Logout user from RevenueCat
   */
  async logout(): Promise<CustomerInfo> {
    try {
      const customerInfo = await Purchases.logOut()
      this.customerInfo = customerInfo
      console.log('[RevenueCat] User logged out')
      return customerInfo
    } catch (error) {
      console.error('[RevenueCat] Logout failed:', error)
      throw error
    }
  }

  /**
   * Get available offerings/packages
   */
  async getOfferings(): Promise<PurchasesOffering | null> {
    if (!this.initialized) {
      console.warn('[RevenueCat] Not initialized')
      return null
    }

    try {
      const offerings = await Purchases.getOfferings()

      if (!offerings.current) {
        console.warn('[RevenueCat] No current offering available')
        return null
      }

      console.log('[RevenueCat] Offerings fetched:', offerings.current.identifier)
      return offerings.current
    } catch (error) {
      console.error('[RevenueCat] Failed to fetch offerings:', error)
      return null
    }
  }

  /**
   * Get subscription plans formatted for UI
   */
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    const offering = await this.getOfferings()

    if (!offering || !offering.availablePackages) {
      // Return fallback plans when RevenueCat not available
      return this.getFallbackPlans()
    }

    const plans: SubscriptionPlan[] = []

    for (const pkg of offering.availablePackages) {
      const product = pkg.product

      let period: 'monthly' | 'yearly' | 'lifetime' = 'monthly'
      let savings: string | undefined
      let pricePerMonth: string | undefined
      let popular = false

      // Determine plan type based on identifier or duration
      if (product.identifier.includes('yearly') || pkg.packageType === 'ANNUAL') {
        period = 'yearly'
        popular = true
        // Calculate monthly equivalent
        const yearlyPrice = product.price
        const monthlyEquiv = yearlyPrice / 12
        pricePerMonth = `${monthlyEquiv.toFixed(2)}${product.currencyCode === 'EUR' ? '€' : '$'}`
        savings = '50%'
      } else if (product.identifier.includes('lifetime')) {
        period = 'lifetime'
      }

      plans.push({
        id: product.identifier as ProductId,
        title: product.title,
        description: product.description,
        price: product.priceString,
        pricePerMonth,
        currency: product.currencyCode,
        period,
        savings,
        trialDuration: pkg.product.introPrice?.periodNumberOfUnits
          ? `${pkg.product.introPrice.periodNumberOfUnits} jours gratuits`
          : '7 jours gratuits',
        popular,
        package: pkg,
      })
    }

    // Sort: yearly first (popular), then monthly, then lifetime
    plans.sort((a, b) => {
      if (a.popular && !b.popular) return -1
      if (!a.popular && b.popular) return 1
      const order = { yearly: 0, monthly: 1, lifetime: 2 }
      return order[a.period] - order[b.period]
    })

    return plans
  }

  /**
   * Fallback plans when RevenueCat is not available
   */
  private getFallbackPlans(): SubscriptionPlan[] {
    return [
      {
        id: PRODUCT_IDS.YEARLY,
        title: 'LYM Premium Annuel',
        description: 'Accès complet pendant 1 an',
        price: '59,99 €',
        pricePerMonth: '4,99 €',
        currency: 'EUR',
        period: 'yearly',
        savings: '50%',
        trialDuration: '7 jours gratuits',
        popular: true,
      },
      {
        id: PRODUCT_IDS.MONTHLY,
        title: 'LYM Premium Mensuel',
        description: 'Accès complet renouvelé chaque mois',
        price: '9,99 €',
        currency: 'EUR',
        period: 'monthly',
        trialDuration: '7 jours gratuits',
      },
      {
        id: PRODUCT_IDS.LIFETIME,
        title: 'LYM Premium À Vie',
        description: 'Accès complet pour toujours',
        price: '149,99 €',
        currency: 'EUR',
        period: 'lifetime',
      },
    ]
  }

  /**
   * Purchase a subscription package
   */
  async purchase(plan: SubscriptionPlan): Promise<PurchaseResult> {
    if (!this.initialized) {
      return { success: false, error: 'RevenueCat not initialized' }
    }

    if (!plan.package) {
      return { success: false, error: 'Invalid package' }
    }

    try {
      // Track payment initiated
      analytics.trackPayment('initiated', Platform.OS === 'ios' ? 'apple_pay' : 'google_pay')

      const { customerInfo } = await Purchases.purchasePackage(plan.package)
      this.customerInfo = customerInfo

      // Check if purchase was successful
      const isPremium = customerInfo.entitlements.active[PREMIUM_ENTITLEMENT] !== undefined

      if (isPremium) {
        const priceValue = parseFloat(plan.price.replace(/[^0-9.,]/g, '').replace(',', '.'))

        // Track successful payment
        analytics.trackPayment('completed', Platform.OS === 'ios' ? 'apple_pay' : 'google_pay', priceValue, {
          product_id: plan.id,
          store: Platform.OS === 'ios' ? 'app_store' : 'play_store',
        })

        // Track revenue for MRR/LTV calculations
        analytics.trackRevenue(
          priceValue,
          plan.id,
          plan.period as 'monthly' | 'yearly' | 'lifetime',
          plan.currency
        )

        // Track subscription activation (listener will also fire but this is immediate)
        analytics.trackSubscription(
          'activated',
          plan.period as 'monthly' | 'yearly',
          priceValue,
          {
            product_id: plan.id,
            store: Platform.OS === 'ios' ? 'app_store' : 'play_store',
          }
        )

        console.log('[RevenueCat] Purchase successful')
        return { success: true, customerInfo }
      }

      return { success: false, error: 'Purchase completed but entitlement not active' }
    } catch (error: any) {
      // Handle user cancellation
      if (error.userCancelled) {
        console.log('[RevenueCat] Purchase cancelled by user')
        return { success: false, cancelled: true }
      }

      // Track failed payment
      analytics.trackPayment('failed', Platform.OS === 'ios' ? 'apple_pay' : 'google_pay')

      console.error('[RevenueCat] Purchase failed:', error)
      return {
        success: false,
        error: this.getErrorMessage(error),
      }
    }
  }

  /**
   * Restore previous purchases
   */
  async restorePurchases(): Promise<PurchaseResult> {
    if (!this.initialized) {
      return { success: false, error: 'RevenueCat not initialized' }
    }

    try {
      const customerInfo = await Purchases.restorePurchases()
      this.customerInfo = customerInfo

      const isPremium = customerInfo.entitlements.active[PREMIUM_ENTITLEMENT] !== undefined

      if (isPremium) {
        console.log('[RevenueCat] Purchases restored successfully')
        return { success: true, customerInfo }
      }

      return { success: false, error: 'Aucun achat à restaurer' }
    } catch (error: any) {
      console.error('[RevenueCat] Restore failed:', error)
      return {
        success: false,
        error: this.getErrorMessage(error),
      }
    }
  }

  /**
   * Get current subscription status
   */
  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    if (!this.initialized || !this.customerInfo) {
      return {
        isActive: false,
        isPremium: false,
        plan: null,
        expirationDate: null,
        willRenew: false,
        isInTrial: false,
        isInGracePeriod: false,
      }
    }

    try {
      // Refresh customer info
      this.customerInfo = await Purchases.getCustomerInfo()

      const entitlement = this.customerInfo.entitlements.active[PREMIUM_ENTITLEMENT]

      if (!entitlement) {
        return {
          isActive: false,
          isPremium: false,
          plan: null,
          expirationDate: null,
          willRenew: false,
          isInTrial: false,
          isInGracePeriod: false,
        }
      }

      return {
        isActive: true,
        isPremium: true,
        plan: entitlement.productIdentifier as ProductId,
        expirationDate: entitlement.expirationDate,
        willRenew: entitlement.willRenew,
        isInTrial: entitlement.periodType === 'TRIAL',
        isInGracePeriod: entitlement.billingIssueDetectedAt !== null,
      }
    } catch (error) {
      console.error('[RevenueCat] Failed to get subscription status:', error)
      return {
        isActive: false,
        isPremium: false,
        plan: null,
        expirationDate: null,
        willRenew: false,
        isInTrial: false,
        isInGracePeriod: false,
      }
    }
  }

  /**
   * Check if user has premium entitlement
   */
  isPremium(): boolean {
    if (!this.customerInfo) return false
    return this.customerInfo.entitlements.active[PREMIUM_ENTITLEMENT] !== undefined
  }

  /**
   * Check if user is in trial period
   */
  isInTrial(): boolean {
    if (!this.customerInfo) return false
    const entitlement = this.customerInfo.entitlements.active[PREMIUM_ENTITLEMENT]
    return entitlement?.periodType === 'TRIAL'
  }

  /**
   * Get customer info
   */
  async getCustomerInfo(): Promise<CustomerInfo | null> {
    if (!this.initialized) return null

    try {
      this.customerInfo = await Purchases.getCustomerInfo()
      return this.customerInfo
    } catch (error) {
      console.error('[RevenueCat] Failed to get customer info:', error)
      return null
    }
  }

  /**
   * Set customer attributes for analytics
   */
  async setAttributes(attributes: Record<string, string>): Promise<void> {
    if (!this.initialized) return

    try {
      await Purchases.setAttributes(attributes)
    } catch (error) {
      console.error('[RevenueCat] Failed to set attributes:', error)
    }
  }

  /**
   * Set email for customer
   */
  async setEmail(email: string): Promise<void> {
    if (!this.initialized) return

    try {
      await Purchases.setEmail(email)
    } catch (error) {
      console.error('[RevenueCat] Failed to set email:', error)
    }
  }

  /**
   * Add listener for customer info changes
   */
  addCustomerInfoListener(
    listener: (customerInfo: CustomerInfo) => void
  ): () => void {
    Purchases.addCustomerInfoUpdateListener(listener)
    // RevenueCat SDK doesn't return a subscription object
    // Return empty cleanup function
    return () => {}
  }

  /**
   * Sync RevenueCat customer info with Amplitude user properties
   */
  private syncAnalyticsUserProperties(): void {
    if (!this.customerInfo) return

    const entitlement = this.customerInfo.entitlements.active[PREMIUM_ENTITLEMENT]

    analytics.setRevenueUserProperties({
      isPremium: !!entitlement,
      plan: entitlement?.productIdentifier,
      isInTrial: entitlement?.periodType === 'TRIAL',
      willRenew: entitlement?.willRenew,
      expirationDate: entitlement?.expirationDate || undefined,
    })
  }

  /**
   * Set up listener for customer info changes (subscription events)
   */
  private setupCustomerInfoListener(): void {
    Purchases.addCustomerInfoUpdateListener((customerInfo) => {
      const previousInfo = this.customerInfo
      this.customerInfo = customerInfo

      // Detect subscription changes and track events
      this.detectAndTrackSubscriptionChanges(previousInfo, customerInfo)

      // Sync user properties
      this.syncAnalyticsUserProperties()
    })
  }

  /**
   * Detect subscription changes and track appropriate events
   */
  private detectAndTrackSubscriptionChanges(
    previous: CustomerInfo | null,
    current: CustomerInfo
  ): void {
    const prevEntitlement = previous?.entitlements.active[PREMIUM_ENTITLEMENT]
    const currentEntitlement = current.entitlements.active[PREMIUM_ENTITLEMENT]

    // New subscription or trial started
    if (!prevEntitlement && currentEntitlement) {
      const plan = this.getPlanFromProductId(currentEntitlement.productIdentifier)

      if (currentEntitlement.periodType === 'TRIAL') {
        // Trial started
        analytics.trackTrial('started', plan)
        console.log('[RevenueCat] Trial started:', currentEntitlement.productIdentifier)
      } else {
        // Direct subscription (no trial)
        analytics.trackSubscription('activated', plan)
        console.log('[RevenueCat] Subscription activated:', currentEntitlement.productIdentifier)
      }
    }

    // Trial converted to paid
    if (prevEntitlement?.periodType === 'TRIAL' && currentEntitlement?.periodType !== 'TRIAL') {
      const plan = this.getPlanFromProductId(currentEntitlement?.productIdentifier || '')
      analytics.trackTrial('converted', plan)
      console.log('[RevenueCat] Trial converted to paid')
    }

    // Subscription renewed
    if (prevEntitlement && currentEntitlement &&
        prevEntitlement.expirationDate !== currentEntitlement.expirationDate &&
        currentEntitlement.willRenew) {
      const plan = this.getPlanFromProductId(currentEntitlement.productIdentifier)
      analytics.trackSubscription('renewed', plan)
      console.log('[RevenueCat] Subscription renewed')
    }

    // Subscription cancelled (will not renew)
    if (prevEntitlement?.willRenew && !currentEntitlement?.willRenew) {
      const plan = this.getPlanFromProductId(currentEntitlement?.productIdentifier || '')
      analytics.trackSubscription('cancelled', plan)
      console.log('[RevenueCat] Subscription cancelled')
    }

    // Subscription expired
    if (prevEntitlement && !currentEntitlement) {
      const plan = this.getPlanFromProductId(prevEntitlement.productIdentifier)

      if (prevEntitlement.periodType === 'TRIAL') {
        analytics.trackTrial('expired', plan)
        console.log('[RevenueCat] Trial expired')
      } else {
        analytics.trackSubscription('expired', plan)
        console.log('[RevenueCat] Subscription expired')
      }
    }

    // Billing issue detected
    if (!prevEntitlement?.billingIssueDetectedAt && currentEntitlement?.billingIssueDetectedAt) {
      const plan = this.getPlanFromProductId(currentEntitlement.productIdentifier)
      analytics.trackBillingIssue('detected', plan)
      console.log('[RevenueCat] Billing issue detected')
    }

    // Billing issue resolved
    if (prevEntitlement?.billingIssueDetectedAt && !currentEntitlement?.billingIssueDetectedAt) {
      const plan = this.getPlanFromProductId(currentEntitlement?.productIdentifier || '')
      analytics.trackBillingIssue('resolved', plan)
      console.log('[RevenueCat] Billing issue resolved')
    }
  }

  /**
   * Get plan type from product identifier
   */
  private getPlanFromProductId(productId: string): 'monthly' | 'yearly' | 'lifetime' {
    if (productId.includes('yearly') || productId.includes('annual')) return 'yearly'
    if (productId.includes('lifetime')) return 'lifetime'
    return 'monthly'
  }

  /**
   * Get human-readable error message
   */
  private getErrorMessage(error: any): string {
    if (error.code) {
      switch (error.code) {
        case 0: // UNKNOWN_ERROR
          return 'Une erreur inconnue est survenue'
        case 1: // PURCHASE_CANCELLED
          return 'Achat annulé'
        case 2: // STORE_PROBLEM
          return 'Problème avec le store. Réessayez plus tard.'
        case 3: // PURCHASE_NOT_ALLOWED
          return 'Achat non autorisé sur cet appareil'
        case 4: // PURCHASE_INVALID
          return 'Achat invalide'
        case 5: // PRODUCT_NOT_AVAILABLE
          return 'Produit non disponible'
        case 6: // PRODUCT_ALREADY_PURCHASED
          return 'Vous avez déjà acheté ce produit'
        case 7: // RECEIPT_ALREADY_IN_USE
          return 'Ce reçu est déjà utilisé par un autre compte'
        case 8: // INVALID_RECEIPT
          return 'Reçu invalide'
        case 9: // MISSING_RECEIPT_FILE
          return 'Fichier de reçu manquant'
        case 10: // NETWORK_ERROR
          return 'Erreur réseau. Vérifiez votre connexion.'
        case 11: // INVALID_CREDENTIALS
          return 'Identifiants invalides'
        case 12: // UNEXPECTED_BACKEND_RESPONSE
          return 'Réponse inattendue du serveur'
        case 13: // RECEIPT_IN_USE_BY_OTHER_SUBSCRIBER
          return 'Ce reçu est utilisé par un autre abonné'
        case 14: // INVALID_APP_USER_ID
          return 'ID utilisateur invalide'
        case 15: // OPERATION_ALREADY_IN_PROGRESS
          return 'Opération déjà en cours'
        case 16: // UNKNOWN_BACKEND_ERROR
          return 'Erreur serveur inconnue'
        default:
          return error.message || 'Une erreur est survenue'
      }
    }

    return error.message || 'Une erreur est survenue'
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const revenueCatService = new RevenueCatService()
export default revenueCatService
