'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Scale,
  Plus,
  TrendingDown,
  TrendingUp,
  Minus,
  Target,
  Calendar,
  Smartphone,
  Watch,
  Bluetooth,
  ChevronRight,
  X,
  Check,
  Info,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageContainer, Section } from '@/components/layout/page-container'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useUserStore } from '@/stores/user-store'
import { formatNumber } from '@/lib/utils'
import type { WeightEntry, ConnectedDevice } from '@/types'

// Mock connected devices
const availableDevices: { id: string; type: ConnectedDevice['type']; name: string; icon: React.ElementType }[] = [
  { id: 'apple_health', type: 'apple_health', name: 'Apple Health', icon: Smartphone },
  { id: 'google_fit', type: 'google_fit', name: 'Google Fit', icon: Smartphone },
  { id: 'withings', type: 'withings', name: 'Withings', icon: Scale },
  { id: 'fitbit', type: 'fitbit', name: 'Fitbit', icon: Watch },
  { id: 'garmin', type: 'garmin', name: 'Garmin', icon: Watch },
]

export default function WeightPage() {
  const router = useRouter()
  const [mounted, setMounted] = React.useState(false)
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [showDevicesModal, setShowDevicesModal] = React.useState(false)
  const [newWeight, setNewWeight] = React.useState('')
  const [connectedDevices, setConnectedDevices] = React.useState<string[]>([])

  const { profile, weightHistory, addWeightEntry } = useUserStore()

  React.useEffect(() => {
    setMounted(true)
    // Load profile from localStorage if not in store
    if (!profile) {
      const storedProfile = localStorage.getItem('userProfile')
      if (storedProfile) {
        useUserStore.getState().setProfile(JSON.parse(storedProfile))
      }
    }
  }, [profile])

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="animate-pulse text-[var(--text-tertiary)]">Chargement...</div>
      </div>
    )
  }

  const currentWeight = profile?.weight || weightHistory[weightHistory.length - 1]?.weight || 0
  const targetWeight = profile?.targetWeight || 0
  const startWeight = weightHistory[0]?.weight || currentWeight

  // Calculate trend
  const recentEntries = weightHistory.slice(-7)
  const trend = recentEntries.length >= 2
    ? recentEntries[recentEntries.length - 1].weight - recentEntries[0].weight
    : 0

  const progress = startWeight && targetWeight
    ? Math.abs(((startWeight - currentWeight) / (startWeight - targetWeight)) * 100)
    : 0

  const remaining = Math.abs(currentWeight - targetWeight)
  const isLosingWeight = targetWeight < startWeight

  // Generate chart data (last 30 days)
  const generateChartData = () => {
    const today = new Date()
    const data: { date: string; weight: number | null; label: string }[] = []

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      const entry = weightHistory.find(e => e.date === dateStr)

      data.push({
        date: dateStr,
        weight: entry?.weight || null,
        label: date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      })
    }

    return data
  }

  const chartData = generateChartData()
  const minWeight = Math.min(...chartData.filter(d => d.weight).map(d => d.weight!), targetWeight || Infinity) - 2
  const maxWeight = Math.max(...chartData.filter(d => d.weight).map(d => d.weight!), startWeight || 0) + 2

  const handleAddWeight = () => {
    const weight = parseFloat(newWeight)
    if (isNaN(weight) || weight <= 0) return

    const entry: WeightEntry = {
      id: `${Date.now()}`,
      weight,
      date: new Date().toISOString().split('T')[0],
      source: 'manual',
    }

    addWeightEntry(entry)
    setNewWeight('')
    setShowAddModal(false)
  }

  const toggleDevice = (deviceId: string) => {
    setConnectedDevices(prev =>
      prev.includes(deviceId)
        ? prev.filter(id => id !== deviceId)
        : [...prev, deviceId]
    )
  }

  return (
    <>
      <Header
        title="Suivi du poids"
        showBack
        onBack={() => router.back()}
      />

      <PageContainer className="pt-4">
        {/* Current weight card */}
        <Section>
          <Card padding="lg" variant="gradient" className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-primary)]/5 to-[var(--info)]/5" />

            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--text-tertiary)] mb-1">Poids actuel</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-[var(--text-primary)] tabular-nums">
                    {currentWeight || '--'}
                  </span>
                  <span className="text-lg text-[var(--text-secondary)]">kg</span>
                </div>

                {trend !== 0 && (
                  <div className={`flex items-center gap-1 mt-2 ${
                    (isLosingWeight && trend < 0) || (!isLosingWeight && trend > 0)
                      ? 'text-[var(--success)]'
                      : 'text-[var(--warning)]'
                  }`}>
                    {trend < 0 ? (
                      <TrendingDown className="h-4 w-4" />
                    ) : (
                      <TrendingUp className="h-4 w-4" />
                    )}
                    <span className="text-sm font-medium">
                      {trend > 0 ? '+' : ''}{trend.toFixed(1)} kg cette semaine
                    </span>
                  </div>
                )}
              </div>

              <motion.div
                className="p-4 rounded-2xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--info)]"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Scale className="h-8 w-8 text-white" />
              </motion.div>
            </div>

            {/* Progress bar */}
            {targetWeight > 0 && (
              <div className="relative mt-6">
                <div className="flex justify-between text-xs text-[var(--text-tertiary)] mb-2">
                  <span>Départ: {startWeight} kg</span>
                  <span>Objectif: {targetWeight} kg</span>
                </div>
                <div className="h-3 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--success)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(progress, 100)}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm font-medium text-[var(--text-secondary)]">
                    {Math.round(progress)}% accompli
                  </span>
                  <Badge variant={remaining <= 1 ? 'success' : 'default'}>
                    {remaining.toFixed(1)} kg restants
                  </Badge>
                </div>
              </div>
            )}
          </Card>
        </Section>

        {/* Quick actions */}
        <Section>
          <div className="flex gap-3">
            <Button
              variant="default"
              size="lg"
              className="flex-1 h-14"
              onClick={() => setShowAddModal(true)}
            >
              <Plus className="h-5 w-5 mr-2" />
              Ajouter une pesée
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-14 px-4"
              onClick={() => setShowDevicesModal(true)}
            >
              <Bluetooth className="h-5 w-5" />
            </Button>
          </div>
        </Section>

        {/* Weight chart */}
        <Section>
          <Card padding="default">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-5 w-5 text-[var(--accent-primary)]" />
                Évolution (30 jours)
              </CardTitle>
            </CardHeader>

            {/* Simple chart */}
            <div className="relative h-48 mt-4">
              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 bottom-8 w-10 flex flex-col justify-between text-xs text-[var(--text-tertiary)]">
                <span>{maxWeight.toFixed(0)}</span>
                <span>{((maxWeight + minWeight) / 2).toFixed(0)}</span>
                <span>{minWeight.toFixed(0)}</span>
              </div>

              {/* Chart area */}
              <div className="ml-12 h-40 relative">
                {/* Target line */}
                {targetWeight > 0 && targetWeight >= minWeight && targetWeight <= maxWeight && (
                  <div
                    className="absolute left-0 right-0 border-t-2 border-dashed border-[var(--success)]/50"
                    style={{
                      bottom: `${((targetWeight - minWeight) / (maxWeight - minWeight)) * 100}%`,
                    }}
                  >
                    <span className="absolute right-0 -top-4 text-xs text-[var(--success)] bg-[var(--bg-primary)] px-1">
                      Objectif
                    </span>
                  </div>
                )}

                {/* Bars */}
                <div className="absolute inset-0 flex items-end gap-px">
                  {chartData.map((point, index) => {
                    if (!point.weight) {
                      return (
                        <div key={index} className="flex-1 h-full flex items-end">
                          <div className="w-full h-1 bg-[var(--bg-tertiary)] rounded-t opacity-30" />
                        </div>
                      )
                    }

                    const height = ((point.weight - minWeight) / (maxWeight - minWeight)) * 100

                    return (
                      <motion.div
                        key={index}
                        className="flex-1 h-full flex items-end group relative"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.02 }}
                      >
                        <motion.div
                          className="w-full rounded-t bg-gradient-to-t from-[var(--accent-primary)] to-[var(--info)] cursor-pointer"
                          initial={{ height: 0 }}
                          animate={{ height: `${height}%` }}
                          transition={{ duration: 0.5, delay: index * 0.02 }}
                          whileHover={{ scale: 1.1 }}
                        />

                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg px-2 py-1 shadow-lg whitespace-nowrap">
                            <p className="text-xs font-medium text-[var(--text-primary)]">
                              {point.weight} kg
                            </p>
                            <p className="text-[10px] text-[var(--text-tertiary)]">
                              {point.label}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>

              {/* X-axis labels */}
              <div className="ml-12 flex justify-between mt-2 text-xs text-[var(--text-tertiary)]">
                <span>{chartData[0]?.label}</span>
                <span>{chartData[Math.floor(chartData.length / 2)]?.label}</span>
                <span>{chartData[chartData.length - 1]?.label}</span>
              </div>
            </div>

            {weightHistory.length === 0 && (
              <div className="text-center py-8">
                <Scale className="h-12 w-12 text-[var(--text-tertiary)] mx-auto mb-3 opacity-50" />
                <p className="text-sm text-[var(--text-secondary)]">
                  Aucune pesée enregistrée
                </p>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">
                  Ajoutez votre première pesée pour suivre votre progression
                </p>
              </div>
            )}
          </Card>
        </Section>

        {/* Connected devices */}
        <Section title="Appareils connectés">
          <Card padding="none">
            {connectedDevices.length === 0 ? (
              <div className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center mx-auto mb-3">
                  <Bluetooth className="h-6 w-6 text-[var(--text-tertiary)]" />
                </div>
                <p className="text-sm text-[var(--text-secondary)]">
                  Aucun appareil connecté
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setShowDevicesModal(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Connecter un appareil
                </Button>
              </div>
            ) : (
              connectedDevices.map(deviceId => {
                const device = availableDevices.find(d => d.id === deviceId)
                if (!device) return null
                const DeviceIcon = device.icon

                return (
                  <div
                    key={deviceId}
                    className="flex items-center gap-4 p-4 border-b border-[var(--border-light)] last:border-b-0"
                  >
                    <div className="p-2 rounded-lg bg-[var(--success)]/10">
                      <DeviceIcon className="h-5 w-5 text-[var(--success)]" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-[var(--text-primary)]">{device.name}</p>
                      <p className="text-xs text-[var(--text-tertiary)]">Synchronisé</p>
                    </div>
                    <Badge variant="success" size="sm">Connecté</Badge>
                  </div>
                )
              })
            )}
          </Card>
        </Section>

        {/* Recent entries */}
        {weightHistory.length > 0 && (
          <Section title="Historique récent">
            <Card padding="none">
              {weightHistory.slice(-5).reverse().map((entry, index) => {
                const prevEntry = weightHistory[weightHistory.length - 2 - index]
                const diff = prevEntry ? entry.weight - prevEntry.weight : 0

                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-4 p-4 border-b border-[var(--border-light)] last:border-b-0"
                  >
                    <div className="p-2 rounded-lg bg-[var(--bg-secondary)]">
                      <Scale className="h-4 w-4 text-[var(--text-secondary)]" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-[var(--text-primary)] tabular-nums">
                        {entry.weight} kg
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {new Date(entry.date).toLocaleDateString('fr-FR', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                        })}
                      </p>
                    </div>
                    {diff !== 0 && (
                      <span className={`text-sm font-medium ${
                        (isLosingWeight && diff < 0) || (!isLosingWeight && diff > 0)
                          ? 'text-[var(--success)]'
                          : 'text-[var(--warning)]'
                      }`}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(1)} kg
                      </span>
                    )}
                    <Badge variant="default" size="sm">
                      {entry.source === 'manual' ? 'Manuel' : entry.source}
                    </Badge>
                  </div>
                )
              })}
            </Card>
          </Section>
        )}

        <div className="h-8" />
      </PageContainer>

      {/* Add weight modal */}
      <AnimatePresence>
        {showAddModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setShowAddModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed bottom-0 left-0 right-0 bg-[var(--bg-primary)] rounded-t-3xl z-50 max-h-[80vh] overflow-auto"
            >
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-[var(--border-default)]" />
              </div>

              <div className="px-5 pb-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-[var(--text-primary)]">
                    Nouvelle pesée
                  </h3>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="p-2 hover:bg-[var(--bg-secondary)] rounded-full transition-colors"
                  >
                    <X className="h-5 w-5 text-[var(--text-tertiary)]" />
                  </button>
                </div>

                <div className="text-center mb-8">
                  <p className="text-sm text-[var(--text-tertiary)] mb-4">
                    Entrez votre poids actuel
                  </p>

                  <div className="flex items-center justify-center gap-4">
                    <button
                      onClick={() => setNewWeight(prev => {
                        const val = parseFloat(prev) || currentWeight
                        return (val - 0.1).toFixed(1)
                      })}
                      className="p-3 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                    >
                      <Minus className="h-5 w-5 text-[var(--text-primary)]" />
                    </button>

                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        value={newWeight}
                        onChange={(e) => setNewWeight(e.target.value)}
                        placeholder={currentWeight.toString()}
                        className="w-32 text-center text-4xl font-bold bg-transparent border-b-2 border-[var(--accent-primary)] text-[var(--text-primary)] focus:outline-none tabular-nums"
                      />
                      <span className="absolute right-0 top-1/2 -translate-y-1/2 text-xl text-[var(--text-secondary)] -mr-8">
                        kg
                      </span>
                    </div>

                    <button
                      onClick={() => setNewWeight(prev => {
                        const val = parseFloat(prev) || currentWeight
                        return (val + 0.1).toFixed(1)
                      })}
                      className="p-3 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                    >
                      <Plus className="h-5 w-5 text-[var(--text-primary)]" />
                    </button>
                  </div>
                </div>

                <Button
                  variant="default"
                  size="lg"
                  className="w-full"
                  onClick={handleAddWeight}
                  disabled={!newWeight || parseFloat(newWeight) <= 0}
                >
                  <Check className="h-5 w-5 mr-2" />
                  Enregistrer
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Devices modal */}
      <AnimatePresence>
        {showDevicesModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setShowDevicesModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed bottom-0 left-0 right-0 bg-[var(--bg-primary)] rounded-t-3xl z-50 max-h-[80vh] overflow-auto"
            >
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-[var(--border-default)]" />
              </div>

              <div className="px-5 pb-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--info)] flex items-center justify-center">
                      <Bluetooth className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">
                      Appareils
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowDevicesModal(false)}
                    className="p-2 hover:bg-[var(--bg-secondary)] rounded-full transition-colors"
                  >
                    <X className="h-5 w-5 text-[var(--text-tertiary)]" />
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-[var(--info)]/10 border border-[var(--info)]/20 mb-6">
                  <div className="flex items-start gap-2">
                    <Info className="h-5 w-5 text-[var(--info)] flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-[var(--text-secondary)]">
                      Connectez vos appareils pour synchroniser automatiquement votre poids et vos mesures.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {availableDevices.map(device => {
                    const DeviceIcon = device.icon
                    const isConnected = connectedDevices.includes(device.id)

                    return (
                      <motion.button
                        key={device.id}
                        onClick={() => toggleDevice(device.id)}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all ${
                          isConnected
                            ? 'bg-[var(--success)]/10 border border-[var(--success)]/30'
                            : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]'
                        }`}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className={`p-2 rounded-lg ${
                          isConnected
                            ? 'bg-[var(--success)]/20'
                            : 'bg-[var(--bg-tertiary)]'
                        }`}>
                          <DeviceIcon className={`h-5 w-5 ${
                            isConnected
                              ? 'text-[var(--success)]'
                              : 'text-[var(--text-secondary)]'
                          }`} />
                        </div>
                        <span className="flex-1 text-left font-medium text-[var(--text-primary)]">
                          {device.name}
                        </span>
                        {isConnected ? (
                          <Badge variant="success" size="sm">Connecté</Badge>
                        ) : (
                          <ChevronRight className="h-5 w-5 text-[var(--text-tertiary)]" />
                        )}
                      </motion.button>
                    )
                  })}
                </div>

                <Button
                  variant="default"
                  size="lg"
                  onClick={() => setShowDevicesModal(false)}
                  className="w-full mt-6"
                >
                  Terminé
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
