/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#eef1f6',
          100: '#d6dce8',
          200: '#adb9d1',
          300: '#8496ba',
          400: '#5b73a3',
          500: '#3d5686',
          600: '#2c4169',
          700: '#1f2f4d',
          800: '#141f36',
          900: '#0a1120',
          950: '#050912'
        },
        emerald: {
          50: '#e8f8f0',
          100: '#c6efd9',
          200: '#9ce4bf',
          300: '#69d5a0',
          400: '#3cc283',
          500: '#1fa86a',
          600: '#178a57',
          700: '#116c44',
          800: '#0c4e32',
          900: '#073320'
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        card: '0 1px 2px rgba(10,17,32,0.04), 0 8px 24px rgba(10,17,32,0.06)',
        glass: '0 8px 32px rgba(10,17,32,0.10)'
      },
      borderRadius: {
        xl2: '1.25rem'
      }
    }
  },
  plugins: []
};
