/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      animation: {
        marquee: 'marquee 30s linear infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
      },
      fontFamily: {
        hindi: ['"Noto Sans Devanagari"', 'sans-serif'],
        gujarati: ['"Noto Sans Gujarati"', 'Shruti', 'sans-serif'],
        english: ['"Inter"', 'sans-serif'],
      },
      colors: {
        dark: {
          primary: '#0f172a',
          secondary: '#1e293b',
          accent: '#334155',
          text: '#f1f5f9',
          'text-secondary': '#cbd5e1'
        }
      }
    },
  },
  plugins: [],
};