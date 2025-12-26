'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Upload, X, Loader2, Check, RotateCcw, Sparkles } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn, formatNumber } from '@/lib/utils'
import { analyzeFood, type AnalyzedFood } from '@/app/actions/food-analysis'
import type { MealType, FoodItem } from '@/types'

interface PhotoFoodScannerProps {
  mealType: MealType
  onFoodsDetected: (foods: FoodItem[]) => void
  className?: string
}

type ScanState = 'idle' | 'capturing' | 'analyzing' | 'results' | 'error'

export function PhotoFoodScanner({ mealType, onFoodsDetected, className }: PhotoFoodScannerProps) {
  const [state, setState] = React.useState<ScanState>('idle')
  const [imageData, setImageData] = React.useState<string | null>(null)
  const [analyzedFoods, setAnalyzedFoods] = React.useState<AnalyzedFood[]>([])
  const [description, setDescription] = React.useState<string>('')
  const [error, setError] = React.useState<string>('')
  const [selectedFoods, setSelectedFoods] = React.useState<Set<number>>(new Set())

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const streamRef = React.useRef<MediaStream | null>(null)

  // Cleanup camera on unmount
  React.useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const startCamera = async () => {
    try {
      setState('capturing')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch {
      setError('Impossible d\'accéder à la caméra. Veuillez autoriser l\'accès ou utiliser l\'upload.')
      setState('error')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  const capturePhoto = () => {
    if (!videoRef.current) return

    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(videoRef.current, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
    setImageData(dataUrl)
    stopCamera()
    analyzeImage(dataUrl)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      setImageData(dataUrl)
      analyzeImage(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  const analyzeImage = async (base64Image: string) => {
    setState('analyzing')
    setError('')

    const result = await analyzeFood(base64Image)

    if (result.success && result.foods.length > 0) {
      setAnalyzedFoods(result.foods)
      setDescription(result.description || '')
      // Select all foods by default
      setSelectedFoods(new Set(result.foods.map((_, i) => i)))
      setState('results')
    } else {
      setError(result.error || 'Aucun aliment détecté dans l\'image')
      setState('error')
    }
  }

  const toggleFoodSelection = (index: number) => {
    setSelectedFoods(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const confirmSelection = () => {
    const selected = analyzedFoods
      .filter((_, i) => selectedFoods.has(i))
      .map((food, i) => ({
        id: `photo-${Date.now()}-${i}`,
        name: food.name,
        serving: food.estimatedWeight,
        servingUnit: 'g' as const,
        nutrition: {
          calories: food.nutrition.calories,
          proteins: food.nutrition.proteins,
          carbs: food.nutrition.carbs,
          fats: food.nutrition.fats,
          fiber: food.nutrition.fiber,
        },
        source: 'ai' as const,
      }))

    onFoodsDetected(selected)
    reset()
  }

  const reset = () => {
    setState('idle')
    setImageData(null)
    setAnalyzedFoods([])
    setDescription('')
    setError('')
    setSelectedFoods(new Set())
    stopCamera()
  }

  const totalNutrition = React.useMemo(() => {
    return analyzedFoods
      .filter((_, i) => selectedFoods.has(i))
      .reduce(
        (acc, food) => ({
          calories: acc.calories + food.nutrition.calories,
          proteins: acc.proteins + food.nutrition.proteins,
          carbs: acc.carbs + food.nutrition.carbs,
          fats: acc.fats + food.nutrition.fats,
        }),
        { calories: 0, proteins: 0, carbs: 0, fats: 0 }
      )
  }, [analyzedFoods, selectedFoods])

  return (
    <div className={cn('space-y-4', className)}>
      <AnimatePresence mode="wait">
        {/* Idle state - show options */}
        {state === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="text-center py-6">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-rose-100 to-pink-100 flex items-center justify-center mx-auto mb-4">
                <Camera className="w-10 h-10 text-rose-500" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
                Scanner votre repas
              </h3>
              <p className="text-sm text-[var(--text-secondary)] max-w-xs mx-auto">
                Prenez une photo ou importez une image pour identifier automatiquement les aliments
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                size="lg"
                onClick={startCamera}
                className="h-24 flex-col gap-2"
              >
                <Camera className="h-6 w-6 text-rose-500" />
                <span>Prendre une photo</span>
              </Button>

              <Button
                variant="outline"
                size="lg"
                onClick={() => fileInputRef.current?.click()}
                className="h-24 flex-col gap-2"
              >
                <Upload className="h-6 w-6 text-indigo-500" />
                <span>Importer</span>
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </motion.div>
        )}

        {/* Capturing state - show camera */}
        {state === 'capturing' && (
          <motion.div
            key="capturing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-4"
          >
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Overlay guides */}
              <div className="absolute inset-4 border-2 border-white/30 rounded-xl pointer-events-none" />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => { stopCamera(); setState('idle') }}
                className="flex-1"
              >
                <X className="h-4 w-4 mr-2" />
                Annuler
              </Button>
              <Button
                variant="default"
                onClick={capturePhoto}
                className="flex-1 bg-rose-500 hover:bg-rose-600"
              >
                <Camera className="h-4 w-4 mr-2" />
                Capturer
              </Button>
            </div>
          </motion.div>
        )}

        {/* Analyzing state */}
        {state === 'analyzing' && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-12"
          >
            {imageData && (
              <div className="relative w-32 h-32 rounded-2xl overflow-hidden mx-auto mb-6">
                <Image src={imageData} alt="Captured food" fill className="object-cover" />
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              </div>
            )}
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-[var(--accent-primary)] animate-pulse" />
              <span className="font-semibold text-[var(--text-primary)]">Analyse en cours...</span>
            </div>
            <p className="text-sm text-[var(--text-tertiary)]">
              LymIA identifie les aliments dans votre photo
            </p>
          </motion.div>
        )}

        {/* Results state */}
        {state === 'results' && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Preview image */}
            {imageData && (
              <div className="relative rounded-2xl overflow-hidden aspect-video">
                <Image src={imageData} alt="Analyzed food" fill className="object-cover" />
              </div>
            )}

            {/* Description */}
            {description && (
              <p className="text-sm text-[var(--text-secondary)] italic">
                {description}
              </p>
            )}

            {/* Detected foods list */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-[var(--text-secondary)]">
                {analyzedFoods.length} aliment{analyzedFoods.length > 1 ? 's' : ''} détecté{analyzedFoods.length > 1 ? 's' : ''}
              </p>

              {analyzedFoods.map((food, index) => (
                <Card
                  key={index}
                  padding="default"
                  className={cn(
                    'cursor-pointer transition-all',
                    selectedFoods.has(index)
                      ? 'ring-2 ring-[var(--accent-primary)] bg-[var(--accent-light)]'
                      : 'opacity-60'
                  )}
                  onClick={() => toggleFoodSelection(index)}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
                      selectedFoods.has(index)
                        ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)]'
                        : 'border-[var(--border-default)]'
                    )}>
                      {selectedFoods.has(index) && <Check className="w-4 h-4 text-white" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--text-primary)] truncate">{food.name}</p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        ~{food.estimatedWeight}g · Confiance: {Math.round(food.confidence * 100)}%
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-semibold text-[var(--calories)]">{formatNumber(food.nutrition.calories)} kcal</p>
                      <p className="text-[10px] text-[var(--text-tertiary)]">
                        P {food.nutrition.proteins}g · G {food.nutrition.carbs}g · L {food.nutrition.fats}g
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Total nutrition */}
            {selectedFoods.size > 0 && (
              <Card padding="default" className="bg-[var(--bg-secondary)]">
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-[var(--calories)]">{formatNumber(totalNutrition.calories)}</p>
                    <p className="text-[10px] text-[var(--text-tertiary)] uppercase">kcal</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-[var(--proteins)]">{totalNutrition.proteins}g</p>
                    <p className="text-[10px] text-[var(--text-tertiary)] uppercase">Prot.</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-[var(--carbs)]">{totalNutrition.carbs}g</p>
                    <p className="text-[10px] text-[var(--text-tertiary)] uppercase">Gluc.</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-[var(--fats)]">{totalNutrition.fats}g</p>
                    <p className="text-[10px] text-[var(--text-tertiary)] uppercase">Lip.</p>
                  </div>
                </div>
              </Card>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={reset} className="flex-1">
                <RotateCcw className="h-4 w-4 mr-2" />
                Recommencer
              </Button>
              <Button
                variant="default"
                onClick={confirmSelection}
                disabled={selectedFoods.size === 0}
                className="flex-1"
              >
                <Check className="h-4 w-4 mr-2" />
                Ajouter ({selectedFoods.size})
              </Button>
            </div>
          </motion.div>
        )}

        {/* Error state */}
        {state === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-8"
          >
            <div className="w-16 h-16 rounded-2xl bg-[var(--error)]/10 flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-[var(--error)]" />
            </div>
            <p className="text-[var(--error)] font-medium mb-2">Erreur</p>
            <p className="text-sm text-[var(--text-secondary)] mb-4">{error}</p>
            <Button variant="outline" onClick={reset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Réessayer
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
