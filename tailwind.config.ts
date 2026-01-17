import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FBF8F1',
          100: '#F5EDD9',
          200: '#EBD9B3',
          300: '#DFC68D',
          400: '#D4B479',
          500: '#C4A76B',
          600: '#B0935A',
          700: '#957940',
          800: '#7A5F2D',
          900: '#5F471D',
        },
      },
    },
  },
  plugins: [],
}
export default config
