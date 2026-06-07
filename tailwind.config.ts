import type { Config } from 'tailwindcss';

// Tailwind v4: o tema vive em src/app/globals.css (@theme). Este arquivo só mantém
// darkMode, content e plugins. NÃO redefinir cores/fontes aqui (evita paleta legada vazar).
export default <Config>{
  darkMode: ['class'],
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './public/**/*.html',
  ],
  plugins: [require('tailwindcss-animate')],
};
