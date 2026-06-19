/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{ts,tsx}",
    "!./src/generated/**/*",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#f5f5f5",
        "canvas-soft": "#fafafa",
        ink: "#0c0a09",
        body: "#4e4e4e",
        muted: "#777169",
        hairline: "#e7e5e4",
        "surface-card": "#ffffff",
        "surface-strong": "#f0efed",
        primary: "#292524",
        "primary-active": "#0c0a09",
        "on-primary": "#ffffff",
      },
      fontFamily: {
        display: ["Waldenburg", "Times New Roman", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        pill: "9999px",
        xxl: "24px",
        xl: "16px",
      },
    },
  },
  plugins: [],
};
