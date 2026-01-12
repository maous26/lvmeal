/**
 * Feedback Store - Collecte les retours utilisateurs (phase test)
 *
 * Utilisé pour le faux paywall et autres collectes qualitatives
 * Les données sont stockées localement et peuvent être sync avec Supabase
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { addToSyncQueue } from '../services/cloud-sync-service'

// Types de feedback possibles
export type PaywallResponse = 'would_pay' | 'not_now' | 'need_more_time' | 'too_expensive'

export interface PaywallFeedback {
  id: string
  response: PaywallResponse
  reason?: string // Raison libre si "not_now"
  daysSinceSignup: number
  timestamp: string
}

export interface GeneralFeedback {
  id: string
  type: 'bug' | 'suggestion' | 'question' | 'other'
  message: string
  screen?: string
  timestamp: string
}

interface FeedbackState {
  // Paywall feedbacks
  paywallFeedbacks: PaywallFeedback[]
  hasRespondedToPaywall: boolean

  // General feedbacks
  generalFeedbacks: GeneralFeedback[]

  // Actions
  submitPaywallFeedback: (response: PaywallResponse, reason?: string, daysSinceSignup?: number) => void
  submitGeneralFeedback: (type: GeneralFeedback['type'], message: string, screen?: string) => void
  getPaywallFeedbacks: () => PaywallFeedback[]
  getGeneralFeedbacks: () => GeneralFeedback[]

  // Stats
  getPaywallStats: () => {
    total: number
    wouldPay: number
    notNow: number
    needMoreTime: number
    tooExpensive: number
  }
}

export const useFeedbackStore = create<FeedbackState>()(
  persist(
    (set, get) => ({
      paywallFeedbacks: [],
      hasRespondedToPaywall: false,
      generalFeedbacks: [],

      submitPaywallFeedback: (response, reason, daysSinceSignup = 7) => {
        const feedbackId = `paywall-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const timestamp = new Date().toISOString()

        const feedback: PaywallFeedback = {
          id: feedbackId,
          response,
          reason,
          daysSinceSignup,
          timestamp,
        }

        set((state) => ({
          paywallFeedbacks: [...state.paywallFeedbacks, feedback],
          hasRespondedToPaywall: true,
        }))

        // Sync to cloud for analytics
        addToSyncQueue({
          type: 'feedback',
          action: 'upsert',
          data: {
            id: feedbackId,
            feedback_type: 'paywall',
            response,
            reason,
            days_since_signup: daysSinceSignup,
            created_at: timestamp,
          },
        })

        console.log('[FeedbackStore] Paywall feedback submitted:', feedback)
      },

      submitGeneralFeedback: (type, message, screen) => {
        const feedbackId = `general-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const timestamp = new Date().toISOString()

        const feedback: GeneralFeedback = {
          id: feedbackId,
          type,
          message,
          screen,
          timestamp,
        }

        set((state) => ({
          generalFeedbacks: [...state.generalFeedbacks, feedback],
        }))

        // Sync to cloud
        addToSyncQueue({
          type: 'feedback',
          action: 'upsert',
          data: {
            id: feedbackId,
            feedback_type: 'general',
            response: type, // bug, suggestion, question, other
            message,
            screen,
            created_at: timestamp,
          },
        })

        console.log('[FeedbackStore] General feedback submitted:', feedback)
      },

      getPaywallFeedbacks: () => get().paywallFeedbacks,

      getGeneralFeedbacks: () => get().generalFeedbacks,

      getPaywallStats: () => {
        const feedbacks = get().paywallFeedbacks
        return {
          total: feedbacks.length,
          wouldPay: feedbacks.filter(f => f.response === 'would_pay').length,
          notNow: feedbacks.filter(f => f.response === 'not_now').length,
          needMoreTime: feedbacks.filter(f => f.response === 'need_more_time').length,
          tooExpensive: feedbacks.filter(f => f.response === 'too_expensive').length,
        }
      },
    }),
    {
      name: 'presence-feedback',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
