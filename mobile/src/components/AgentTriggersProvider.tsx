/**
 * AgentTriggersProvider - Composant pour activer les triggers automatiques
 *
 * Ce composant doit être placé dans l'arbre de composants où les stores
 * sont accessibles. Il écoute les changements et déclenche les agents IA.
 */

import React, { useEffect } from 'react'
import { useAgentTriggers } from '../hooks/useAgentTriggers'

interface AgentTriggersProviderProps {
  children: React.ReactNode
}

function AgentTriggersInner() {
  // Activer les triggers automatiques
  useAgentTriggers()

  useEffect(() => {
    console.log('[AgentTriggersProvider] Triggers activés')
  }, [])

  return null
}

export function AgentTriggersProvider({ children }: AgentTriggersProviderProps) {
  return (
    <>
      <AgentTriggersInner />
      {children}
    </>
  )
}

export default AgentTriggersProvider
