/**
 * Cuisine themes for meal variety
 * Ported from web app for mobile use
 */

// Available cuisine themes
export const CUISINE_THEMES = [
  'Cuisine francaise traditionnelle',
  'Cuisine mediterraneenne',
  'Cuisine italienne',
  'Cuisine asiatique legere',
  'Cuisine du sud-ouest',
  'Cuisine provencale',
  'Cuisine nordique',
  'Cuisine vegetarienne creative',
  'Cuisine express',
  'Comfort food sain',
] as const

export type CuisineTheme = (typeof CUISINE_THEMES)[number]

// Seasonal themes by season
export const SEASONAL_THEMES: Record<string, readonly string[]> = {
  spring: ['Legumes primeurs', 'Fraicheur printaniere', 'Cuisine legere'],
  summer: ['Cuisine estivale', 'Barbecue sain', 'Salades composees', 'Mediterraneen'],
  autumn: ['Cuisine de saison', 'Reconfort automnal', 'Courges et champignons'],
  winter: ['Cuisine reconfortante', 'Potages et gratins', 'Plats mijoters'],
} as const

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

/**
 * Get the current season based on date
 */
export function getCurrentSeason(): Season {
  const month = new Date().getMonth()
  if (month >= 2 && month <= 4) return 'spring'
  if (month >= 5 && month <= 7) return 'summer'
  if (month >= 8 && month <= 10) return 'autumn'
  return 'winter'
}

/**
 * Get a random cuisine theme
 */
export function getRandomTheme(): CuisineTheme {
  return CUISINE_THEMES[Math.floor(Math.random() * CUISINE_THEMES.length)]
}

/**
 * Get a seasonal theme based on current date
 */
export function getSeasonalTheme(): string {
  const season = getCurrentSeason()
  const themes = SEASONAL_THEMES[season]
  return themes[Math.floor(Math.random() * themes.length)]
}

/**
 * Get themed meal suggestion prompt
 */
export function getThemedPrompt(): string {
  const useSeasonalTheme = Math.random() > 0.5
  const theme = useSeasonalTheme ? getSeasonalTheme() : getRandomTheme()
  return `Theme suggere pour ce repas: ${theme}`
}

/**
 * Day-specific meal themes (for variety in weekly planning)
 */
export const DAY_THEMES: Record<number, string> = {
  0: 'Brunch du dimanche / Plat familial', // Sunday
  1: 'Repas leger (recuperation du week-end)', // Monday
  2: 'Cuisine du monde', // Tuesday
  3: 'Legumes de saison', // Wednesday
  4: 'Proteines variees', // Thursday
  5: 'Preparation du week-end', // Friday
  6: 'Plat plaisir du samedi', // Saturday
}

/**
 * Get day-specific theme
 */
export function getDayTheme(dayIndex?: number): string {
  const day = dayIndex ?? new Date().getDay()
  return DAY_THEMES[day] || 'Equilibre et gourmand'
}
