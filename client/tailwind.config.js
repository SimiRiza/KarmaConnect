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
          50: '#f1f8f5',
          100: '#dceee6',
          200: '#b9ddce',
          300: '#8cc5b2',
          400: '#59a792',
          500: '#348c7b',
          600: '#23786b', // Primary brand color (growth & community)
          700: '#206157',
          800: '#204e47',
          900: '#1c413c',
        },
        accent: {
          50: '#fff5f0',
          100: '#fce5d9',
          200: '#f7cbb8',
          300: '#eeaa8e',
          400: '#df8060',
          500: '#bf5135', // Warm CTA color
          600: '#a9432b',
          700: '#893925',
        },
        canvas: {
          DEFAULT: '#f8f9f5', // Warm off-white community background
          card: '#ffffff',
          subtle: '#eef2eb',
          border: '#dde5db'
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
