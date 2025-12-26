'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Watch, Smartphone, RefreshCw, Plus, Check, X, ChevronRight, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useDevicesStore, DEVICE_INFO, type DeviceType, type ConnectedDevice } from '@/stores/devices-store'
import { cn } from '@/lib/utils'

interface ConnectedDevicesProps {
  className?: string
}

// Available devices to connect
const AVAILABLE_DEVICES: { type: DeviceType; description: string }[] = [
  { type: 'apple_watch', description: 'Synchronise pas, sommeil, frequence cardiaque et exercices' },
  { type: 'fitbit', description: 'Synchronise activite, sommeil et donnees de sante' },
  { type: 'garmin', description: 'Synchronise entrainements, pas et metriques de performance' },
  { type: 'samsung_health', description: 'Synchronise donnees Samsung Galaxy Watch' },
  { type: 'google_fit', description: 'Synchronise donnees depuis Google Fit' },
]

export function ConnectedDevices({ className }: ConnectedDevicesProps) {
  const {
    devices,
    addDevice,
    removeDevice,
    syncDevice,
    syncAllDevices,
    getLastSyncData,
    isConnecting,
    syncInProgress,
    setConnecting,
  } = useDevicesStore()

  const [mounted, setMounted] = React.useState(false)
  const [showAddDevice, setShowAddDevice] = React.useState(false)
  const [connectingType, setConnectingType] = React.useState<DeviceType | null>(null)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className={cn('animate-pulse bg-[var(--bg-secondary)] h-24 rounded-xl', className)} />
    )
  }

  const hasDevices = devices.length > 0

  const handleConnectDevice = async (type: DeviceType) => {
    setConnectingType(type)
    setConnecting(true)

    // Simulate connection process (in real app, this would open OAuth flow or native connection)
    await new Promise((resolve) => setTimeout(resolve, 2500))

    const deviceInfo = DEVICE_INFO[type]
    addDevice({
      type,
      name: deviceInfo.name,
      status: 'connected',
      permissions: {
        steps: true,
        heartRate: true,
        sleep: true,
        workouts: true,
        calories: true,
      },
    })

    setConnecting(false)
    setConnectingType(null)
    setShowAddDevice(false)

    // Trigger initial sync
    const newDevice = useDevicesStore.getState().devices.find((d) => d.type === type)
    if (newDevice) {
      await syncDevice(newDevice.id)
    }
  }

  const handleRemoveDevice = (deviceId: string) => {
    removeDevice(deviceId)
  }

  const formatLastSync = (lastSync: string | null) => {
    if (!lastSync) return 'Jamais synchronise'
    const date = new Date(lastSync)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return "A l'instant"
    if (diffMins < 60) return `Il y a ${diffMins} min`
    if (diffMins < 1440) return `Il y a ${Math.floor(diffMins / 60)}h`
    return `Il y a ${Math.floor(diffMins / 1440)}j`
  }

  // Connected devices not yet added
  const availableToConnect = AVAILABLE_DEVICES.filter(
    (d) => !devices.some((connected) => connected.type === d.type)
  )

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Watch className="h-5 w-5 text-[var(--accent-primary)]" />
          <h3 className="font-semibold text-[var(--text-primary)]">Appareils connectes</h3>
        </div>
        {hasDevices && (
          <button
            onClick={() => syncAllDevices()}
            disabled={syncInProgress}
            className={cn(
              'flex items-center gap-1 text-xs text-[var(--accent-primary)] hover:opacity-80 transition-opacity',
              syncInProgress && 'opacity-50'
            )}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', syncInProgress && 'animate-spin')} />
            Sync
          </button>
        )}
      </div>

      {/* Connected devices list */}
      {hasDevices ? (
        <div className="space-y-2">
          {devices.map((device) => {
            const info = DEVICE_INFO[device.type]
            const syncData = getLastSyncData(device.id)

            return (
              <motion.div
                key={device.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card padding="default" className="relative">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                        style={{ backgroundColor: `${info.color}20` }}
                      >
                        {info.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-[var(--text-primary)]">{info.name}</p>
                          <Badge
                            variant={device.status === 'connected' ? 'success' : device.status === 'syncing' ? 'warning' : 'destructive'}
                            size="sm"
                          >
                            {device.status === 'connected' && 'Connecte'}
                            {device.status === 'syncing' && 'Sync...'}
                            {device.status === 'error' && 'Erreur'}
                            {device.status === 'disconnected' && 'Deconnecte'}
                          </Badge>
                        </div>
                        <p className="text-xs text-[var(--text-tertiary)]">
                          {formatLastSync(device.lastSync)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {device.status === 'syncing' ? (
                        <Loader2 className="h-4 w-4 text-[var(--accent-primary)] animate-spin" />
                      ) : (
                        <>
                          <button
                            onClick={() => syncDevice(device.id)}
                            className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
                            title="Synchroniser"
                          >
                            <RefreshCw className="h-4 w-4 text-[var(--text-tertiary)]" />
                          </button>
                          <button
                            onClick={() => handleRemoveDevice(device.id)}
                            className="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                            title="Deconnecter"
                          >
                            <X className="h-4 w-4 text-red-500" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Sync data summary */}
                  {syncData && device.status === 'connected' && (
                    <div className="mt-3 pt-3 border-t border-[var(--border-light)] grid grid-cols-4 gap-2">
                      {device.permissions.steps && syncData.steps && (
                        <div className="text-center">
                          <p className="text-xs text-[var(--text-tertiary)]">Pas</p>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">
                            {syncData.steps.toLocaleString()}
                          </p>
                        </div>
                      )}
                      {device.permissions.sleep && syncData.sleepHours && (
                        <div className="text-center">
                          <p className="text-xs text-[var(--text-tertiary)]">Sommeil</p>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">
                            {syncData.sleepHours.toFixed(1)}h
                          </p>
                        </div>
                      )}
                      {device.permissions.heartRate && syncData.heartRate && (
                        <div className="text-center">
                          <p className="text-xs text-[var(--text-tertiary)]">BPM</p>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">
                            {syncData.heartRate}
                          </p>
                        </div>
                      )}
                      {device.permissions.calories && syncData.activeCalories && (
                        <div className="text-center">
                          <p className="text-xs text-[var(--text-tertiary)]">Actif</p>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">
                            {syncData.activeCalories} kcal
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              </motion.div>
            )
          })}

          {/* Add another device button */}
          {availableToConnect.length > 0 && (
            <button
              onClick={() => setShowAddDevice(true)}
              className="w-full p-3 rounded-xl border-2 border-dashed border-[var(--border-default)] text-[var(--text-tertiary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              <span className="text-sm">Ajouter un appareil</span>
            </button>
          )}
        </div>
      ) : (
        /* No devices connected */
        <Card padding="lg" className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center">
            <Watch className="h-6 w-6 text-[var(--text-tertiary)]" />
          </div>
          <h4 className="font-medium text-[var(--text-primary)] mb-1">
            Connecte ta montre
          </h4>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Synchronise automatiquement tes pas, sommeil et activite
          </p>
          <button
            onClick={() => setShowAddDevice(true)}
            className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white font-medium hover:opacity-90 transition-opacity"
          >
            Connecter un appareil
          </button>
        </Card>
      )}

      {/* Add device modal */}
      <AnimatePresence>
        {showAddDevice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => !isConnecting && setShowAddDevice(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="bg-[var(--bg-primary)] rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-[var(--border-light)]">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-[var(--text-primary)]">Connecter un appareil</h3>
                  <button
                    onClick={() => !isConnecting && setShowAddDevice(false)}
                    className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]"
                    disabled={isConnecting}
                  >
                    <X className="h-5 w-5 text-[var(--text-tertiary)]" />
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-2 overflow-y-auto">
                {availableToConnect.map((device) => {
                  const info = DEVICE_INFO[device.type]
                  const isConnectingThis = connectingType === device.type

                  return (
                    <button
                      key={device.type}
                      onClick={() => handleConnectDevice(device.type)}
                      disabled={isConnecting}
                      className={cn(
                        'w-full p-4 rounded-xl border border-[var(--border-default)] text-left transition-all',
                        isConnecting && !isConnectingThis && 'opacity-50',
                        !isConnecting && 'hover:border-[var(--accent-primary)] hover:bg-[var(--bg-secondary)]'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                          style={{ backgroundColor: `${info.color}20` }}
                        >
                          {isConnectingThis ? (
                            <Loader2 className="h-6 w-6 animate-spin" style={{ color: info.color }} />
                          ) : (
                            info.icon
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-[var(--text-primary)]">{info.name}</p>
                          <p className="text-xs text-[var(--text-tertiary)]">
                            {isConnectingThis ? 'Connexion en cours...' : device.description}
                          </p>
                        </div>
                        {!isConnecting && (
                          <ChevronRight className="h-5 w-5 text-[var(--text-tertiary)]" />
                        )}
                      </div>
                    </button>
                  )
                })}

                {availableToConnect.length === 0 && (
                  <div className="text-center py-8">
                    <Check className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                    <p className="text-[var(--text-secondary)]">
                      Tous les appareils sont connectes
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
