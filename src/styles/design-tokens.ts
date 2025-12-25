/**
 * PRESENCE Design System - Tokens
 * Direction artistique : Sobre, élégant, professionnel
 * Inspiré par : Apple, Notion, Linear, Stripe
 */

export const colors = {
  // Fond principal - tons chauds et naturels
  background: {
    primary: '#FAFAF9',      // Blanc cassé chaud
    secondary: '#F5F5F4',    // Gris pierre clair
    tertiary: '#E7E5E4',     // Gris pierre
    elevated: '#FFFFFF',     // Blanc pur pour les cards
    overlay: 'rgba(0, 0, 0, 0.4)',
  },

  // Texte - hiérarchie claire
  text: {
    primary: '#1C1917',      // Presque noir chaud
    secondary: '#57534E',    // Gris moyen chaud
    tertiary: '#A8A29E',     // Gris clair
    inverse: '#FAFAF9',      // Pour fonds sombres
    muted: '#D6D3D1',        // Très discret
  },

  // Accent principal - Vert sauge élégant
  accent: {
    primary: '#84A98C',      // Vert sauge
    hover: '#6B8E73',        // Vert sauge foncé
    light: '#E8F0EA',        // Vert très clair
    muted: '#C4D4C8',        // Vert pastel
  },

  // Couleurs sémantiques - sobres
  semantic: {
    success: '#6B8E73',      // Vert sauge (cohérent)
    warning: '#D4A574',      // Caramel doux
    error: '#C47070',        // Rouge désaturé
    info: '#7C9AA5',         // Bleu-gris ardoise
  },

  // Macronutriments - palette harmonieuse
  nutrients: {
    calories: '#8B7355',     // Brun chaud
    proteins: '#84A98C',     // Vert sauge
    carbs: '#D4A574',        // Caramel
    fats: '#C4A982',         // Beige doré
    fiber: '#7C9AA5',        // Bleu-gris
    water: '#94B4C1',        // Bleu clair doux
  },

  // Bordures
  border: {
    light: '#E7E5E4',
    default: '#D6D3D1',
    focus: '#84A98C',
  },
}

export const typography = {
  // Font families
  fonts: {
    heading: '"SF Pro Display", "Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    body: '"SF Pro Text", "Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    mono: '"SF Mono", "JetBrains Mono", monospace',
  },

  // Tailles avec line-height optimisé
  sizes: {
    xs: { size: '0.75rem', lineHeight: '1rem', letterSpacing: '0.01em' },
    sm: { size: '0.875rem', lineHeight: '1.25rem', letterSpacing: '0' },
    base: { size: '1rem', lineHeight: '1.5rem', letterSpacing: '-0.01em' },
    lg: { size: '1.125rem', lineHeight: '1.75rem', letterSpacing: '-0.01em' },
    xl: { size: '1.25rem', lineHeight: '1.75rem', letterSpacing: '-0.02em' },
    '2xl': { size: '1.5rem', lineHeight: '2rem', letterSpacing: '-0.02em' },
    '3xl': { size: '1.875rem', lineHeight: '2.25rem', letterSpacing: '-0.02em' },
    '4xl': { size: '2.25rem', lineHeight: '2.5rem', letterSpacing: '-0.03em' },
    '5xl': { size: '3rem', lineHeight: '1.1', letterSpacing: '-0.03em' },
  },

  // Poids
  weights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
}

export const spacing = {
  0: '0',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  8: '2rem',      // 32px
  10: '2.5rem',   // 40px
  12: '3rem',     // 48px
  16: '4rem',     // 64px
  20: '5rem',     // 80px
  24: '6rem',     // 96px
}

export const borderRadius = {
  none: '0',
  sm: '0.375rem',    // 6px
  default: '0.5rem', // 8px
  md: '0.75rem',     // 12px
  lg: '1rem',        // 16px
  xl: '1.25rem',     // 20px
  '2xl': '1.5rem',   // 24px
  full: '9999px',
}

export const shadows = {
  // Ombres très subtiles et élégantes
  none: 'none',
  xs: '0 1px 2px rgba(28, 25, 23, 0.04)',
  sm: '0 2px 4px rgba(28, 25, 23, 0.06)',
  default: '0 4px 12px rgba(28, 25, 23, 0.08)',
  md: '0 8px 24px rgba(28, 25, 23, 0.10)',
  lg: '0 16px 48px rgba(28, 25, 23, 0.12)',
  xl: '0 24px 64px rgba(28, 25, 23, 0.14)',

  // Ombre intérieure pour inputs
  inner: 'inset 0 1px 2px rgba(28, 25, 23, 0.06)',

  // Ombre pour focus ring
  focus: '0 0 0 3px rgba(132, 169, 140, 0.2)',
}

export const transitions = {
  // Durées
  duration: {
    instant: '50ms',
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
    slower: '500ms',
  },

  // Easing curves - naturelles et fluides
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
}

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
}

// Z-index scale
export const zIndex = {
  behind: -1,
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  modalBackdrop: 40,
  modal: 50,
  popover: 60,
  tooltip: 70,
  toast: 80,
}
