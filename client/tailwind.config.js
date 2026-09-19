/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488', // Primary brand color (growth & community)
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        accent: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316', // Warm CTA color
          600: '#ea580c',
          700: '#c2410c',
        },
        canvas: {
          DEFAULT: '#faf9f6', // Warm off-white community background
          card: '#ffffff',
          subtle: '#f3f2ee',
          border: '#e7e5df'
        },
        status: {
          reported: '#eab308',     // 🟡 Reported
          teamForming: '#3b82f6',  // 🔵 Team Forming
          fundingNeeded: '#f97316',// 🟠 Funding Needed
          inProgress: '#a855f7',   // 🟣 In Progress
          completed: '#22c55e'     // 🟢 Completed
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
