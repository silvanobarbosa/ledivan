import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

export default <Config>{
  darkMode: ['class'],
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './public/**/*.html',
    './components.json',
  ],
  theme: {
    extend: {
      colors: {
        background: "#f6fafe",
        foreground: "#171c1f",
        primary: "#00535b",
        "primary-container": "#006d77",
        "on-primary-container": "#9becf7",
        secondary: "#006d35",
        "secondary-container": "#3fff8b",
        "on-secondary-container": "#007237",
        tertiary: "#005452",
        "tertiary-container": "#006e6c",
        "on-tertiary-container": "#6cf3ef",
        error: "#ba1a1a",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",
        outline: "#6f797a",
        "outline-variant": "#bec8ca",
        surface: "#f6fafe",
        "surface-variant": "#dfe3e7",
        "surface-container-low": "#f0f4f8",
        "surface-container-high": "#e4e9ed",
        "surface-container-highest": "#dfe3e7",
        "on-surface-variant": "#3e494a",
      },
      fontFamily: {
        sans: ['Hanken Grotesk', ...defaultTheme.fontFamily.sans],
        display: ['Plus Jakarta Sans', ...defaultTheme.fontFamily.sans],
      },
      fontSize: {
        'headline-lg': ["32px", { lineHeight: "40px", fontWeight: "700" }],
        'headline-md': ["24px", { lineHeight: "32px", fontWeight: "600" }],
        'display-lg': ["40px", { lineHeight: "48px", letterSpacing: "-0.02em", fontWeight: "700" }],
        'label-md': ["14px", { lineHeight: "20px", letterSpacing: "0.01em", fontWeight: "600" }],
        'label-sm': ["12px", { lineHeight: "16px", fontWeight: "500" }],
      }
    },
  },
  plugins: [require('tailwindcss-animate')],
};
