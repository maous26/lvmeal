// Meal themes for variety

const CUISINE_THEMES = [
  'Cuisine française traditionnelle',
  'Cuisine méditerranéenne',
  'Cuisine italienne',
  'Cuisine asiatique légère',
  'Cuisine du sud-ouest',
  'Cuisine provençale',
  'Cuisine nordique',
  'Cuisine végétarienne créative',
  'Cuisine express',
  'Comfort food sain'
]

const SEASONAL_THEMES: Record<string, string[]> = {
  spring: ['Légumes primeurs', 'Fraîcheur printanière', 'Cuisine légère'],
  summer: ['Cuisine estivale', 'Barbecue sain', 'Salades composées', 'Méditerranéen'],
  autumn: ['Cuisine de saison', 'Réconfort automnal', 'Courges et champignons'],
  winter: ['Cuisine réconfortante', 'Potages et gratins', 'Plats mijotés']
}

function getCurrentSeason(): 'spring' | 'summer' | 'autumn' | 'winter' {
  const month = new Date().getMonth()
  if (month >= 2 && month <= 4) return 'spring'
  if (month >= 5 && month <= 7) return 'summer'
  if (month >= 8 && month <= 10) return 'autumn'
  return 'winter'
}

export function getRandomTheme(): string {
  return CUISINE_THEMES[Math.floor(Math.random() * CUISINE_THEMES.length)]
}

export function getSeasonalTheme(): string {
  const season = getCurrentSeason()
  const themes = SEASONAL_THEMES[season]
  return themes[Math.floor(Math.random() * themes.length)]
}
