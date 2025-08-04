/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('daisyui'),
  ],
  daisyui: {
    themes: [
      {
        'ea-theme': {
          'primary': '#000000',
          'primary-focus': '#1f1f1f',
          'primary-content': '#ffffff',
          'secondary': '#6b7280',
          'secondary-focus': '#4b5563',
          'secondary-content': '#ffffff',
          'accent': '#3b82f6',
          'accent-focus': '#2563eb',
          'accent-content': '#ffffff',
          'neutral': '#f9fafb',
          'neutral-focus': '#f3f4f6',
          'neutral-content': '#1f2937',
          'base-100': '#ffffff',
          'base-200': '#f9fafb',
          'base-300': '#f3f4f6',
          'base-content': '#1f2937',
          'info': '#3b82f6',
          'success': '#10b981',
          'warning': '#f59e0b',
          'error': '#ef4444',
        },
      },
      'light',
      'dark',
    ],
    base: true,
    styled: true,
    utils: true,
  },
}