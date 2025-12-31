/**
 * DSPy Module Exports
 *
 * Central export point for all DSPy-related functionality.
 */

// Types
export * from './types'

// Client
export { dspyClient, default as DSPyClient } from './client'

// Integration hooks
export {
  // Context conversion
  profileToDSPyContext,
  kbEntryToPassage,
  kbEntriesToPassages,

  // Hooks for lymia-brain.ts
  hookRewriteQuery,
  hookSelectEvidence,
  hookGenerateGroundedAnswer,

  // Full pipeline
  runEnhancedRAG,

  // Utilities
  isDSPyEnabled,
  formatCitationsForDisplay,
  extractSourcesFromCitations,
} from './integration'
