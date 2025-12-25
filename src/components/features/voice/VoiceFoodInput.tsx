'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Loader2, Check, X, RotateCcw, Sparkles, Edit3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn, formatNumber } from '@/lib/utils'
import { analyzeFoodDescription, type AnalyzedFood } from '@/app/actions/food-analysis'
import type { MealType, FoodItem } from '@/types'

interface VoiceFoodInputProps {
  mealType: MealType
  onFoodsDetected: (foods: FoodItem[]) => void
  className?: string
}

type VoiceState = 'idle' | 'listening' | 'processing' | 'analyzing' | 'results' | 'error'

// Check if SpeechRecognition is available
const SpeechRecognition = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null

export function VoiceFoodInput({ mealType, onFoodsDetected, className }: VoiceFoodInputProps) {
  const [state, setState] = React.useState<VoiceState>('idle')
  const [transcript, setTranscript] = React.useState('')
  const [isEditing, setIsEditing] = React.useState(false)
  const [editedTranscript, setEditedTranscript] = React.useState('')
  const [analyzedFoods, setAnalyzedFoods] = React.useState<AnalyzedFood[]>([])
  const [description, setDescription] = React.useState('')
  const [error, setError] = React.useState('')
  const [selectedFoods, setSelectedFoods] = React.useState<Set<number>>(new Set())

  const recognitionRef = React.useRef<SpeechRecognition | null>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  const startListening = () => {
    if (!SpeechRecognition) {
      setError('La reconnaissance vocale n\'est pas supportée par votre navigateur')
      setState('error')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'fr-FR'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setState('listening')
      setTranscript('')
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = ''
      let interimTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0].transcript
        } else {
          interimTranscript += result[0].transcript
        }
      }

      setTranscript(finalTranscript || interimTranscript)
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error)
      if (event.error === 'no-speech') {
        setError('Aucune parole détectée. Essayez à nouveau.')
      } else if (event.error === 'not-allowed') {
        setError('L\'accès au microphone a été refusé.')
      } else {
        setError('Erreur de reconnaissance vocale. Essayez à nouveau.')
      }
      setState('error')
    }

    recognition.onend = () => {
      if (transcript) {
        setState('processing')
        // Auto-analyze after a short delay
        setTimeout(() => analyzeTranscript(transcript), 500)
      } else if (state === 'listening') {
        // Recognition ended but no transcript yet
        setState('idle')
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
  }

  const analyzeTranscript = async (text: string) => {
    if (!text.trim()) {
      setError('Veuillez décrire votre repas')
      setState('error')
      return
    }

    setState('analyzing')
    setError('')

    const result = await analyzeFoodDescription(text)

    if (result.success && result.foods.length > 0) {
      setAnalyzedFoods(result.foods)
      setDescription(result.description || '')
      setSelectedFoods(new Set(result.foods.map((_, i) => i)))
      setState('results')
    } else {
      setError(result.error || 'Impossible d\'identifier les aliments dans votre description')
      setState('error')
    }
  }

  const handleEditSubmit = () => {
    if (editedTranscript.trim()) {
      setTranscript(editedTranscript.trim())
      setIsEditing(false)
      analyzeTranscript(editedTranscript.trim())
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
        id: `voice-${Date.now()}-${i}`,
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
    setTranscript('')
    setEditedTranscript('')
    setIsEditing(false)
    setAnalyzedFoods([])
    setDescription('')
    setError('')
    setSelectedFoods(new Set())
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
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

  const isSpeechSupported = !!SpeechRecognition

  return (
    <div className={cn('space-y-4', className)}>
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
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center mx-auto mb-4">
                <Mic className="w-10 h-10 text-purple-500" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
                Dictez votre repas
              </h3>
              <p className="text-sm text-[var(--text-secondary)] max-w-xs mx-auto">
                Décrivez ce que vous avez mangé et l'IA identifiera les aliments
              </p>
            </div>

            {isSpeechSupported ? (
              <Button
                variant="default"
                size="lg"
                onClick={startListening}
                className="w-full h-14 bg-purple-500 hover:bg-purple-600"
              >
                <Mic className="h-5 w-5 mr-2" />
                Commencer à dicter
              </Button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-[var(--text-tertiary)] text-center">
                  Reconnaissance vocale non disponible. Saisissez votre repas :
                </p>
                <textarea
                  ref={textareaRef}
                  value={editedTranscript}
                  onChange={(e) => setEditedTranscript(e.target.value)}
                  placeholder="Ex: J'ai mangé un poulet rôti avec des haricots verts et une pomme de terre..."
                  className="w-full h-24 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-light)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <Button
                  variant="default"
                  onClick={() => analyzeTranscript(editedTranscript)}
                  disabled={!editedTranscript.trim()}
                  className="w-full bg-purple-500 hover:bg-purple-600"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Analyser
                </Button>
              </div>
            )}

            <p className="text-xs text-[var(--text-tertiary)] text-center">
              Ex: "J'ai pris un café avec deux croissants et un jus d'orange"
            </p>
          </motion.div>
        )}

        {/* Listening state */}
        {state === 'listening' && (
          <motion.div
            key="listening"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="text-center py-8"
          >
            <motion.div
              className="w-24 h-24 rounded-full bg-purple-500 flex items-center justify-center mx-auto mb-6"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Mic className="w-12 h-12 text-white" />
            </motion.div>

            <p className="font-semibold text-[var(--text-primary)] mb-2">Je vous écoute...</p>

            {transcript && (
              <p className="text-sm text-[var(--text-secondary)] italic max-w-xs mx-auto mb-4">
                "{transcript}"
              </p>
            )}

            <Button variant="outline" onClick={stopListening}>
              <MicOff className="h-4 w-4 mr-2" />
              Arrêter
            </Button>
          </motion.div>
        )}

        {/* Processing state */}
        {state === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-8"
          >
            <Card padding="default" className="mb-4">
              <p className="text-[var(--text-primary)] italic">"{transcript}"</p>
            </Card>

            <div className="flex items-center justify-center gap-2 mb-4">
              {!isEditing ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditedTranscript(transcript)
                    setIsEditing(true)
                  }}
                >
                  <Edit3 className="h-4 w-4 mr-1" />
                  Modifier
                </Button>
              ) : (
                <div className="w-full space-y-2">
                  <textarea
                    value={editedTranscript}
                    onChange={(e) => setEditedTranscript(e.target.value)}
                    className="w-full h-20 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-light)] text-[var(--text-primary)] resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(false)} className="flex-1">
                      Annuler
                    </Button>
                    <Button variant="default" size="sm" onClick={handleEditSubmit} className="flex-1">
                      Valider
                    </Button>
                  </div>
                </div>
              )}
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
            <Card padding="default" className="mb-6 bg-[var(--bg-secondary)]">
              <p className="text-sm text-[var(--text-secondary)] italic">"{transcript}"</p>
            </Card>

            <div className="flex items-center justify-center gap-2 mb-2">
              <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
              <span className="font-semibold text-[var(--text-primary)]">Analyse en cours...</span>
            </div>
            <p className="text-sm text-[var(--text-tertiary)]">
              L'IA identifie les aliments mentionnés
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
            {/* Original transcript */}
            <Card padding="default" className="bg-purple-50 border-purple-100">
              <p className="text-sm text-purple-700 italic">"{transcript}"</p>
            </Card>

            {/* Description */}
            {description && (
              <p className="text-sm text-[var(--text-secondary)]">
                {description}
              </p>
            )}

            {/* Detected foods list */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-[var(--text-secondary)]">
                {analyzedFoods.length} aliment{analyzedFoods.length > 1 ? 's' : ''} identifié{analyzedFoods.length > 1 ? 's' : ''}
              </p>

              {analyzedFoods.map((food, index) => (
                <Card
                  key={index}
                  padding="default"
                  className={cn(
                    'cursor-pointer transition-all',
                    selectedFoods.has(index)
                      ? 'ring-2 ring-purple-400 bg-purple-50'
                      : 'opacity-60'
                  )}
                  onClick={() => toggleFoodSelection(index)}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
                      selectedFoods.has(index)
                        ? 'bg-purple-500 border-purple-500'
                        : 'border-[var(--border-default)]'
                    )}>
                      {selectedFoods.has(index) && <Check className="w-4 h-4 text-white" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--text-primary)] truncate">{food.name}</p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        ~{food.estimatedWeight}g
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
                className="flex-1 bg-purple-500 hover:bg-purple-600"
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

// Add type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}
