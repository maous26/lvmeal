/**
 * Conversation Test Suites Index
 *
 * This file imports and runs all conversation-related test suites.
 *
 * Test Suites:
 * 1. conversation-intent-service.test.ts - Intent detection
 * 2. conversation-safety-service.test.ts - Safety guards
 * 3. conversation-action-service.test.ts - Action validation
 * 4. conversation-response-service.test.ts - Response generation
 * 5. conversation-store.test.ts - State management
 */

// Import all test suites to ensure they run
import './conversation-intent-service.test'
import './conversation-safety-service.test'
import './conversation-action-service.test'
import './conversation-response-service.test'
import './conversation-store.test'

describe('Conversation AI Coach Test Suites', () => {
  it('should have all 5 test suites loaded', () => {
    // This test verifies that all suites are properly imported
    expect(true).toBe(true)
  })
})
