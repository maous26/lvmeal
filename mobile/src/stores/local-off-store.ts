/**
 * Local Open Food Facts Store
 *
 * Stores products scanned by users that are not found in the official OFF database.
 * These products are stored locally and can be searched alongside official OFF products.
 *
 * Format mirrors the official OFF API response for consistency.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { FoodItem, NutritionInfo, NutriScoreGrade } from '../types'

// ============= TYPES =============

export interface LocalOffProduct {
  // Core identifiers
  code: string // barcode
  // Product info
  product_name: string
  product_name_fr?: string
  brands?: string
  // Images
  image_url?: string
  image_front_small_url?: string
  // Nutrition per 100g
  nutriments: {
    'energy-kcal_100g': number
    proteins_100g: number
    carbohydrates_100g: number
    fat_100g: number
    fiber_100g?: number
    sugars_100g?: number
    sodium_100g?: number
    'saturated-fat_100g'?: number
  }
  // Serving
  serving_size?: string
  // Categories
  categories_tags?: string[]
  // Nutri-Score
  nutriscore_grade?: string
  // Metadata
  addedAt: string
  addedBy: 'user'
  source: 'local'
}

export interface LocalOffState {
  products: LocalOffProduct[]
  // Actions
  addProduct: (product: Omit<LocalOffProduct, 'addedAt' | 'addedBy' | 'source'>) => void
  updateProduct: (code: string, updates: Partial<LocalOffProduct>) => void
  removeProduct: (code: string) => void
  getProductByBarcode: (barcode: string) => LocalOffProduct | null
  searchProducts: (query: string, limit?: number) => LocalOffProduct[]
  getAllProducts: () => LocalOffProduct[]
  clearAll: () => void
}

// ============= HELPERS =============

/**
 * Normalize string for search (remove accents, lowercase)
 */
function normalizeForSearch(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * Convert a LocalOffProduct to FoodItem format
 */
export function localOffProductToFoodItem(product: LocalOffProduct): FoodItem {
  const name = product.product_name_fr || product.product_name || 'Produit inconnu'
  const brand = product.brands?.split(',')[0]?.trim()
  const fullName = brand ? `${name} - ${brand}` : name

  // Map nutri-score grade
  const validGrades = ['a', 'b', 'c', 'd', 'e']
  const rawGrade = product.nutriscore_grade?.toLowerCase()
  const nutriscore = rawGrade && validGrades.includes(rawGrade)
    ? rawGrade as NutriScoreGrade
    : undefined

  return {
    id: `local-off-${product.code}`,
    name: fullName,
    brand,
    imageUrl: product.image_front_small_url || product.image_url || undefined,
    nutrition: {
      calories: Math.round(product.nutriments['energy-kcal_100g'] || 0),
      proteins: Math.round((product.nutriments.proteins_100g || 0) * 10) / 10,
      carbs: Math.round((product.nutriments.carbohydrates_100g || 0) * 10) / 10,
      fats: Math.round((product.nutriments.fat_100g || 0) * 10) / 10,
      fiber: product.nutriments.fiber_100g ?? undefined,
      sugar: product.nutriments.sugars_100g ?? undefined,
      sodium: product.nutriments.sodium_100g
        ? Math.round(product.nutriments.sodium_100g * 1000)
        : undefined,
      saturatedFat: product.nutriments['saturated-fat_100g'] ?? undefined,
    },
    servingSize: product.serving_size ? parseFloat(product.serving_size) || 100 : 100,
    servingUnit: 'g',
    category: product.categories_tags?.[0]?.replace(/^(en|fr):/, ''),
    source: 'openfoodfacts', // Mark as OFF for consistency
    barcode: product.code,
    nutriscore,
  }
}

// ============= STORE =============

export const useLocalOffStore = create<LocalOffState>()(
  persist(
    (set, get) => ({
      products: [],

      addProduct: (product) => {
        const newProduct: LocalOffProduct = {
          ...product,
          addedAt: new Date().toISOString(),
          addedBy: 'user',
          source: 'local',
        }

        set((state) => {
          // Check if product already exists
          const existingIndex = state.products.findIndex(p => p.code === product.code)
          if (existingIndex >= 0) {
            // Update existing product
            const updatedProducts = [...state.products]
            updatedProducts[existingIndex] = newProduct
            return { products: updatedProducts }
          }
          // Add new product
          return { products: [...state.products, newProduct] }
        })

        console.log(`[LocalOFF] Added product: ${product.product_name} (${product.code})`)
      },

      updateProduct: (code, updates) => {
        set((state) => ({
          products: state.products.map(p =>
            p.code === code ? { ...p, ...updates } : p
          ),
        }))
      },

      removeProduct: (code) => {
        set((state) => ({
          products: state.products.filter(p => p.code !== code),
        }))
      },

      getProductByBarcode: (barcode) => {
        const { products } = get()
        return products.find(p => p.code === barcode) || null
      },

      searchProducts: (query, limit = 10) => {
        const { products } = get()
        const normalizedQuery = normalizeForSearch(query)
        const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 1)

        // Score and filter products
        const scored: { score: number; product: LocalOffProduct }[] = []

        for (const product of products) {
          const name = normalizeForSearch(product.product_name_fr || product.product_name || '')
          const brand = normalizeForSearch(product.brands || '')
          const combined = `${name} ${brand}`

          let score = 0

          // Exact name match
          if (name === normalizedQuery) {
            score = 1000
          }
          // Name starts with query
          else if (name.startsWith(normalizedQuery)) {
            score = 800
          }
          // Name contains query
          else if (name.includes(normalizedQuery)) {
            score = 600
          }
          // Brand contains query
          else if (brand.includes(normalizedQuery)) {
            score = 400
          }
          // Check individual words
          else if (queryWords.length > 0) {
            let wordMatches = 0
            for (const word of queryWords) {
              if (combined.includes(word)) {
                wordMatches++
              }
            }
            if (wordMatches > 0) {
              score = 200 + (wordMatches * 50)
            }
          }

          if (score > 0) {
            scored.push({ score, product })
          }
        }

        // Sort by score and return
        return scored
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
          .map(s => s.product)
      },

      getAllProducts: () => get().products,

      clearAll: () => {
        set({ products: [] })
        console.log('[LocalOFF] Cleared all local products')
      },
    }),
    {
      name: 'local-off-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    }
  )
)

export default useLocalOffStore
