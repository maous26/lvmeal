// API Client for Presence Mobile App
// Connects to Railway backend

import axios from 'axios'

const API_URL = 'https://lvmeal-production.up.railway.app'

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Food search
export async function searchFood(query: string) {
  const response = await api.get(`/api/food/search?q=${encodeURIComponent(query)}`)
  return response.data
}

// Recipe search
export async function searchRecipes(query: string) {
  const response = await api.get(`/api/recipes/search?q=${encodeURIComponent(query)}`)
  return response.data
}

// Get recipe by ID
export async function getRecipe(id: string) {
  const response = await api.get(`/api/recipes/${id}`)
  return response.data
}

// Recipe suggestions
export async function getRecipeSuggestions(params: {
  goal?: string
  diet?: string
  calories?: number
  mealType?: string
}) {
  const searchParams = new URLSearchParams()
  if (params.goal) searchParams.set('goal', params.goal)
  if (params.diet) searchParams.set('diet', params.diet)
  if (params.calories) searchParams.set('calories', params.calories.toString())
  if (params.mealType) searchParams.set('mealType', params.mealType)

  const response = await api.get(`/api/recipes/suggestions?${searchParams.toString()}`)
  return response.data
}

// External recipes
export async function searchExternalRecipes(query: string) {
  const response = await api.get(`/api/recipes/external?q=${encodeURIComponent(query)}`)
  return response.data
}

// Enrich recipe with AI
export async function enrichRecipe(recipeId: string) {
  const response = await api.post('/api/recipes/enrich', { recipeId })
  return response.data
}

// Rate recipe
export async function rateRecipe(id: string, rating: number) {
  const response = await api.post(`/api/recipes/${id}/rate`, { rating })
  return response.data
}

// Sport program generation
export async function generateSportProgram(context: unknown) {
  const response = await api.post('/api/sport/generate-week', context)
  return response.data
}

export default {
  searchFood,
  searchRecipes,
  getRecipe,
  getRecipeSuggestions,
  searchExternalRecipes,
  enrichRecipe,
  rateRecipe,
  generateSportProgram,
}
