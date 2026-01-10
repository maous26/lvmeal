/**
 * Cloudflare R2 Storage Service
 *
 * Handles image uploads for:
 * - Meal photos
 * - Recipe images
 * - User avatars
 *
 * SECURITY: Uses backend endpoint to get presigned URLs.
 * Credentials are stored server-side only.
 */

import * as FileSystem from 'expo-file-system'

// Backend API for presigned URLs (credentials stored server-side)
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://lym1-production.up.railway.app'
const R2_PUBLIC_URL = process.env.EXPO_PUBLIC_R2_PUBLIC_URL || ''

export interface UploadResult {
  success: boolean
  url?: string
  key?: string
  error?: string
}

export interface ImageCategory {
  type: 'meals' | 'recipes' | 'avatars' | 'misc'
  userId?: string
}

/**
 * Check if R2 is configured (backend availability)
 */
export function isR2Configured(): boolean {
  return !!API_URL
}

/**
 * Generate a unique key for the image
 */
function generateImageKey(category: ImageCategory, filename: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const ext = filename.split('.').pop() || 'jpg'

  const prefix = category.userId
    ? `${category.type}/${category.userId}`
    : category.type

  return `${prefix}/${timestamp}-${random}.${ext}`
}

/**
 * Get presigned URL from backend (credentials stay server-side)
 */
async function getPresignedUrlFromBackend(
  method: 'PUT' | 'GET' | 'DELETE',
  key: string,
  contentType?: string
): Promise<{ url: string; publicUrl: string } | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(`${API_URL}/api/storage/presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, key, contentType }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error('[R2] Failed to get presigned URL:', response.status)
      return null
    }

    return await response.json()
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[R2] Timeout getting presigned URL')
    } else {
      console.error('[R2] Error getting presigned URL:', error)
    }
    return null
  }
}

/**
 * Upload an image to R2 via backend presigned URL
 */
export async function uploadImage(
  localUri: string,
  category: ImageCategory,
  filename?: string
): Promise<UploadResult> {
  if (!isR2Configured()) {
    console.warn('[R2] Backend not configured')
    return { success: false, error: 'Storage not configured' }
  }

  try {
    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(localUri)
    if (!fileInfo.exists) {
      return { success: false, error: 'File not found' }
    }

    // Generate key
    const name = filename || localUri.split('/').pop() || 'image.jpg'
    const key = generateImageKey(category, name)

    // Determine content type
    const ext = name.split('.').pop()?.toLowerCase()
    const contentType = ext === 'png' ? 'image/png'
      : ext === 'gif' ? 'image/gif'
      : ext === 'webp' ? 'image/webp'
      : 'image/jpeg'

    // Get presigned URL from backend (credentials never leave server)
    const presignedData = await getPresignedUrlFromBackend('PUT', key, contentType)
    if (!presignedData) {
      return { success: false, error: 'Failed to get upload URL' }
    }

    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: 'base64',
    })

    // Upload to R2 using presigned URL
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000) // 60s for upload

    const response = await fetch(presignedData.url, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: Uint8Array.from(atob(base64), c => c.charCodeAt(0)),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const error = await response.text()
      console.error('[R2] Upload error:', error)
      return { success: false, error: `Upload failed: ${response.status}` }
    }

    // Return public URL
    const publicUrl = R2_PUBLIC_URL
      ? `${R2_PUBLIC_URL}/${key}`
      : presignedData.publicUrl

    return {
      success: true,
      url: publicUrl,
      key,
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[R2] Upload timeout')
      return { success: false, error: 'Upload timeout' }
    }
    console.error('[R2] Upload error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    }
  }
}

/**
 * Upload a meal photo
 */
export async function uploadMealPhoto(
  localUri: string,
  userId: string
): Promise<UploadResult> {
  return uploadImage(localUri, { type: 'meals', userId })
}

/**
 * Upload a recipe image
 */
export async function uploadRecipeImage(
  localUri: string
): Promise<UploadResult> {
  return uploadImage(localUri, { type: 'recipes' })
}

/**
 * Upload a user avatar
 */
export async function uploadAvatar(
  localUri: string,
  userId: string
): Promise<UploadResult> {
  return uploadImage(localUri, { type: 'avatars', userId })
}

/**
 * Delete an image from R2 via backend
 */
export async function deleteImage(key: string): Promise<boolean> {
  if (!isR2Configured()) {
    return false
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(`${API_URL}/api/storage/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    return response.ok
  } catch (error) {
    console.error('[R2] Delete error:', error)
    return false
  }
}

/**
 * Get a temporary signed URL for private images
 */
export async function getSignedUrl(key: string, expiresIn: number = 3600): Promise<string | null> {
  if (!isR2Configured()) {
    return null
  }

  try {
    const presignedData = await getPresignedUrlFromBackend('GET', key)
    return presignedData?.url || null
  } catch (error) {
    console.error('[R2] Failed to generate signed URL:', error)
    return null
  }
}

export default {
  isR2Configured,
  uploadImage,
  uploadMealPhoto,
  uploadRecipeImage,
  uploadAvatar,
  deleteImage,
  getSignedUrl,
}
