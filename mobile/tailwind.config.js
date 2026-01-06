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
        // Primary Moss Green - Serenity, Nature, Trust
        primary: {
          50: '#EDF3EC',
          100: '#DCE7DA',
          200: '#B8CBB4',
          300: '#94AF8F',
          400: '#6E8E68',
          500: '#4A6741', // Main primary - Vert Mousse
          600: '#3D5636',
          700: '#30442B',
          800: '#243320',
          900: '#172215',
          950: '#0B110A',
        },
        // Secondary Terracotta - Warmth, Earth, Appetite
        terracotta: {
          50: '#FBF5F3',
          100: '#F7EBE7',
          200: '#E5CFC9',
          300: '#D9B5AB',
          400: '#D09789',
          500: '#C87863', // Main terracotta - Terre Cuite
          600: '#B56A56',
          700: '#965749',
          800: '#77453C',
          900: '#5D372F',
          950: '#321C18',
        },
        // Organic palette
        organic: {
          sage: '#7A9E7E',
          sand: '#E2DCCA',
          stone: '#8B8680',
          moss: '#4A6741',
          clay: '#B8856C',
          ocean: '#2D7A9C',
          lavender: '#9B7BB8',
          caramel: '#D4A574',
        },
        // Neutral - Warm grays
        neutral: {
          50: '#FDFCFA',
          100: '#F7F5F2',
          200: '#EDE9E3',
          300: '#D8D2C8',
          400: '#B5AFA5',
          500: '#8B8680',
          600: '#6B665F',
          700: '#4A4640',
          800: '#3A3632',
          900: '#2D2A27',
          950: '#1A1816',
        },
        // Success - Natural green
        success: {
          50: '#EDF5EE',
          100: '#DAEADC',
          200: '#B5D5B9',
          300: '#90C096',
          400: '#6BAB73',
          500: '#5C8A5E',
          600: '#4A704C',
          700: '#3B593D',
          800: '#2D422E',
          900: '#1E2C1F',
        },
        // Warning - Caramel
        warning: {
          50: '#FDF8F3',
          100: '#FAF1E7',
          200: '#F5E3CF',
          300: '#EDD4B3',
          400: '#E3BE91',
          500: '#D4A574',
          600: '#C08B56',
          700: '#9E6F42',
          800: '#7B5634',
          900: '#5A3F26',
        },
        // Error - Earth red
        error: {
          50: '#FDF2F2',
          100: '#FADDDD',
          200: '#F5BBBB',
          300: '#E99999',
          400: '#D97777',
          500: '#C75D5D',
          600: '#A54949',
          700: '#833939',
          800: '#612C2C',
          900: '#3F1E1E',
        },
        // Nutrients - Organic colors
        nutrient: {
          calories: '#C87863',  // Terracotta
          proteins: '#4A6741',  // Moss
          carbs: '#D4A574',     // Caramel
          fats: '#9B7BB8',      // Lavender
          fiber: '#7A9E7E',     // Sage
          water: '#6BA3BE',     // Ocean light
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['PlayfairDisplay', 'Georgia', 'serif'],
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
        'soft': '0 2px 8px rgba(74, 103, 65, 0.08)',
        'medium': '0 4px 16px rgba(74, 103, 65, 0.12)',
        'strong': '0 8px 32px rgba(74, 103, 65, 0.16)',
        'glow-primary': '0 0 20px rgba(74, 103, 65, 0.35)',
        'glow-secondary': '0 0 20px rgba(200, 120, 99, 0.35)',
        'glass': '0 8px 32px rgba(74, 103, 65, 0.12)',
      },
    },
  },
  plugins: [],
}
