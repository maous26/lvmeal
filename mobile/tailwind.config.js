/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Primary Blue - Trust, Calm, Professionalism
        primary: {
          50: '#EFF8FF',
          100: '#DEF0FF',
          200: '#B6E3FF',
          300: '#75CFFF',
          400: '#2CB8FF',
          500: '#009FEB', // Main primary
          600: '#0080C9',
          700: '#0066A3',
          800: '#005586',
          900: '#00476F',
          950: '#002D4A',
        },
        // Secondary Coral - Warmth, Energy, Appetite
        coral: {
          50: '#FFF5F3',
          100: '#FFEBE7',
          200: '#FFD4CC',
          300: '#FFB3A6',
          400: '#FF8A75',
          500: '#FF6B5B', // Main coral
          600: '#E84C3D',
          700: '#C43A2D',
          800: '#A13229',
          900: '#852E28',
          950: '#481410',
        },
        // Neutral - Elegant grays
        neutral: {
          50: '#FAFAF9',
          100: '#F5F5F3',
          200: '#E8E8E4',
          300: '#D4D4CD',
          400: '#A3A39A',
          500: '#737369',
          600: '#5C5C54',
          700: '#4A4A44',
          800: '#3D3D38',
          900: '#262622',
          950: '#171714',
        },
        // Success - Green for positive feedback
        success: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
        },
        // Warning - Amber
        warning: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
        },
        // Error - Red
        error: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B',
          900: '#7F1D1D',
        },
        // Nutrients - Specific colors for macros
        nutrient: {
          calories: '#FF6B5B',
          proteins: '#0080C9',
          carbs: '#F59E0B',
          fats: '#A855F7',
          fiber: '#10B981',
          water: '#06B6D4',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display': ['48px', { lineHeight: '52px', fontWeight: '700' }],
        'h1': ['36px', { lineHeight: '40px', fontWeight: '600' }],
        'h2': ['30px', { lineHeight: '36px', fontWeight: '600' }],
        'h3': ['24px', { lineHeight: '30px', fontWeight: '600' }],
        'h4': ['20px', { lineHeight: '26px', fontWeight: '600' }],
        'body-lg': ['18px', { lineHeight: '28px', fontWeight: '400' }],
        'body': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-sm': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'caption': ['12px', { lineHeight: '16px', fontWeight: '400' }],
      },
      borderRadius: {
        'sm': '6px',
        'DEFAULT': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '20px',
        '2xl': '24px',
        '3xl': '32px',
      },
      spacing: {
        '4.5': '18px',
        '13': '52px',
        '15': '60px',
        '18': '72px',
        '22': '88px',
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 70, 110, 0.08)',
        'medium': '0 4px 16px rgba(0, 70, 110, 0.12)',
        'strong': '0 8px 32px rgba(0, 70, 110, 0.16)',
        'glow-primary': '0 0 20px rgba(0, 159, 235, 0.3)',
        'glow-coral': '0 0 20px rgba(255, 107, 91, 0.3)',
      },
    },
  },
  plugins: [],
}
