/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,js}'],
  theme: {
    extend: {
      colors: {
        brand: '#1d4ed8',
        brandLight: '#eff6ff',
        ink: '#0f172a',
        muted: '#64748b',
        faint: '#94a3b8',
        border: '#e2e8f0',
        success: '#059669',
        successBg: '#ecfdf5',
      }
    },
  },
  plugins: [],
}
