'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Barcode, Camera, X, Loader2, Check, RotateCcw, Package, AlertCircle } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn, formatNumber } from '@/lib/utils'
import { lookupBarcode } from '@/app/actions/food-analysis'
import type { MealType, FoodItem } from '@/types'

interface BarcodeScannerProps {
  mealType: MealType
  onProductFound: (food: FoodItem) => void
  className?: string
}

type ScanState = 'idle' | 'scanning' | 'loading' | 'found' | 'not_found' | 'error'

interface FoundProduct {
  name: string
  brand?: string
  imageUrl?: string
  serving: number
  nutrition: {
    calories: number
    proteins: number
    carbs: number
    fats: number
    fiber?: number
    sugar?: number
    sodium?: number
  }
}

export function BarcodeScanner({ mealType, onProductFound, className }: BarcodeScannerProps) {
  const [state, setState] = React.useState<ScanState>('idle')
  const [manualBarcode, setManualBarcode] = React.useState('')
  const [product, setProduct] = React.useState<FoundProduct | null>(null)
  const [error, setError] = React.useState('')
  const [quantity, setQuantity] = React.useState(100)

  const videoRef = React.useRef<HTMLVideoElement>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }

  const startScanning = async () => {
    try {
      setState('scanning')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        // Start barcode detection loop
        detectBarcode()
      }
    } catch {
      setError('Impossible d\'accéder à la caméra')
      setState('error')
    }
  }

  const detectBarcode = async () => {
    if (!videoRef.current || !canvasRef.current || state !== 'scanning') return

    const canvas = canvasRef.current
    const video = videoRef.current
    const ctx = canvas.getContext('2d')

    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      requestAnimationFrame(detectBarcode)
      return
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)

    // Check if BarcodeDetector API is available
    if ('BarcodeDetector' in window) {
      try {
        const barcodeDetector = new (window as unknown as { BarcodeDetector: new (options?: { formats: string[] }) => { detect: (source: HTMLCanvasElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e']
        })
        const barcodes = await barcodeDetector.detect(canvas)

        if (barcodes.length > 0) {
          const barcode = barcodes[0].rawValue
          stopCamera()
          lookupProduct(barcode)
          return
        }
      } catch (e) {
        console.error('Barcode detection error:', e)
      }
    }

    // Continue scanning
    if (state === 'scanning') {
      requestAnimationFrame(detectBarcode)
    }
  }

  const lookupProduct = async (barcode: string) => {
    setState('loading')
    setError('')

    const result = await lookupBarcode(barcode)

    if (result.success && result.product) {
      setProduct(result.product)
      setQuantity(result.product.serving)
      setState('found')
    } else {
      setError(result.error || 'Produit non trouvé')
      setState('not_found')
    }
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (manualBarcode.trim()) {
      lookupProduct(manualBarcode.trim())
    }
  }

  const confirmProduct = () => {
    if (!product) return

    const multiplier = quantity / 100 // Nutrition is per 100g
    const food: FoodItem = {
      id: `barcode-${Date.now()}`,
      name: product.brand ? `${product.name} (${product.brand})` : product.name,
      brand: product.brand,
      serving: quantity,
      servingUnit: 'g',
      nutrition: {
        calories: Math.round(product.nutrition.calories * multiplier),
        proteins: Math.round(product.nutrition.proteins * multiplier * 10) / 10,
        carbs: Math.round(product.nutrition.carbs * multiplier * 10) / 10,
        fats: Math.round(product.nutrition.fats * multiplier * 10) / 10,
        fiber: product.nutrition.fiber ? Math.round(product.nutrition.fiber * multiplier * 10) / 10 : undefined,
      },
      imageUrl: product.imageUrl,
      source: 'openfoodfacts',
    }

    onProductFound(food)
    reset()
  }

  const reset = () => {
    setState('idle')
    setManualBarcode('')
    setProduct(null)
    setError('')
    setQuantity(100)
    stopCamera()
  }

  const calculatedNutrition = React.useMemo(() => {
    if (!product) return null
    const multiplier = quantity / 100
    return {
      calories: Math.round(product.nutrition.calories * multiplier),
      proteins: Math.round(product.nutrition.proteins * multiplier * 10) / 10,
      carbs: Math.round(product.nutrition.carbs * multiplier * 10) / 10,
      fats: Math.round(product.nutrition.fats * multiplier * 10) / 10,
    }
  }, [product, quantity])

  return (
    <div className={cn('space-y-4', className)}>
      {/* Hidden canvas for barcode detection */}
      <canvas ref={canvasRef} className="hidden" />

      <AnimatePresence mode="wait">
        {/* Idle state */}
        {state === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="text-center py-6">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center mx-auto mb-4">
                <Barcode className="w-10 h-10 text-emerald-500" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
                Scanner un code-barres
              </h3>
              <p className="text-sm text-[var(--text-secondary)] max-w-xs mx-auto">
                Scannez le code-barres d'un produit pour obtenir ses valeurs nutritionnelles
              </p>
            </div>

            <Button
              variant="default"
              size="lg"
              onClick={startScanning}
              className="w-full h-14 bg-emerald-500 hover:bg-emerald-600"
            >
              <Camera className="h-5 w-5 mr-2" />
              Scanner avec la caméra
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--border-light)]" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[var(--bg-primary)] px-2 text-[var(--text-tertiary)]">ou</span>
              </div>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-3">
              <Input
                placeholder="Entrez le code-barres manuellement"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                leftIcon={Barcode}
              />
              <Button
                type="submit"
                variant="outline"
                disabled={!manualBarcode.trim()}
                className="w-full"
              >
                Rechercher
              </Button>
            </form>
          </motion.div>
        )}

        {/* Scanning state */}
        {state === 'scanning' && (
          <motion.div
            key="scanning"
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
              {/* Scanning overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-32 border-2 border-emerald-400 rounded-lg relative">
                  <motion.div
                    className="absolute left-0 right-0 h-0.5 bg-emerald-400"
                    animate={{ top: ['0%', '100%', '0%'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  />
                </div>
              </div>
              <div className="absolute bottom-4 left-0 right-0 text-center">
                <p className="text-white text-sm bg-black/50 inline-block px-3 py-1 rounded-full">
                  Placez le code-barres dans le cadre
                </p>
              </div>
            </div>

            <Button variant="outline" onClick={reset} className="w-full">
              <X className="h-4 w-4 mr-2" />
              Annuler
            </Button>
          </motion.div>
        )}

        {/* Loading state */}
        {state === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-12"
          >
            <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
            <p className="font-semibold text-[var(--text-primary)]">Recherche du produit...</p>
            <p className="text-sm text-[var(--text-tertiary)]">Interrogation d'Open Food Facts</p>
          </motion.div>
        )}

        {/* Found state */}
        {state === 'found' && product && (
          <motion.div
            key="found"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Product card */}
            <Card padding="default" className="flex items-start gap-4">
              {product.imageUrl ? (
                <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-[var(--bg-secondary)]">
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center flex-shrink-0">
                  <Package className="w-8 h-8 text-[var(--text-tertiary)]" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[var(--text-primary)]">{product.name}</p>
                {product.brand && (
                  <p className="text-sm text-[var(--text-secondary)]">{product.brand}</p>
                )}
                <p className="text-xs text-[var(--text-tertiary)] mt-1">
                  Valeurs pour 100g : {product.nutrition.calories} kcal
                </p>
              </div>
            </Card>

            {/* Quantity selector */}
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)] mb-2 block">
                Quantité (grammes)
              </label>
              <div className="flex gap-2">
                {[50, 100, 150, 200].map(q => (
                  <button
                    key={q}
                    onClick={() => setQuantity(q)}
                    className={cn(
                      'flex-1 py-2 rounded-xl text-sm font-medium transition-all',
                      quantity === q
                        ? 'bg-emerald-500 text-white'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                    )}
                  >
                    {q}g
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                className="mt-2 w-full h-12 text-center text-xl font-bold bg-[var(--bg-secondary)] rounded-xl border-2 border-transparent focus:border-emerald-500 focus:outline-none text-[var(--text-primary)]"
              />
            </div>

            {/* Nutrition for selected quantity */}
            {calculatedNutrition && (
              <Card padding="default" className="bg-[var(--bg-secondary)]">
                <p className="text-xs text-[var(--text-tertiary)] text-center mb-2">
                  Valeurs pour {quantity}g
                </p>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-[var(--calories)]">{formatNumber(calculatedNutrition.calories)}</p>
                    <p className="text-[10px] text-[var(--text-tertiary)] uppercase">kcal</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-[var(--proteins)]">{calculatedNutrition.proteins}g</p>
                    <p className="text-[10px] text-[var(--text-tertiary)] uppercase">Prot.</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-[var(--carbs)]">{calculatedNutrition.carbs}g</p>
                    <p className="text-[10px] text-[var(--text-tertiary)] uppercase">Gluc.</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-[var(--fats)]">{calculatedNutrition.fats}g</p>
                    <p className="text-[10px] text-[var(--text-tertiary)] uppercase">Lip.</p>
                  </div>
                </div>
              </Card>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={reset} className="flex-1">
                <RotateCcw className="h-4 w-4 mr-2" />
                Annuler
              </Button>
              <Button
                variant="default"
                onClick={confirmProduct}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600"
              >
                <Check className="h-4 w-4 mr-2" />
                Ajouter
              </Button>
            </div>
          </motion.div>
        )}

        {/* Not found state */}
        {state === 'not_found' && (
          <motion.div
            key="not_found"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-8"
          >
            <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-amber-500" />
            </div>
            <p className="font-medium text-[var(--text-primary)] mb-2">Produit non trouvé</p>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Ce produit n'est pas dans la base de données Open Food Facts
            </p>
            <Button variant="outline" onClick={reset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Scanner un autre produit
            </Button>
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
