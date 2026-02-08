'use client'

import * as React from 'react'
import { Download, Trash2, Shield, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useConsentStore } from '@/stores/consent-store'
import { useUserStore } from '@/stores/user-store'
import { useMealsStore } from '@/stores/meals-store'
import { useWellnessStore } from '@/stores/wellness-store'
import { useGamificationStore } from '@/stores/gamification-store'

export function DataManagement() {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false)
  const [isExporting, setIsExporting] = React.useState(false)

  const consent = useConsentStore()
  const userStore = useUserStore()
  const mealsStore = useMealsStore()
  const wellnessStore = useWellnessStore()
  const gamificationStore = useGamificationStore()

  const handleExportData = async () => {
    setIsExporting(true)
    try {
      const exportData = {
        exportDate: new Date().toISOString(),
        profile: userStore.profile,
        weightHistory: userStore.weightHistory,
        meals: mealsStore.meals,
        hydration: mealsStore.hydration,
        favoriteFoods: mealsStore.favoriteFoods,
        wellness: wellnessStore.entries,
        wellnessTargets: wellnessStore.targets,
        gamification: {
          totalXP: gamificationStore.totalXP,
          currentLevel: gamificationStore.currentLevel,
          earnedBadges: gamificationStore.earnedBadges,
        },
        consent: {
          consentDate: consent.consentDate,
          nutritionTracking: consent.nutritionTracking,
          healthDataCollection: consent.healthDataCollection,
          aiAnalysis: consent.aiAnalysis,
          analyticsTracking: consent.analyticsTracking,
        },
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `presence-data-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setIsExporting(false)
    }
  }

  const handleDeleteAllData = () => {
    // Clear all stores
    userStore.clearProfile()
    consent.revokeAll()

    // Clear all localStorage keys
    const keys = [
      'userProfile', 'presence-user', 'presence-meals', 'presence-caloric-bank',
      'presence-gamification', 'presence-wellness', 'presence-sport',
      'presence-devices', 'presence-recipes', 'presence-ui', 'presence-consent',
    ]
    keys.forEach(key => localStorage.removeItem(key))

    // Reload page to reset all state
    window.location.href = '/onboarding'
  }

  return (
    <div className="space-y-4">
      {/* Consent status */}
      <Card padding="default">
        <div className="flex items-center gap-3 mb-3">
          <Shield className="h-5 w-5 text-[var(--accent-primary)]" />
          <h3 className="font-semibold text-[var(--text-primary)]">Consentements</h3>
        </div>
        <div className="space-y-2">
          {[
            { label: 'Suivi nutritionnel', value: consent.nutritionTracking, required: true },
            { label: 'Données de santé', value: consent.healthDataCollection },
            { label: 'Analyse IA', value: consent.aiAnalysis },
            { label: 'Analytics', value: consent.analyticsTracking },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between py-1">
              <span className="text-sm text-[var(--text-secondary)]">{item.label}</span>
              <Badge variant={item.value ? 'default' : 'outline'} size="sm">
                {item.value ? 'Activé' : 'Désactivé'}
              </Badge>
            </div>
          ))}
        </div>
        {consent.consentDate && (
          <p className="text-xs text-[var(--text-tertiary)] mt-2">
            Consentement donné le {new Date(consent.consentDate).toLocaleDateString('fr-FR')}
          </p>
        )}
      </Card>

      {/* Export data */}
      <Card padding="default">
        <h3 className="font-semibold text-[var(--text-primary)] mb-2">Exporter mes données</h3>
        <p className="text-xs text-[var(--text-secondary)] mb-3">
          Télécharge toutes tes données au format JSON (profil, repas, bien-être, badges).
        </p>
        <Button
          variant="outline"
          className="w-full"
          onClick={handleExportData}
          disabled={isExporting}
        >
          <Download className="h-4 w-4 mr-2" />
          {isExporting ? 'Exportation...' : 'Télécharger mes données'}
        </Button>
      </Card>

      {/* Delete data */}
      <Card padding="default" className="border-[var(--error)]/20">
        <h3 className="font-semibold text-[var(--error)] mb-2">Supprimer mon compte</h3>
        <p className="text-xs text-[var(--text-secondary)] mb-3">
          Supprime définitivement toutes tes données. Cette action est irréversible.
        </p>
        {!showDeleteConfirm ? (
          <Button
            variant="outline"
            className="w-full text-[var(--error)] border-[var(--error)]/30 hover:bg-[var(--error)]/10"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer toutes mes données
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--error)]/10">
              <AlertTriangle className="h-5 w-5 text-[var(--error)] flex-shrink-0" />
              <p className="text-xs text-[var(--error)]">
                Toutes tes données seront supprimées définitivement. Es-tu sûr(e) ?
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Annuler
              </Button>
              <Button
                variant="default"
                className="flex-1 bg-[var(--error)] hover:bg-[var(--error)]/90"
                onClick={handleDeleteAllData}
              >
                Confirmer la suppression
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
