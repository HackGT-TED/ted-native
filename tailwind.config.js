/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      fontFamily: { heading: ['Tedfont2-Regular'] },
      colors: {
        paper: '#FBF6EE', ink: '#493529', muted: '#786351', cocoa: '#765139',
        line: '#E2D2BC', cream: '#F0E4D3', honey: '#B88D5B', rust: '#A14E3B',
      },
    },
  },
  plugins: [],
};
