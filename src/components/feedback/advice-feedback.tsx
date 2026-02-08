'use client'

import * as React from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { useFeedbackStore, type FeedbackEntry } from '@/stores/feedback-store'

interface AdviceFeedbackProps {
  contentId: string
  type: FeedbackEntry['type']
  compact?: boolean
}

export function AdviceFeedback({ contentId, type, compact = false }: AdviceFeedbackProps) {
  const { addFeedback, getFeedbackForContent } = useFeedbackStore()
  const [showThanks, setShowThanks] = React.useState(false)

  const existing = getFeedbackForContent(contentId)

  const handleFeedback = (rating: 'helpful' | 'not_helpful') => {
    addFeedback(type, contentId, rating)
    setShowThanks(true)
    setTimeout(() => setShowThanks(false), 2000)
  }

  if (showThanks) {
    return (
      <span className="text-xs text-[var(--success)] animate-in fade-in">
        Merci pour ton retour !
      </span>
    )
  }

  if (existing) {
    return (
      <span className="text-xs text-[var(--text-tertiary)]">
        {existing.rating === 'helpful' ? 'Utile' : 'Pas utile'}
      </span>
    )
  }

  return (
    <div className={`flex items-center gap-1 ${compact ? '' : 'gap-2'}`}>
      <span className="text-xs text-[var(--text-tertiary)]">Utile ?</span>
      <button
        onClick={() => handleFeedback('helpful')}
        className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-[var(--success)] transition-colors"
        aria-label="Ce conseil est utile"
      >
        <ThumbsUp className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      </button>
      <button
        onClick={() => handleFeedback('not_helpful')}
        className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-[var(--error)] transition-colors"
        aria-label="Ce conseil n'est pas utile"
      >
        <ThumbsDown className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      </button>
    </div>
  )
}
