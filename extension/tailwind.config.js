/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#f97316', // orange-500
          hover: '#ea580c',   // orange-600
        },
        accent: {
          DEFAULT: '#38bdf8', // sky-400
          hover: '#0ea5e9',   // sky-500
        },
      },
    },
  },
  plugins: [],
};
