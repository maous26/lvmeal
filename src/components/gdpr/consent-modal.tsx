'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, ChevronDown, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useConsentStore } from '@/stores/consent-store'

interface ConsentToggleProps {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  required?: boolean
}

function ConsentToggle({ label, description, checked, onChange, required }: ConsentToggleProps) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="pt-0.5">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          disabled={required}
          onClick={() => !required && onChange(!checked)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            checked ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-tertiary)]'
          } ${required ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              checked ? 'translate-x-4.5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-[var(--text-primary)]">
          {label}
          {required && <span className="text-xs text-[var(--text-tertiary)] ml-1">(requis)</span>}
        </p>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{description}</p>
      </div>
    </div>
  )
}

export function ConsentModal() {
  const { hasGivenConsent, acceptAll, acceptRequired, updateConsent } = useConsentStore()
  const [showDetails, setShowDetails] = React.useState(false)
  const [localConsent, setLocalConsent] = React.useState({
    nutritionTracking: true,
    healthDataCollection: true,
    aiAnalysis: true,
    analyticsTracking: true,
  })

  if (hasGivenConsent()) return null

  const handleAcceptSelected = () => {
    acceptRequired()
    updateConsent(localConsent)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="w-full max-w-md"
        >
          <Card padding="lg" className="max-h-[85vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-[var(--accent-primary)]/10">
                <Shield className="h-6 w-6 text-[var(--accent-primary)]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Protection de tes données</h2>
                <p className="text-xs text-[var(--text-secondary)]">Conformité RGPD</p>
              </div>
            </div>

            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Presence utilise tes données pour personnaliser ton expérience nutritionnelle.
              Tu gardes le contrôle total sur ce que nous collectons.
            </p>

            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-2 text-sm text-[var(--accent-primary)] mb-4"
              aria-expanded={showDetails}
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
              {showDetails ? 'Masquer les détails' : 'Personnaliser mes choix'}
            </button>

            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mb-4"
                >
                  <div className="divide-y divide-[var(--border-light)]">
                    <ConsentToggle
                      label="Suivi nutritionnel"
                      description="Enregistrer tes repas, calories et macros pour suivre tes objectifs."
                      checked={localConsent.nutritionTracking}
                      onChange={() => {}}
                      required
                    />
                    <ConsentToggle
                      label="Données de santé"
                      description="Sommeil, stress, énergie et poids pour personnaliser les conseils."
                      checked={localConsent.healthDataCollection}
                      onChange={(v) => setLocalConsent(s => ({ ...s, healthDataCollection: v }))}
                    />
                    <ConsentToggle
                      label="Analyse IA"
                      description="Utiliser l'intelligence artificielle pour des recommandations personnalisées."
                      checked={localConsent.aiAnalysis}
                      onChange={(v) => setLocalConsent(s => ({ ...s, aiAnalysis: v }))}
                    />
                    <ConsentToggle
                      label="Analytics"
                      description="Données anonymisées pour améliorer l'application."
                      checked={localConsent.analyticsTracking}
                      onChange={(v) => setLocalConsent(s => ({ ...s, analyticsTracking: v }))}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <Button
                variant="default"
                className="w-full"
                onClick={acceptAll}
              >
                Tout accepter
              </Button>

              {showDetails && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleAcceptSelected}
                >
                  Accepter ma sélection
                </Button>
              )}

              <Button
                variant="ghost"
                className="w-full text-xs"
                onClick={acceptRequired}
              >
                Accepter le minimum requis
              </Button>
            </div>

            <div className="mt-4 flex justify-center">
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              >
                Politique de confidentialité <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
