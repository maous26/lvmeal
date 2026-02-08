import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ConsentState {
  // Consent flags
  hasAcceptedTerms: boolean
  nutritionTracking: boolean
  healthDataCollection: boolean
  aiAnalysis: boolean
  analyticsTracking: boolean
  
  // Timestamps
  consentDate: string | null
  lastUpdated: string | null
  
  // Actions
  acceptAll: () => void
  acceptRequired: () => void
  updateConsent: (updates: Partial<Pick<ConsentState, 'nutritionTracking' | 'healthDataCollection' | 'aiAnalysis' | 'analyticsTracking'>>) => void
  revokeAll: () => void
  hasGivenConsent: () => boolean
}

export const useConsentStore = create<ConsentState>()(
  persist(
    (set, get) => ({
      hasAcceptedTerms: false,
      nutritionTracking: false,
      healthDataCollection: false,
      aiAnalysis: false,
      analyticsTracking: false,
      consentDate: null,
      lastUpdated: null,

      acceptAll: () => {
        const now = new Date().toISOString()
        set({
          hasAcceptedTerms: true,
          nutritionTracking: true,
          healthDataCollection: true,
          aiAnalysis: true,
          analyticsTracking: true,
          consentDate: now,
          lastUpdated: now,
        })
      },

      acceptRequired: () => {
        const now = new Date().toISOString()
        set({
          hasAcceptedTerms: true,
          nutritionTracking: true,
          healthDataCollection: false,
          aiAnalysis: false,
          analyticsTracking: false,
          consentDate: now,
          lastUpdated: now,
        })
      },

      updateConsent: (updates) => {
        set({
          ...updates,
          lastUpdated: new Date().toISOString(),
        })
      },

      revokeAll: () => {
        set({
          hasAcceptedTerms: false,
          nutritionTracking: false,
          healthDataCollection: false,
          aiAnalysis: false,
          analyticsTracking: false,
          consentDate: null,
          lastUpdated: new Date().toISOString(),
        })
      },

      hasGivenConsent: () => {
        return get().hasAcceptedTerms
      },
    }),
    {
      name: 'presence-consent',
      partialize: (state) => ({
        hasAcceptedTerms: state.hasAcceptedTerms,
        nutritionTracking: state.nutritionTracking,
        healthDataCollection: state.healthDataCollection,
        aiAnalysis: state.aiAnalysis,
        analyticsTracking: state.analyticsTracking,
        consentDate: state.consentDate,
        lastUpdated: state.lastUpdated,
      }),
    }
  )
)
