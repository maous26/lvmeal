/**
 * Image Cache Service with Cloudflare optimization
 *
 * Features:
 * - Cloudflare image CDN proxy
 * - Local image caching
 * - Progressive loading
 * - Placeholder fallbacks
 */

import * as FileSystem from 'expo-file-system/legacy'
import { Image } from 'react-native'

// Cloudflare Workers URL for image optimization (optional)
// You can deploy your own worker or use direct URLs
const CLOUDFLARE_PROXY = '' // e.g., 'https://images.yourdomain.workers.dev'

const CACHE_DIR = `${FileSystem.cacheDirectory}images/`
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days

interface CacheMetadata {
  url: string
  localPath: string
  timestamp: number
  size?: number
}

// In-memory index of cached images
const cacheIndex = new Map<string, CacheMetadata>()
let cacheInitialized = false

// ============= INITIALIZATION =============

async function initCache(): Promise<void> {
  if (cacheInitialized) return

  try {
    // Create cache directory if it doesn't exist
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR)
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true })
    }

    // Load cache index from storage
    const indexPath = `${CACHE_DIR}index.json`
    const indexInfo = await FileSystem.getInfoAsync(indexPath)
    if (indexInfo.exists) {
      const indexData = await FileSystem.readAsStringAsync(indexPath)
      const entries: CacheMetadata[] = JSON.parse(indexData)
      for (const entry of entries) {
        cacheIndex.set(entry.url, entry)
      }
    }

    cacheInitialized = true
  } catch (error) {
    console.error('Error initializing image cache:', error)
    cacheInitialized = true
  }
}

async function saveCacheIndex(): Promise<void> {
  try {
    const indexPath = `${CACHE_DIR}index.json`
    const entries = Array.from(cacheIndex.values())
    await FileSystem.writeAsStringAsync(indexPath, JSON.stringify(entries))
  } catch (error) {
    console.error('Error saving cache index:', error)
  }
}

// ============= URL OPTIMIZATION =============

/**
 * Get optimized image URL through Cloudflare or direct
 */
export function getOptimizedImageUrl(
  url: string | undefined | null,
  options?: {
    width?: number
    height?: number
    quality?: number
    format?: 'webp' | 'jpeg' | 'png'
  }
): string | null {
  if (!url) return null

  // If no Cloudflare proxy configured, return direct URL
  if (!CLOUDFLARE_PROXY) {
    return url
  }

  // Build Cloudflare optimized URL
  const params = new URLSearchParams()
  if (options?.width) params.set('w', String(options.width))
  if (options?.height) params.set('h', String(options.height))
  if (options?.quality) params.set('q', String(options.quality))
  if (options?.format) params.set('f', options.format)
  params.set('url', url)

  return `${CLOUDFLARE_PROXY}?${params.toString()}`
}

// ============= CACHING =============

/**
 * Get cached image path or download and cache
 */
export async function getCachedImage(url: string): Promise<string | null> {
  if (!url) return null

  await initCache()

  // Generate cache key from URL
  const cacheKey = url
  const cachedEntry = cacheIndex.get(cacheKey)

  // Check if cached and not expired
  if (cachedEntry) {
    const age = Date.now() - cachedEntry.timestamp
    if (age < CACHE_DURATION) {
      // Verify file exists
      const fileInfo = await FileSystem.getInfoAsync(cachedEntry.localPath)
      if (fileInfo.exists) {
        return cachedEntry.localPath
      }
    }
    // Remove expired/missing entry
    cacheIndex.delete(cacheKey)
  }

  // Download and cache
  try {
    const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`
    const localPath = `${CACHE_DIR}${filename}`

    const downloadResult = await FileSystem.downloadAsync(url, localPath)

    if (downloadResult.status === 200) {
      const metadata: CacheMetadata = {
        url,
        localPath,
        timestamp: Date.now(),
      }
      cacheIndex.set(cacheKey, metadata)

      // Save index (async)
      saveCacheIndex()

      return localPath
    }
  } catch (error) {
    console.error('Error caching image:', error)
  }

  // Fallback to original URL
  return url
}

/**
 * Prefetch images for faster loading
 */
export async function prefetchImages(urls: (string | undefined | null)[]): Promise<void> {
  const validUrls = urls.filter((url): url is string => !!url)

  // Use React Native's built-in prefetch
  await Promise.all(
    validUrls.map(url =>
      Image.prefetch(url).catch(() => {
        // Ignore prefetch errors
      })
    )
  )
}

/**
 * Clear expired cache entries
 */
export async function cleanupCache(): Promise<number> {
  await initCache()

  let cleaned = 0
  const now = Date.now()

  for (const [key, entry] of cacheIndex.entries()) {
    if (now - entry.timestamp > CACHE_DURATION) {
      try {
        await FileSystem.deleteAsync(entry.localPath, { idempotent: true })
        cacheIndex.delete(key)
        cleaned++
      } catch (error) {
        // Ignore deletion errors
      }
    }
  }

  if (cleaned > 0) {
    await saveCacheIndex()
  }

  return cleaned
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  entries: number
  sizeBytes: number
}> {
  await initCache()

  let totalSize = 0

  for (const entry of cacheIndex.values()) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(entry.localPath)
      if (fileInfo.exists && 'size' in fileInfo) {
        totalSize += fileInfo.size || 0
      }
    } catch {
      // Ignore
    }
  }

  return {
    entries: cacheIndex.size,
    sizeBytes: totalSize,
  }
}

/**
 * Clear all cached images
 */
export async function clearCache(): Promise<void> {
  try {
    await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true })
    cacheIndex.clear()
    cacheInitialized = false
  } catch (error) {
    console.error('Error clearing cache:', error)
  }
}

export default {
  getOptimizedImageUrl,
  getCachedImage,
  prefetchImages,
  cleanupCache,
  getCacheStats,
  clearCache,
}
