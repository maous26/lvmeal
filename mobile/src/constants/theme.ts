// Presence - Design System Theme
// Direction artistique : Sobre, élégant, professionnel

export const colors = {
  // Backgrounds - Fond lumineux
  bg: {
    primary: '#F5F7FA',
    secondary: '#EDF1F7',
    tertiary: '#E2E8F0',
    elevated: '#FFFFFF',
    overlay: 'rgba(15, 50, 80, 0.6)',
  },

  // Text
  text: {
    primary: '#0F1A2A',
    secondary: '#3D5068',
    tertiary: '#7A8FA6',
    muted: '#B8C5D3',
  },

  // Accent - Bleu Océan VIF
  accent: {
    primary: '#0077B6',
    secondary: '#6366F1', // Indigo secondary accent
    hover: '#005F8F',
    light: '#E0F4FF',
    muted: '#90CDF4',
  },

  // Secondary Accent - Corail VIF
  secondary: {
    primary: '#FF6B5B',
    hover: '#E84C3D',
    light: '#FFF0EE',
  },

  // Semantic
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Nutrients
  nutrients: {
    calories: '#FF6B5B',
    proteins: '#0077B6',
    carbs: '#F59E0B',
    fats: '#A855F7',
    fiber: '#10B981',
    water: '#06B6D4',
  },

  // Borders
  border: {
    light: '#E2E8F0',
    default: '#CBD5E1',
    medium: '#94A3B8',
    focus: '#0077B6',
  },
}

export const shadows = {
  xs: {
    shadowColor: 'rgba(15, 50, 80, 0.05)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: 'rgba(15, 50, 80, 0.08)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  default: {
    shadowColor: 'rgba(15, 50, 80, 0.12)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 4,
  },
  md: {
    shadowColor: 'rgba(15, 50, 80, 0.15)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 30,
    elevation: 8,
  },
  lg: {
    shadowColor: 'rgba(15, 50, 80, 0.20)',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 1,
    shadowRadius: 50,
    elevation: 16,
  },
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  default: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
}

export const radius = {
  sm: 6,
  default: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
}

export const typography = {
  h1: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '600' as const,
    letterSpacing: -1,
  },
  h2: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '600' as const,
    letterSpacing: -0.5,
  },
  h3: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '600' as const,
    letterSpacing: -0.3,
  },
  h4: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
  },
  bodyMedium: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500' as const,
  },
  bodySemibold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
  },
  smallMedium: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500' as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
  },
  captionMedium: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500' as const,
  },
}

export default {
  colors,
  shadows,
  spacing,
  radius,
  typography,
}
