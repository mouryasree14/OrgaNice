import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0d1b3d',
          dark: '#080f24',
          card: '#152248',
          hover: '#1e2e56',
          light: '#24355d',
        },
        blue: {
          DEFAULT: '#2563eb',
          hover: '#1d4ed8',
          soft: '#eef2ff',
          light: '#dbeafe',
        },
        violet: {
          DEFAULT: '#7c3aed',
          hover: '#6d28d9',
          light: '#f5f3ff',
          border: '#ddd6fe',
        }
      }
    }
  },
  plugins: []
} satisfies Config;
